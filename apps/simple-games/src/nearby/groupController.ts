import type { PluginListenerHandle } from '@capacitor/core';
import { Channel } from './channel';
import { metadataGameCode, parseListing, serializeListing, type DiscoveredPeer } from './discovery';
import {
  GroupSession,
  validGroupSnapshot,
  type Control,
  type GroupGame,
  type GroupSnapshot,
} from './groupSession';
import {
  nearbyPlugin,
  randomId,
  type NativeEvent,
  type NearbyPlugin,
  type Transport,
} from './native';
import { isPlayerName, isRoomName } from './session';
import { record } from './gameTypes';
import { isAllowedNearbyText } from './contentFilter';
import { NEARBY_CAPACITY } from '../app/nearbyGameIds';
import { radioOwners as owners } from './ownership';
import { blockIdentity, loadHistory, saveDisplayName, saveGroup, type SavedGroup } from './history';
import { createLudo, applyLudo, isLudoState, ludoCpuAction, ludoResult } from './games/ludo';

export interface GroupSetup {
  host: boolean;
  name: string;
  roomName: string;
  transport: Transport;
}
interface Link {
  channel: Channel;
  outgoing: Promise<void>;
  pending: number;
  timer?: ReturnType<typeof setTimeout>;
  timeout: number | null;
  participant?: { name: string; identity: string; title?: string };
}
const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000;
export const ludoGroupGame: GroupGame = {
  id: 'ludo',
  capacity: NEARBY_CAPACITY.ludo,
  create: () => createLudo(random),
  valid: isLudoState,
  turn: (s) => (isLudoState(s) ? s.turn : -1),
  finished: (s) => isLudoState(s) && ludoResult(s) !== null,
  apply: (s, seat, action) => (isLudoState(s) ? applyLudo(s, seat, action, random) : null),
  cpu: (s) => (isLudoState(s) ? ludoCpuAction(s) : null),
};

/**
 * A host and up to three individually encrypted links. No host migration. A lost link is an
 * absence, not a leave: a seated guest finds the host again by its label and proves it is
 * the same participant with the continuation key of the link it was approved on.
 */
