import type { PluginListenerHandle } from '@capacitor/core';
import { isNearbyGameId, NEARBY_GAME_CODES } from '../app/nearbyGameIds';
import type { GameAdapter, NearbyGameId, Random } from './gameTypes';
import { Channel } from './channel';
import { Delivery } from './delivery';
import {
  blockIdentity,
  loadHistory,
  saveGathering,
  type Gathering,
  type HistoryData,
} from './history';
import {
  nearbyPlugin,
  randomId,
  type NativeEvent,
  type NearbyPlugin,
  type Transport,
} from './native';
import { Session } from './session';

export interface Setup {
  host: boolean;
  chatEnabled: boolean;
  gameId: NearbyGameId;
  name: string;
  transport: Transport;
  public: boolean;
}
export type EndReason = 'ended' | 'timeout' | 'connectionError' | 'declined' | 'blocked';
// Native plugins are singletons. An old permission/start completion must never
// close a newer gathering. The map also permits independent test devices.
const owners = new WeakMap<NearbyPlugin, NearbyController>();
const random: Random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000;

/** Owns exactly one user-started connection; opening history never instantiates it. */
export class NearbyController {
  state: 'idle' | 'starting' | 'discovering' | 'connecting' | 'room' | 'reconnecting' | 'ended' =
    'idle';
  peers: Array<{ id: string; name: string }> = [];
  label = '';
  code = '';
  session: Session | null = null;
  reason: EndReason = 'ended';
  storageFailed = false;
  gathering: Gathering | null = null;
  private data: HistoryData | null = null;
  private active = false;
  private listener: PluginListenerHandle | null = null;
  private channel: Channel | null = null;
  private incoming: Promise<unknown> = Promise.resolve();
  private incomingCount = 0;
  private outgoing: Promise<unknown> = Promise.resolve();
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private saved = '';
  private revision = 0;
  private stopping: Promise<void> | null = null;
  private flushing = false;
  private background = false;
  private connected = false;
  private generation = 0;
  private reconnectKey: CryptoKey | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private restarting = false;
  private authenticated = false;
  private deliveryPending = 0;
  private readonly gameId: NearbyGameId;
  private delivery = new Delivery(
    (plain) => this.session?.receive(plain),
    () => this.observe(),
  );

  constructor(
    readonly setup: Setup,
    private readonly changed: () => void,
    private readonly plugin: NearbyPlugin = nearbyPlugin,
    private readonly adapter?: GameAdapter,
  ) {
    this.gameId = setup.gameId;
  }

