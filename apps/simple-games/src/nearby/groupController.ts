import type { PluginListenerHandle } from '@capacitor/core';
import { Channel } from './channel';
import { parseListing, serializeListing, type DiscoveredPeer } from './discovery';
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
  capacity: NEARBY_CAPACITY.ludo,
  create: () => createLudo(random),
  valid: isLudoState,
  turn: (s) => (isLudoState(s) ? s.turn : -1),
  finished: (s) => isLudoState(s) && ludoResult(s) !== null,
  apply: (s, seat, action) => (isLudoState(s) ? applyLudo(s, seat, action, random) : null),
  cpu: (s) => (isLudoState(s) ? ludoCpuAction(s) : null),
};

/** A host and up to three individually encrypted links. No host migration. */
export class GroupController {
  status: 'idle' | 'searching' | 'connecting' | 'room' | 'ended' = 'idle';
  reason = '';
  storageFailed = false;
  peers: DiscoveredPeer[] = [];
  hostSession: GroupSession | null = null;
  snapshot: GroupSnapshot | null = null;
  readonly codes = new Map<string, string>();
  readonly participants = new Map<string, { name: string; identity: string }>();
  private links = new Map<string, Link>();
  private listener: PluginListenerHandle | null = null;
  private active = false;
  private foreground = true;
  private incoming = Promise.resolve();
  private incomingCount = 0;
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
    this.label = `P-8E${randomId().slice(0, 4).toUpperCase()}`;
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
        if (++this.incomingCount > 64) {
          void this.stop('connection');
          return;
        }
        this.incoming = this.incoming
          .then(async () => {
            if (this.active) await this.event(event);
          })
          .catch(() => {
            if ('peerId' in event && event.peerId && this.setup.host) this.drop(event.peerId);
            else void this.stop('connection');
          })
          .finally(() => {
            this.incomingCount--;
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
        ...(this.setup.host
          ? { listing: serializeListing(this.label, this.setup.roomName, 'ludo')! }
          : {}),
      });
      if (!this.active) {
        if (owners.get(this.plugin) === this) await this.plugin.stop();
        return;
      }
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
    if (event.type === 'peer' && this.status === 'searching') {
      const listing = parseListing(event.listing, event.name);
      if (listing?.gameId !== 'ludo') return;
      this.peers = this.peers.filter((p) => p.id !== event.id);
      if (this.peers.length < 16)
        this.peers.push({
          id: event.id,
          name: event.name,
          gameId: 'ludo',
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
      else await this.stop('hostLeft');
    } else if (event.type === 'error') await this.stop('connection');
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
      () => {
        if (!this.active || this.links.get(peer)?.channel !== channel) return;
        this.codes.set(peer, channel.code);
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
        if (this.links.get(peer)?.channel === channel) this.receive(peer, raw);
      },
    );
    if (!this.active) {
      channel.close();
      return;
    }
    this.links.set(peer, { channel, outgoing: Promise.resolve(), pending: 0, timeout: null });
    this.arm(peer, 15000);
    await channel.start();
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
  private receive(peer: string, raw: string) {
    if (!this.active || new TextEncoder().encode(raw).length > 2800)
      throw new Error('Oversized group message');
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.group !== 1) throw new Error('Invalid group message');
    if (value.type === 'leave') {
      this.drop(peer);
      return;
    }
    if (this.hostSession) {
      if (
        value.type === 'join' &&
        (!isPlayerName(value.name) ||
          !isAllowedNearbyText(value.name) ||
          typeof value.identity !== 'string' ||
          !/^[a-f0-9]{32}$/.test(value.identity) ||
          this.blocked.includes(value.identity))
      ) {
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
        this.blocked.includes(value.identity)
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
      this.hostVerified = true;
      return;
    }
    if (value.type === 'turnReady') {
      if (
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
        (value.room !== this.snapshot.room || value.revision < this.snapshot.revision))
    )
      throw new Error('Invalid room state');
    this.snapshot = value;
    this.permittedRevision = -1;
    this.status = 'room';
    const link = this.links.get(peer);
    if (link) {
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
    this.hostSession?.approve(peer, seat);
  }
  decline(peer: string) {
    this.hostSession?.reject(peer);
    const link = this.links.get(peer);
    void link?.outgoing.finally(() => {
      if (this.links.get(peer) === link) this.drop(peer);
    });
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
    if (this.setup.host) this.drop(peer);
    else void this.stop('blocked');
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
    if (peer && this.snapshot) {
      this.send(peer, { ...value, group: 1, room: this.snapshot.room });
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
    clearTimeout(this.cpuTimer);
    const session = this.hostSession;
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
    const round = {
      round: s.round,
      names: s.seats.map((p, i) => (p.control === 'cpu' ? `CPU ${i + 1}` : p.name)),
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
    if (this.setup.host) this.hostSession?.disconnect(peer);
    else void this.stop('hostLeft');
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
      // Allow the final encrypted notice to leave before stopping the radio.
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.all([...this.links.values()].map((l) => l.outgoing)),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 500);
        }),
      ]);
      clearTimeout(timer);
    }
    this.active = false;
    this.recordHistory(true);
    clearTimeout(this.cpuTimer);
    clearTimeout(this.searchTimer);
    for (const link of this.links.values()) {
      clearTimeout(link.timer);
      link.channel.close();
    }
    this.links.clear();
    this.participants.clear();
    this.codes.clear();
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