export class GroupController {
  status: 'idle' | 'searching' | 'connecting' | 'room' | 'reconnecting' | 'ended' = 'idle';
  reason = '';
  storageFailed = false;
  peers: DiscoveredPeer[] = [];
  hostSession: GroupSession | null = null;
  snapshot: GroupSnapshot | null = null;
  /** The seats as a round finished. Its result keeps these names after anyone leaves. */
  finishedSeats: { round: number; seats: GroupSnapshot['seats'] } | null = null;
  readonly codes = new Map<string, string>();
  readonly participants = new Map<string, { name: string; identity: string }>();
  private links = new Map<string, Link>();
  private listener: PluginListenerHandle | null = null;
  private active = false;
  private foreground = true;
  private incoming = Promise.resolve();
  /** Events still queued per sender ('' for radio-wide events), so one flood cannot evict another. */
  private readonly queued = new Map<string, number>();
  /** All queued events. Past this, only current links and radio-wide events are taken. */
  private queuedTotal = 0;
  private cpuTimer?: ReturnType<typeof setTimeout>;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private selected: DiscoveredPeer | null = null;
  private stopping: Promise<void> | null = null;
  private label = '';
  private autoJoinLabel = '';
  private savedSignature = '';
  private savedGroup: SavedGroup | null = null;
  private identity = '';
  private blocked: string[] = [];
  private hostVerified = false;
  private permittedRevision = -1;
  /** Host: the continuation key and participant each held seat was approved with. */
  private readonly seatKeys = new Map<number, { key: CryptoKey; name: string; identity: string }>();
  /** Host: keys of people who no longer hold a seat, so their return can be refused provably. */
  private readonly releasedKeys = new Map<string, CryptoKey>();
  /** Guest: the continuation key of the link this device was seated on, and its host. */
  private resumeKey: CryptoKey | null = null;
  private hostIdentity = '';
  private connectingHost = false;
  private restarting = false;
  /** An error arrived while the radio was being started again: that start failed. */
  private restartFailed = false;
  private retryTimer?: ReturnType<typeof setTimeout>;
  /** Host: last recruiting state the radio accepted; null until the radio is up. */
  private visible: boolean | null = null;
  private listingTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly setup: GroupSetup,
    private readonly changed: () => void,
    private readonly plugin: NearbyPlugin = nearbyPlugin,
    readonly game: GroupGame = ludoGroupGame,
  ) {}

  async start(autoJoinLabel = '') {
    if (this.active || this.status !== 'idle') return;
    if (
      !isPlayerName(this.setup.name) ||
      !isAllowedNearbyText(this.setup.name) ||
      (this.setup.host &&
        (!isRoomName(this.setup.roomName) || !isAllowedNearbyText(this.setup.roomName)))
    ) {
      this.status = 'ended';
      this.reason = 'invalid';
      this.changed();
      return;
    }
    const previous = owners.get(this.plugin);
    if (previous && previous !== this) await previous.stop();
    owners.set(this.plugin, this);
    this.active = true;
    this.autoJoinLabel = autoJoinLabel;
    this.label = `P-${metadataGameCode(this.game.id)}${randomId().slice(0, 4).toUpperCase()}`;
    try {
      const history = await loadHistory(this.plugin);
      this.identity = history.identity;
      this.blocked = history.blocked;
      await saveDisplayName(this.setup.name, this.plugin);
      if (!this.active) return;
      if (this.setup.host) {
        this.hostSession = new GroupSession({
          name: this.setup.name,
          title: this.setup.roomName,
          room: randomId(),
          game: this.game,
          send: (peer, value) => this.send(peer, value),
          changed: () => this.observe(),
        });
        this.snapshot = this.hostSession.snapshot();
      }
      this.listener = await this.plugin.addListener('nearbyEvent', (event) => {
        if (!this.active) return;
        if (event.type === 'lifecycle') {
          this.setForeground(event.active);
          return;
        }
        const source = ('peerId' in event && event.peerId) || '';
        // Connection churn mints a fresh peer ID each time, so per-sender limits alone do not
        // bound the queue. Under that pressure, strangers are shed and their new links closed.
        if (this.queuedTotal >= 256 && source && !this.links.has(source)) {
          if (event.type === 'connected')
            void this.plugin.disconnect?.({ peerId: source }).catch(() => undefined);
          return;
        }
        const queued = (this.queued.get(source) ?? 0) + 1;
        if (queued > 64) {
          // A flood is its sender's fault: the host turns that participant away, not the whole
          // room. For a guest it ends the gathering, as two-player rooms do, unless the sender
          // is only a candidate it has not verified while looking for its host.
          if (source && this.setup.host) this.expel(source);
          else if (this.status === 'reconnecting' && !this.hostVerified) this.lost('connection');
          else void this.stop('connection');
          return;
        }
        this.queued.set(source, queued);
        this.queuedTotal++;
        this.incoming = this.incoming
          .then(async () => {
            if (this.active) await this.event(event);
          })
          .catch(() => {
            // A protocol violation ends that participant, as in two-player rooms. Only a guest
            // still looking for its host may have reached a lookalike, so it searches again.
            if ('peerId' in event && event.peerId && this.setup.host) this.expel(event.peerId);
            else if (this.status === 'reconnecting' && !this.hostVerified) this.lost('connection');
            else void this.stop('connection');
          })
          .finally(() => {
            this.queuedTotal--;
            const left = (this.queued.get(source) ?? 1) - 1;
            if (left > 0) this.queued.set(source, left);
            else this.queued.delete(source);
          });
      });
      if (!this.active) {
        await this.listener.remove();
        return;
      }
      this.status = this.setup.host ? 'room' : 'searching';
      await this.plugin.start({
        transport: this.setup.transport,
        role: this.setup.host ? 'advertise' : 'browse',
        label: this.label,
        maxPeers: 3,
        ...(this.setup.host ? { listing: this.listing() } : {}),
      });
      if (!this.active) {
        if (owners.get(this.plugin) === this) await this.plugin.stop();
        return;
      }
      if (this.setup.host) this.visible = true;
      if (!this.setup.host)
        this.searchTimer = setTimeout(() => {
          void this.stop('timeout');
        }, 60000);
      this.observe();
    } catch {
      await this.stop('connection');
    }
  }
  async join(id: string) {
    if (!this.active || this.setup.host || this.status !== 'searching') return;
    const peer = this.peers.find((p) => p.id === id);
    if (!peer) return;
    this.selected = peer;
    this.status = 'connecting';
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.stop('timeout');
    }, 15000);
    this.changed();
    try {
      await this.plugin.connect({ peerId: id });
    } catch {
      await this.stop('connection');
    }
  }
  private async event(event: NativeEvent) {
    if (event.type === 'peer' && this.status === 'reconnecting') {
      // Discovery only nominates a candidate. The continuation proof decides, so a hidden
      // room (no listing) is enough, and a copied label cannot take the seat.
      if (!this.setup.host && !this.connectingHost && event.name === this.selected?.name) {
        this.connectingHost = true;
        this.retry(15000);
        try {
          await this.plugin.connect({ peerId: event.id });
        } catch {
          this.connectingHost = false;
          this.retry();
        }
      }
      return;
    }
    if (event.type === 'peer' && this.status === 'searching') {
      const listing = parseListing(event.listing, event.name);
      this.peers = this.peers.filter((p) => p.id !== event.id);
      // A room that stops recruiting drops its listing; it leaves the list without a note.
      if (listing?.gameId !== this.game.id) {
        this.changed();
        return;
      }
      if (this.peers.length < 16)
        this.peers.push({
          id: event.id,
          name: event.name,
          gameId: this.game.id,
          roomName: listing.roomName,
        });
      this.changed();
      if (event.name === this.autoJoinLabel && listing.roomName === this.setup.roomName) {
        this.autoJoinLabel = '';
        await this.join(event.id);
      }
    } else if (event.type === 'peerLost') {
      this.peers = this.peers.filter((p) => p.id !== event.id);
      this.changed();
    } else if (event.type === 'connected') {
      if (!event.peerId) throw new Error('Multi-peer native support required');
      await this.attach(event.peerId);
    } else if (event.type === 'data') {
      if (!event.peerId || event.data.length > 4096) throw new Error('Invalid peer frame');
      await this.links.get(event.peerId)?.channel.receive(event.data);
    } else if (event.type === 'disconnected') {
      if (this.setup.host && event.peerId) this.drop(event.peerId, false);
      // The restart's own stop, or an earlier link of this guest, is not news.
      else if (this.restarting || (event.peerId && !this.links.has(event.peerId))) return;
      else this.lost('hostLeft');
    } else if (event.type === 'error') {
      // Stopping the radio emits only 'disconnected', so an error while restarting is the new
      // start failing (iOS reports a LAN listener failure this way and still resolves start()).
      if (this.restarting) this.restartFailed = true;
      else this.lost('connection');
    }
  }
  private async attach(peer: string) {
    if (this.links.has(peer)) return;
    if (this.links.size >= (this.setup.host ? 3 : 1)) {
      await this.plugin.disconnect?.({ peerId: peer });
      return;
    }
    const channel = await Channel.create(
      this.setup.host,
      (data) =>
        this.links.get(peer)?.channel === channel
          ? this.plugin.send({ peerId: peer, data })
          : Promise.resolve(),
      async () => {
        if (!this.active || this.links.get(peer)?.channel !== channel) return;
        this.codes.set(peer, channel.code);
        if (!this.setup.host && this.status === 'reconnecting' && this.resumeKey && this.snapshot) {
          const proof = await channel.resumeProof(this.resumeKey);
          if (this.links.get(peer)?.channel !== channel) return;
          this.send(peer, {
            group: 1,
            type: 'resume',
            room: this.snapshot.room,
            identity: this.identity,
            proof,
          });
          this.arm(peer, 15000);
          this.changed();
          return;
        }
        if (!this.setup.host) {
          clearTimeout(this.searchTimer);
          this.send(peer, {
            group: 1,
            type: 'join',
            name: this.setup.name,
            identity: this.identity,
          });
        } else {
          this.send(peer, {
            group: 1,
            type: 'hello',
            name: this.setup.name,
            identity: this.identity,
            title: this.setup.roomName,
          });
        }
        this.arm(peer, 60000);
        this.changed();
      },
      (raw) => {
        if (this.links.get(peer)?.channel === channel) return this.receive(peer, raw);
      },
    );
    if (!this.active) {
      channel.close();
      return;
    }
    this.links.set(peer, { channel, outgoing: Promise.resolve(), pending: 0, timeout: null });
    // From here the link's own deadline governs a returning guest's handshake.
    if (this.status === 'reconnecting') {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    this.arm(peer, 15000);
    // Not awaited: a native send that never settles must not stall every other link's events.
    void channel.start().catch(() => {
      if (this.links.get(peer)?.channel === channel) this.drop(peer);
    });
  }
  private arm(peer: string, delay: number) {
    const link = this.links.get(peer);
    if (!link) return;
    clearTimeout(link.timer);
    link.timeout = delay;
    if (this.foreground)
      link.timer = setTimeout(() => {
        if (this.links.get(peer) === link) this.drop(peer);
      }, delay);
  }
  private send(peer: string, message: unknown) {
    const link = this.links.get(peer);
    if (!link || !this.active || link.pending >= 64) {
      if (link?.pending === 64) this.drop(peer);
      return;
    }
    const raw = JSON.stringify(message);
    if (new TextEncoder().encode(raw).length > 2800) {
      this.drop(peer);
      return;
    }
    link.pending++;
    link.outgoing = link.outgoing
      .then(async () => {
        if (this.active && this.links.get(peer) === link) await link.channel.send(raw);
      })
      .catch(() => {
        if (this.links.get(peer) === link) this.drop(peer);
      })
      .finally(() => {
        link.pending--;
      });
    if (record(message) && message.type === 'state') this.arm(peer, 15000);
  }
  private async receive(peer: string, raw: string) {
    if (!this.active || new TextEncoder().encode(raw).length > 2800)
      throw new Error('Oversized group message');
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.group !== 1) throw new Error('Invalid group message');
    if (value.type === 'leave') {
      // Leaving is deliberate: the seat goes to a CPU now and cannot be resumed.
      const seat = this.hostSession?.members.get(peer);
      if (seat !== undefined) {
        this.forget(seat);
        this.hostSession!.leave(peer);
      }
      this.drop(peer);
      return;
    }
    if (this.hostSession) {
      if (value.type === 'resume') {
        await this.resumeGuest(peer, value);
        return;
      }
      if (
        value.type === 'join' &&
        (!isPlayerName(value.name) ||
          !isAllowedNearbyText(value.name) ||
          typeof value.identity !== 'string' ||
          !/^[a-f0-9]{32}$/.test(value.identity) ||
          this.blocked.includes(value.identity) ||
          (!this.hostSession.members.has(peer) && !this.hostSession.discoverable))
      ) {
        // Applicants mid-match, or with no seat to offer, get the existing refusal, which older
        // guests also understand.
        this.decline(peer);
        return;
      }
      if (
        value.type === 'join' &&
        !this.rememberParticipant(peer, {
          name: value.name as string,
          identity: value.identity as string,
        })
      )
        return;
      if (value.type === 'action' && !this.foreground) return;
      this.hostSession.receive(peer, value);
      if (
        value.type === 'ack' &&
        this.hostSession.members.has(peer) &&
        value.room === this.hostSession.options.room &&
        value.revision === this.hostSession.revision
      ) {
        const link = this.links.get(peer);
        if (link) {
          clearTimeout(link.timer);
          link.timeout = null;
        }
      }
      return;
    }
    if (['ended', 'declined', 'replaced'].includes(String(value.type))) {
      // While looking for its host, a guest believes an ending only from a device that proves
      // the continuation key: anyone nearby can copy the host's hello, so a lookalike cannot
      // end a held seat.
      if (this.status === 'reconnecting' && !this.hostVerified) {
        const link = this.links.get(peer);
        if (
          !this.resumeKey ||
          !link ||
          typeof value.proof !== 'string' ||
          !(await link.channel.verifyResume(this.resumeKey, value.proof))
        )
          throw new Error('Unverified ending notice');
      }
      void this.stop(String(value.type));
      return;
    }
    if (value.type === 'hello') {
      if (
        !isPlayerName(value.name) ||
        !isAllowedNearbyText(value.name) ||
        !isRoomName(value.title) ||
        value.title !== this.selected?.roomName ||
        typeof value.identity !== 'string' ||
        !/^[a-f0-9]{32}$/.test(value.identity) ||
        this.blocked.includes(value.identity) ||
        (this.status === 'reconnecting' && value.identity !== this.hostIdentity)
      )
        throw new Error('Blocked or mismatched host');
      if (
        !this.rememberParticipant(peer, {
          name: value.name,
          identity: value.identity,
          title: value.title,
        })
      )
        return;
      // A returning guest trusts the room again only after the host's own proof.
      if (this.status !== 'reconnecting') {
        this.hostIdentity = value.identity;
        this.hostVerified = true;
      }
      return;
    }
    if (value.type === 'resumed') {
      const link = this.links.get(peer);
      if (
        this.status !== 'reconnecting' ||
        !link?.participant ||
        !this.resumeKey ||
        value.room !== this.snapshot?.room ||
        !(await link.channel.verifyResume(this.resumeKey, value.proof))
      )
        throw new Error('Wrong continuation host');
      if (this.links.get(peer) === link) this.hostVerified = true;
      return;
    }
    if (value.type === 'turnReady') {
      if (
        this.hostVerified &&
        this.snapshot &&
        value.room === this.snapshot.room &&
        value.revision === this.snapshot.revision
      ) {
        this.permittedRevision = this.snapshot.revision;
        this.changed();
      }
      return;
    }
    if (
      !this.hostVerified ||
      !validGroupSnapshot(value, this.game) ||
      value.title !== this.selected?.roomName ||
      (this.snapshot &&
        (value.room !== this.snapshot.room ||
          value.revision < this.snapshot.revision ||
          (this.status === 'reconnecting' && value.you !== this.snapshot.you)))
    )
      throw new Error('Invalid room state');
    this.snapshot = value;
    this.permittedRevision = -1;
    this.status = 'room';
    this.connectingHost = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const link = this.links.get(peer);
    if (link) {
      // Seated on this link: its continuation key is the one the host stored at approval.
      this.resumeKey ??= link.channel.reconnectKey;
      clearTimeout(link.timer);
      link.timeout = null;
    }
    this.send(peer, { group: 1, type: 'ack', room: value.room, revision: value.revision });
    this.observe();
  }
  private rememberParticipant(
    peer: string,
    participant: { name: string; identity: string; title?: string },
  ): boolean {
    const link = this.links.get(peer);
    if (!link) return false;
    if (link.participant) {
      if (
        link.participant.name !== participant.name ||
        link.participant.identity !== participant.identity ||
        link.participant.title !== participant.title
      )
        throw new Error('Participant changed during the connection');
      return false;
    }
    link.participant = participant;
    this.participants.set(peer, { name: participant.name, identity: participant.identity });
    return true;
  }
  approve(peer: string, seat: number) {
    const session = this.hostSession;
    const key = this.links.get(peer)?.channel.reconnectKey;
    const participant = this.participants.get(peer);
    if (!session || !key || !participant) return;
    const previous = [...session.members].find(([, s]) => s === seat)?.[0];
    if (!session.approve(peer, seat)) return;
    this.forget(seat);
    this.seatKeys.set(seat, { key, name: participant.name, identity: participant.identity });
    // The replaced person was told so; their link must not keep a radio slot.
    const old = previous && previous !== peer ? this.links.get(previous) : undefined;
    void old?.outgoing.finally(() => {
      if (this.links.get(previous!) === old) this.drop(previous!);
    });
  }
  /**
   * A returning guest's first message on a new link. Only a proof made with the continuation
   * key of the link a held seat was approved on rebinds that seat; anything else is declined.
   */
  private async resumeGuest(peer: string, value: Record<string, unknown>) {
    const session = this.hostSession!;
    const link = this.links.get(peer);
    if (session.members.has(peer)) {
      this.expel(peer);
      return;
    }
    if (
      !link ||
      link.participant ||
      session.pending.has(peer) ||
      value.room !== session.options.room ||
      typeof value.identity !== 'string'
    ) {
      this.decline(peer);
      return;
    }
    // A blocked person never resumes; like anyone released, they get a refusal they can verify.
    for (const [seat, held] of this.seatKeys) {
      if (
        held.identity !== value.identity ||
        !session.isHeld(seat) ||
        this.blocked.includes(held.identity)
      )
        continue;
      if (!(await link.channel.verifyResume(held.key, value.proof))) continue;
      const proof = await link.channel.resumeProof(held.key);
      // The host may have given the seat to someone else while the proof was checked.
      if (
        this.links.get(peer) !== link ||
        !session.isHeld(seat) ||
        this.seatKeys.get(seat) !== held
      )
        break;
      if (!this.rememberParticipant(peer, { name: held.name, identity: held.identity })) return;
      const previous = [...session.members].find(([, s]) => s === seat)?.[0];
      // The proof goes out before the snapshot that resume() publishes on the same link.
      this.send(peer, { group: 1, type: 'resumed', room: session.options.room, proof });
      session.resume(peer, seat);
      if (previous && previous !== peer) this.drop(previous);
      return;
    }
    // Someone whose seat was released gets a refusal they can verify, and stops looking.
    const released = this.releasedKeys.get(value.identity);
    if (released && (await link.channel.verifyResume(released, value.proof))) {
      const proof = await link.channel.resumeProof(released);
      if (this.links.get(peer) !== link) return;
      this.send(peer, { group: 1, type: 'declined', proof });
      void link.outgoing.finally(() => {
        if (this.links.get(peer) === link) this.drop(peer);
      });
      return;
    }
    if (this.links.get(peer) === link) this.decline(peer);
  }
  /** Host: a link is gone. A seat its person never saw is released, with its key kept to refuse. */
  private unlink(peer: string) {
    const seat = this.hostSession?.members.get(peer);
    if (this.hostSession?.disconnect(peer) && seat !== undefined) this.forget(seat);
  }
  /** Host: a seat's person no longer holds it; keep their key only to refuse a return. */
  private forget(seat: number) {
    const held = this.seatKeys.get(seat);
    if (!held) return;
    this.seatKeys.delete(seat);
    this.releasedKeys.set(held.identity, held.key);
  }
  decline(peer: string) {
    this.hostSession?.reject(peer);
    const link = this.links.get(peer);
    void link?.outgoing.finally(() => {
      if (this.links.get(peer) === link) this.drop(peer);
    });
  }
  /** Host: a member that broke the protocol loses its seat to a CPU and is turned away. */
  private expel(peer: string) {
    const seat = this.hostSession?.members.get(peer);
    if (seat === undefined) {
      this.drop(peer);
      return;
    }
    this.forget(seat);
    this.hostSession!.release(seat);
    this.decline(peer);
  }
  control(seat: number, control: Control) {
    this.hostSession?.control(seat, control);
  }
  async block(peer: string) {
    const participant = this.participants.get(peer);
    if (!participant) return;
    const writing = blockIdentity(participant.identity, this.plugin);
    this.blocked.push(participant.identity);
    // Stop accepting this peer immediately; disk failure must not keep it connected.
    if (this.setup.host) {
      // A blocked person does not keep a seat to come back to.
      const seat = this.hostSession?.members.get(peer);
      if (seat !== undefined) {
        this.forget(seat);
        this.hostSession!.release(seat);
      }
      // Forget them now; the link closes once the refusal has gone out.
      this.participants.delete(peer);
      this.decline(peer);
    } else void this.stop('blocked');
    try {
      await writing;
    } catch {
      this.storageFailed = true;
      this.changed();
    }
  }
  ready() {
    if (this.hostSession) this.hostSession.ready();
    else this.command({ type: 'ready' });
  }
  startRound() {
    this.hostSession?.start();
  }
  act(action: unknown) {
    const s = this.snapshot;
    if (!s || !this.canAct) return;
    if (this.hostSession) this.hostSession.act('host', s.revision, s.seats[0]!.epoch, action);
    else
      this.command({ type: 'action', revision: s.revision, epoch: s.seats[s.you]!.epoch, action });
  }
  private command(value: Record<string, unknown>) {
    const peer = this.links.keys().next().value;
    if (peer && this.snapshot && this.status === 'room' && this.hostVerified) {
      this.send(peer, { ...value, group: 1, room: this.snapshot.room });
      // An unanswered move means the host is away or the link is half-open. The deadline only
      // makes this guest look for the host again; its seat stays held.
      if (value.type === 'action') {
        this.permittedRevision = -1;
        this.arm(peer, 15000);
        this.changed();
      }
    }
  }
  get canAct(): boolean {
    const s = this.snapshot;
    return (
      this.active &&
      !this.stopping &&
      this.foreground &&
      !!s &&
      s.state !== null &&
      !this.game.finished(s.state) &&
      s.seats[s.you]?.control === 'human' &&
      s.seats.every((seat) => seat.control !== 'human' || seat.connected) &&
      this.game.turn(s.state) === s.you &&
      (this.hostSession ? this.hostSession.canAct(0) : this.permittedRevision === s.revision)
    );
  }
  setForeground(active: boolean) {
    this.foreground = active;
    clearTimeout(this.searchTimer);
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    if (active && this.status === 'reconnecting') this.retry(0);
    if (
      active &&
      (this.status === 'searching' || (this.status === 'connecting' && this.links.size === 0))
    )
      this.searchTimer = setTimeout(
        () => {
          void this.stop('timeout');
        },
        this.status === 'searching' ? 60000 : 15000,
      );
    for (const [peer, link] of this.links) {
      clearTimeout(link.timer);
      if (active) {
        if (this.hostSession?.members.has(peer)) this.send(peer, this.hostSession.snapshot(peer));
        else if (link.timeout !== null) this.arm(peer, link.timeout);
      }
    }
    this.observe();
  }
  private observe() {
    if (this.hostSession) this.snapshot = this.hostSession.snapshot();
    const s = this.snapshot;
    // The host freezes the seats as the round ends and sends them; an older host does not, so
    // fall back to the first finished snapshot this device saw.
    if (s?.state != null && this.game.finished(s.state)) {
      if (s.final)
        this.finishedSeats = { round: s.round, seats: s.final.map((seat) => ({ ...seat })) };
      else if (this.finishedSeats?.round !== s.round)
        this.finishedSeats = { round: s.round, seats: s.seats.map((seat) => ({ ...seat })) };
    }
    clearTimeout(this.cpuTimer);
    const session = this.hostSession;
    if (session && this.active) {
      // A request still open when a match starts can no longer be approved.
      if (!session.joinOpen)
        for (const peer of [...session.pending.keys()])
          if (session.pending.has(peer)) this.decline(peer);
      this.syncListing();
    }
    if (
      this.active &&
      this.foreground &&
      session &&
      session.state !== null &&
      session.synchronized &&
      !session.closed &&
      session.seats[this.game.turn(session.state)]?.control === 'cpu' &&
      !this.game.finished(session.state)
    )
      this.cpuTimer = setTimeout(() => session.cpuStep(), 450);
    this.recordHistory();
    this.changed();
  }
  private recordHistory(ended = false) {
    const s = this.snapshot;
    if (!s || s.state === null || s.round < 1 || !isLudoState(s.state)) return;
    const result = ludoResult(s.state);
    // A finished round is history: a later leave or CPU switch must not rename its players.
    const seats =
      result && this.finishedSeats?.round === s.round ? this.finishedSeats.seats : s.seats;
    const round = {
      round: s.round,
      names: seats.map((p, i) => (p.control === 'cpu' ? `CPU ${i + 1}` : p.name)),
      scores: result?.scores ?? [0, 0, 0, 0],
      winner: result?.winner ?? null,
      finished: result !== null,
    };
    const signature = JSON.stringify([round, ended]);
    if (signature === this.savedSignature) return;
    this.savedSignature = signature;
    this.savedGroup ??= {
      id: randomId(),
      at: Date.now(),
      roomName: s.title,
      transport: this.setup.transport,
      rounds: [],
    };
    const index = this.savedGroup.rounds.findIndex((r) => r.round === s.round);
    if (index < 0) this.savedGroup.rounds.push(round);
    else this.savedGroup.rounds[index] = round;
    if (ended) this.savedGroup.endedAt = Date.now();
    void saveGroup(this.savedGroup, this.plugin).catch(() => {
      this.storageFailed = true;
      this.changed();
    });
  }
  private drop(peer: string, disconnect = true) {
    const link = this.links.get(peer);
    if (!link) return;
    clearTimeout(link.timer);
    link.channel.close();
    this.links.delete(peer);
    this.codes.delete(peer);
    this.participants.delete(peer);
    if (disconnect) void this.plugin.disconnect?.({ peerId: peer }).catch(() => undefined);
    if (this.setup.host) this.unlink(peer);
    else this.lost('hostLeft');
  }
  /** Host: recruit only while the session says so. A rejected change is tried again. */
  private syncListing() {
    const session = this.hostSession;
    if (!session || !this.active || this.visible === null) return;
    const visible = session.discoverable;
    if (visible === this.visible) return;
    const previous = this.visible;
    this.visible = visible;
    void this.plugin.setListingVisible?.({ visible }).catch(() => {
      // Native kept the old registration live (Android NSD can refuse to withdraw it).
      if (this.visible !== visible) return;
      this.visible = previous;
      clearTimeout(this.listingTimer);
      this.listingTimer = setTimeout(() => this.syncListing(), 3000);
    });
  }
  private listing() {
    return serializeListing(this.label, this.setup.roomName, this.game.id)!;
  }
  /**
   * The radio link is gone, which is not a leave. A seated guest keeps its seat and looks for
   * the host again; a host restarts its radio and waits for its guests. Anyone not yet in a
   * room has nothing to return to and stops.
   */
  private lost(reason: string) {
    if (!this.active || this.stopping) return;
    if (this.status === 'reconnecting') {
      this.closeLinks();
      this.retry();
      return;
    }
    if (this.setup.host ? !this.hostSession || this.visible === null : !this.resumeKey) {
      void this.stop(reason);
      return;
    }
    this.closeLinks();
    this.permittedRevision = -1;
    this.visible = null;
    this.status = 'reconnecting';
    this.retry();
    this.observe();
  }
  /** Forgets every physical link without ending anything: seats stay held. */
  private closeLinks() {
    for (const [peer, link] of [...this.links]) {
      clearTimeout(link.timer);
      link.channel.close();
      this.links.delete(peer);
      this.codes.delete(peer);
      this.participants.delete(peer);
      this.unlink(peer);
    }
    this.hostVerified = false;
    this.connectingHost = false;
  }
  private retry(delay = 3000) {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    if (!this.active || this.stopping || !this.foreground || this.status !== 'reconnecting') return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.restart();
    }, delay);
  }
  /** One reconnection attempt. Native discovery times out on its own, which retries. */
  private async restart() {
    if (!this.active || this.stopping || !this.foreground || this.restarting) return;
    if (this.status !== 'reconnecting') return;
    this.restarting = true;
    let failed = false;
    try {
      this.closeLinks();
      await this.plugin.stop();
      if (!this.active || this.stopping || this.status !== 'reconnecting') return;
      this.peers = [];
      this.restartFailed = false;
      if (this.setup.host) {
        await this.plugin.start({
          transport: this.setup.transport,
          role: 'advertise',
          label: this.label,
          maxPeers: 3,
          listing: this.listing(),
        });
        if (this.restartFailed) throw new Error('The radio failed while starting');
        if (!this.active || this.stopping) return;
        this.visible = true;
        this.status = 'room';
        this.observe();
      } else
        await this.plugin.start({
          transport: this.setup.transport,
          role: 'browse',
          label: this.label,
          maxPeers: 3,
          resume: true,
        });
      if (this.restartFailed) throw new Error('The radio failed while starting');
    } catch {
      // A radio that is off is a waiting state, not an ended gathering.
      failed = true;
    } finally {
      this.restarting = false;
    }
    if (failed) this.retry();
  }
  stop(reason = 'ended'): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.finish(reason);
    return this.stopping;
  }
  private async finish(reason: string) {
    if (this.active) {
      if (this.hostSession) this.hostSession.end();
      else this.command({ type: 'leave' });
      // This device is done now; only the final notice's drain remains, as in two-player rooms.
      this.status = 'ended';
      this.reason = reason;
      this.changed();
      // send() accepts a native queue, not delivery, and stopping the radio drops that queue.
      // A lost final notice would leave a seat away or keep guests looking for a host that
      // left, so give it the same bounded drain window as two-player rooms.
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.all([...this.links.values()].map((l) => l.outgoing)),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1000);
        }),
      ]);
      clearTimeout(timer);
      if (this.links.size) await new Promise<void>((resolve) => setTimeout(resolve, 750));
    }
    this.active = false;
    this.recordHistory(true);
    clearTimeout(this.cpuTimer);
    clearTimeout(this.searchTimer);
    clearTimeout(this.retryTimer);
    clearTimeout(this.listingTimer);
    for (const link of this.links.values()) {
      clearTimeout(link.timer);
      link.channel.close();
    }
    this.links.clear();
    this.participants.clear();
    this.codes.clear();
    this.seatKeys.clear();
    this.releasedKeys.clear();
    this.resumeKey = null;
    await this.listener?.remove().catch(() => undefined);
    this.listener = null;
    if (owners.get(this.plugin) === this) {
      await this.plugin.stop().catch(() => undefined);
      owners.delete(this.plugin);
    }
    this.status = 'ended';
    this.reason = reason;
    this.changed();
  }
}