  async start() {
    if (this.state !== 'idle') return;
    if (!isNearbyGameId(this.gameId) || (this.adapter?.id ?? 'yacht') !== this.gameId) {
      this.state = 'ended';
      this.reason = 'connectionError';
      this.changed();
      return;
    }
    this.active = true;
    this.state = 'starting';
    this.changed();
    const old = owners.get(this.plugin);
    if (old && old !== this) await old.stop();
    if (!this.active) return;
    owners.set(this.plugin, this);
    this.label = `${this.setup.public ? 'P' : 'F'}-${NEARBY_GAME_CODES[this.gameId]}${randomId().slice(0, 4).toUpperCase()}`;
    this.changed();
    try {
      this.data = await loadHistory(this.plugin);
    } catch {
      this.storageFailed = true;
      await this.stop('connectionError');
      return;
    }
    if (!this.active) return;
    try {
      await this.prepareChannel(false);
      if (!this.active) return;
      this.session = new Session({
        host: this.setup.host,
        chatEnabled: this.setup.chatEnabled,
        adapter: this.adapter,
        name: this.setup.name,
        nonce: randomId(),
        identity: this.data.identity,
        random,
        send: (wire) => this.delivery.send(wire),
        changed: () => this.observe(),
      });
      const listener = await this.plugin.addListener('nearbyEvent', (event) => {
        if (!this.active) return;
        // Lifecycle cannot wait behind a stalled native send/WebCrypto job.
        // Buffered data remains ordered; restored ACK timers get a fresh window.
        if (event.type === 'lifecycle') {
          const generation = this.generation;
          void this.event(event).catch(() => {
            if (generation === this.generation) this.interrupted('connectionError');
          });
          return;
        }
        // Native frame limits also need a bounded JS backlog while WebCrypto
        // is busy. A peer must not retain unbounded event closures in memory.
        if (
          this.incomingCount >= 64 ||
          (event.type === 'data' && (typeof event.data !== 'string' || event.data.length > 4096))
        ) {
          void this.stop('connectionError');
          return;
        }
        this.incomingCount++;
        const generation = this.generation;
        // Keep decrypt + protocol application ordered across asynchronous crypto.
        this.incoming = this.incoming
          .then(() => {
            if (generation === this.generation) return this.event(event);
          })
          .catch(() => {
            if (generation === this.generation) this.interrupted('connectionError');
          })
          .finally(() => {
            if (generation === this.generation) this.incomingCount--;
          });
      });
      if (!this.active) {
        await listener.remove();
        return;
      }
      this.listener = listener;
      this.state = 'discovering';
      this.changed();
      await this.plugin.start({
        transport: this.setup.transport,
        role: this.setup.host ? 'advertise' : 'browse',
        label: this.label,
      });
      if (!this.active) {
        if (owners.get(this.plugin) === this) await this.plugin.stop();
        return;
      }
      // Start completion begins this JS deadline. The OS also bounds native
      // discovery; a delayed first permission response may require a retry.
      if (this.state === 'discovering') this.limit(60000);
    } catch {
      await this.stop('connectionError');
    }
  }
  async connect(peerId: string) {
    if (!this.active || this.setup.host || this.state !== 'discovering') return;
    const peer = this.peers.find((p) => p.id === peerId);
    if (!peer) return;
    this.label = peer.name;
    this.state = 'connecting';
    this.limit(15000);
    this.changed();
    try {
      await this.plugin.connect({ peerId });
    } catch {
      this.interrupted('connectionError');
    }
  }
  private limit(ms: number) {
    clearTimeout(this.deadline);
    this.deadline = setTimeout(() => {
      if (!this.session?.paired && !this.session?.approvalPending && !this.session?.suspended)
        void this.stop('timeout');
      else this.interrupted('timeout');
    }, ms);
  }
  private async prepareChannel(resuming: boolean) {
    const generation = ++this.generation;
    this.incoming = Promise.resolve();
    this.incomingCount = 0;
    this.authenticated = false;
    const channel = await Channel.create(
      this.setup.host,
      async (raw) => {
        if (
          generation !== this.generation ||
          (!this.active && !this.flushing) ||
          owners.get(this.plugin) !== this
        )
          return;
        await this.plugin.send({ data: raw });
      },
      async () => {
        if (!this.active || generation !== this.generation) return;
        if (resuming) {
          if (!this.reconnectKey) throw new Error('Missing continuation key');
          const proof = await channel.resumeProof(this.reconnectKey);
          await channel.send(JSON.stringify({ resume: 1, sid: this.session?.sid, proof }));
        } else {
          this.code = channel.code;
          this.reconnectKey = channel.reconnectKey;
          this.authenticated = true;
          this.attachDelivery(channel, generation);
          this.session?.start();
        }
      },
      async (raw) => {
        if (generation !== this.generation || !this.active) return;
        if (!this.authenticated) {
          const value: unknown = JSON.parse(raw);
          if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('Invalid continuation');
          const v = value as Record<string, unknown>;
          if (
            !resuming ||
            v.resume !== 1 ||
            v.sid !== this.session?.sid ||
            !this.reconnectKey ||
            !(await channel.verifyResume(this.reconnectKey, v.proof))
          )
            throw new Error('Wrong continuation peer');
          if (generation !== this.generation || !this.active) return;
          this.authenticated = true;
          clearTimeout(this.deadline);
          this.attachDelivery(channel, generation);
          this.state = 'connecting';
          this.session?.resume();
          if (!this.session?.paired) this.limit(60000);
          this.observe();
        } else this.delivery.receive(raw);
      },
    );
    if (!this.active || generation !== this.generation) channel.close();
    else this.channel = channel;
  }
  private attachDelivery(channel: Channel, generation: number) {
    this.delivery.attach((plain) => {
      this.outgoing = channel.send(plain);
      void this.outgoing.catch(() => {
        if (generation === this.generation) this.interrupted('connectionError');
      });
    });
  }
  private clearTimers() {
    clearTimeout(this.deadline);
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
  private interrupted(reason: EndReason) {
    if (!this.active) return;
    if (!this.session?.sid || !this.reconnectKey) {
      void this.stop(reason);
      return;
    }
    this.connected = false;
    this.state = 'reconnecting';
    this.clearTimers();
    this.delivery.detach();
    this.channel?.close();
    this.generation++;
    // A native send can remain unresolved after link loss. Old work must not
    // serialize the next generation behind that promise (nor decrement its count).
    this.incoming = Promise.resolve();
    this.incomingCount = 0;
    this.session.suspend();
    this.scheduleRetry();
    this.changed();
  }
  private scheduleRetry(delay = 3000) {
    if (!this.active || this.background || this.retryTimer || this.restarting) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.reconnect();
    }, delay);
  }
  private async reconnect() {
    if (!this.active || this.background || !this.session?.suspended || this.restarting) return;
    this.restarting = true;
    try {
      // Discard fragments/queues from the old physical connection. The logical
      // outbox and nonextractable continuation key remain in this controller.
      await this.plugin.stop();
      if (!this.active || this.background) return;
      await this.prepareChannel(true);
      if (!this.active || this.background) return;
      this.peers = [];
      await this.plugin.start({
        transport: this.setup.transport,
        role: this.setup.host ? 'advertise' : 'browse',
        label: this.label,
        resume: true,
      });
      if (this.active && this.session.suspended) this.limit(60000);
    } catch {
      // A radio that is off is a waiting state, not an ended game.
      if (this.active) this.scheduleRetryAfterAttempt = true;
    } finally {
      this.restarting = false;
      if (this.scheduleRetryAfterAttempt) {
        this.scheduleRetryAfterAttempt = false;
        this.scheduleRetry();
      }
    }
  }
  private scheduleRetryAfterAttempt = false;
  private async event(event: NativeEvent) {
    if (!this.active) return;
    if (event.type === 'lifecycle') {
      this.background = !event.active;
      if (this.background) {
        this.clearTimers();
        clearTimeout(this.retryTimer);
        this.retryTimer = undefined;
      } else if (this.session?.suspended) this.scheduleRetry(0);
      else if (this.session?.paired) {
        this.session.checkConnection();
        this.observe();
      } else this.limit(this.state === 'discovering' ? 60000 : 15000);
      return;
    }
    if (event.type === 'peer' && (this.state === 'discovering' || this.state === 'reconnecting')) {
      if (typeof event.id !== 'string' || typeof event.name !== 'string' || event.id.length > 256)
        return;
      const name = event.name.toUpperCase();
      if (!/^[PF]-[A-F0-9]{6}$/.test(name) || name.slice(2, 4) !== NEARBY_GAME_CODES[this.gameId])
        return;
      if (this.state === 'reconnecting') {
        // Discovery metadata selects a candidate; only its cryptographic proof
        // can resume this gathering, even when another device copies the label.
        if (!this.setup.host && !this.connected && name === this.label) {
          this.connected = true;
          this.limit(15000);
          try {
            await this.plugin.connect({ peerId: event.id });
          } catch {
            this.interrupted('connectionError');
          }
        }
        return;
      }
      if (!this.peers.some((peer) => peer.id === event.id) && this.peers.length < 50)
        this.peers.push({ id: event.id, name });
      this.changed();
    } else if (event.type === 'connected') {
      if (this.authenticated) return;
      this.connected = true;
      if (!this.session?.suspended) this.state = 'connecting';
      this.limit(15000);
      await this.channel?.start();
      this.changed();
    } else if (event.type === 'data') {
      await this.channel?.receive(event.data);
    } else if (event.type === 'error' || event.type === 'disconnected') {
      if (this.restarting) return; // plugin.stop() during a deliberate physical retry
      this.interrupted(event.type === 'error' ? 'connectionError' : 'ended');
    }
  }
  private watch(key: string, pending: boolean) {
    if (pending && !this.timers.has(key))
      this.timers.set(
        key,
        setTimeout(() => {
          this.interrupted('timeout');
        }, 15000),
      );
    else if (!pending) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }
  private observe() {
    const session = this.session;
    if (!session) return;
    if (this.active && this.data?.blocked.includes(session.peerIdentity)) {
      void this.stop('blocked');
      return;
    }
    if (this.active && session.closed) {
      void this.stop(
        session.admission === 'rejected' ? 'declined' : 'ended',
        this.setup.host && session.admission === 'rejected',
      );
      return;
    }
    if (this.active) {
      // Only the first hello transitions to approval waiting. A later changed()
      // must not extend a deadline or a lost ACK could wait forever.
      if (session.peerName && this.revision === 0) {
        this.revision = 1;
        this.limit(60000);
      }
      if (session.paired && !session.suspended) {
        this.reconnectKey ??= this.channel?.reconnectKey ?? null;
        clearTimeout(this.deadline);
        this.state = 'room';
      }
      if (!this.background && !session.suspended) {
        const deliveryPending = this.delivery.pendingSequence;
        if (deliveryPending !== this.deliveryPending) {
          clearTimeout(this.timers.get('delivery'));
          this.timers.delete('delivery');
          this.deliveryPending = deliveryPending;
        }
        this.watch('delivery', session.paired && deliveryPending !== 0);
        this.watch('state', session.pending);
        this.watch('chat', session.chatPending);
        this.watch('approval', session.approvalPending);
      }
    }
    this.capture();
    this.changed();
  }
  private capture() {
    const session = this.session;
    if (!session || (!session.paired && !this.gathering)) return;
    const now = Date.now();
    this.gathering ??= {
      // A peer controls the wire session ID. Reusing it must never replace
      // an earlier local transcript, so storage has its own fresh identity.
      id: randomId(),
      at: now,
      label: this.label,
      transport: this.setup.transport,
      host: this.setup.host,
      names: session.names as [string, string],
      messages: [],
      games: [],
    };
    const gathering = this.gathering;
    const previousTimes = new Map(gathering.messages.map((m) => [m.id, m.at]));
    gathering.messages = session.messages.map((m) => ({
      ...m,
      at: previousTimes.get(m.id) ?? now,
    }));
    if (session.match) {
      const match = session.match;
      const existing = gathering.games.find((g) => g.round === match.round);
      // Store start/end, not every intermediate board or die roll.
      if (!existing)
        gathering.games.push({
          gameId: session.gameId,
          round: match.round,
          at: now,
          finished: false,
          scores: [0, 0],
          winner: null,
        });
      if (session.matchComplete || session.closed) {
        const game = gathering.games.find((g) => g.round === match.round)!;
        game.finished = session.matchComplete;
        game.scores = session.result!.scores;
        game.winner = session.matchComplete ? session.result!.winner : null;
      }
    }
    if (!this.active && gathering.endedAt === undefined) gathering.endedAt = now;
    const serialised = JSON.stringify(gathering);
    if (serialised === this.saved) return;
    this.saved = serialised;
    void saveGathering(gathering, this.plugin).catch(() => {
      this.storageFailed = true;
      this.changed();
    });
  }
  async block() {
    const identity = this.session?.peerIdentity;
    if (!identity) return;
    try {
      await blockIdentity(identity, this.plugin);
    } catch {
      this.storageFailed = true;
      this.changed();
    }
    await this.stop('blocked');
  }
  stop(reason: EndReason = 'ended', flushRejection = false): Promise<void> {
    if (this.stopping) return this.stopping;
    // Invalidate UI/events immediately. End frames are best effort: completion
    // means the local queue accepted them, never proof of peer receipt.
    const flush =
      flushRejection || (!!this.session?.sid && !this.session.closed && !this.session.suspended);
    this.active = false;
    this.flushing = flush;
    this.reason = reason;
    this.state = 'ended';
    this.clearTimers();
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.session?.end(reason, flush && !flushRejection);
    this.capture();
    this.changed();
    if (!flush) this.channel?.close();
    this.reconnectKey = null;
    const listener = this.listener;
    this.listener = null;
    this.stopping = (async () => {
      if (flush) {
        // send() accepts a native queue, not delivery. Give this short control
        // frame a bounded drain window; disconnect remains a valid fallback.
        let timeout: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          this.outgoing.catch(() => undefined),
          new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, 1000);
          }),
        ]);
        clearTimeout(timeout);
        await new Promise<void>((resolve) => setTimeout(resolve, 750));
        this.flushing = false;
        this.channel?.close();
      }
      try {
        if (owners.get(this.plugin) === this) await this.plugin.stop();
      } catch {
        /* Local closure is still final. */
      }
      await listener?.remove();
    })();
    return this.stopping;
  }
}
