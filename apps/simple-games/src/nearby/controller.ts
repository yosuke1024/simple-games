import type { PluginListenerHandle } from '@capacitor/core';
import { Channel } from './channel';
import {
  blockIdentity,
  loadHistory,
  saveGathering,
  type Gathering,
  type HistoryData,
} from './history';
import {
  nearbyPlugin,
  randomDie,
  randomId,
  type NativeEvent,
  type NearbyPlugin,
  type Transport,
} from './native';
import { Session } from './session';
import { totals } from './yacht';

export interface Setup {
  host: boolean;
  name: string;
  transport: Transport;
  public: boolean;
}
export type EndReason = 'ended' | 'timeout' | 'connectionError' | 'declined' | 'blocked';
// Native plugins are singletons. An old permission/start completion must never
// close a newer gathering. The map also permits independent test devices.
const owners = new WeakMap<NearbyPlugin, NearbyController>();

/** Owns exactly one user-started connection; opening history never instantiates it. */
export class NearbyController {
  state: 'idle' | 'starting' | 'discovering' | 'connecting' | 'room' | 'ended' = 'idle';
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

  constructor(
    readonly setup: Setup,
    private readonly changed: () => void,
    private readonly plugin: NearbyPlugin = nearbyPlugin,
  ) {}

  async start() {
    if (this.state !== 'idle') return;
    this.active = true;
    this.state = 'starting';
    this.changed();
    const old = owners.get(this.plugin);
    if (old && old !== this) await old.stop();
    if (!this.active) return;
    owners.set(this.plugin, this);
    this.label = `${this.setup.public ? 'P' : 'F'}-${randomId().slice(0, 6).toUpperCase()}`;
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
      const channel = await Channel.create(
        this.setup.host,
        async (raw) => {
          if ((!this.active && !this.flushing) || owners.get(this.plugin) !== this) return;
          await this.plugin.send({ data: raw });
        },
        () => {
          if (!this.active) return;
          this.code = this.channel?.code ?? '';
          this.session?.start();
        },
        (raw) => this.session?.receive(raw),
      );
      if (!this.active) {
        channel.close();
        return;
      }
      this.channel = channel;
      this.session = new Session({
        host: this.setup.host,
        name: this.setup.name,
        nonce: randomId(),
        identity: this.data.identity,
        die: randomDie,
        send: (wire) => {
          this.outgoing = channel.send(JSON.stringify(wire));
          void this.outgoing.catch(() => this.stop('connectionError'));
        },
        changed: () => this.observe(),
      });
      const listener = await this.plugin.addListener('nearbyEvent', (event) => {
        if (!this.active) return;
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
        // Keep decrypt + protocol application ordered across asynchronous crypto.
        this.incoming = this.incoming
          .then(() => this.event(event))
          .catch(() => this.stop('connectionError'))
          .finally(() => {
            this.incomingCount--;
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
      await this.stop('connectionError');
    }
  }
  private limit(ms: number) {
    clearTimeout(this.deadline);
    this.deadline = setTimeout(() => {
      void this.stop('timeout');
    }, ms);
  }
  private async event(event: NativeEvent) {
    if (!this.active) return;
    if (event.type === 'peer' && this.state === 'discovering') {
      if (typeof event.id !== 'string' || typeof event.name !== 'string' || event.id.length > 256)
        return;
      // Only labels belonging to this app's discovery service are shown. A label
      // is public metadata, never a password or proof of someone's identity.
      const name = /^[PF]-[A-F0-9]{6}$/.test(event.name) ? event.name : 'Nearby Play';
      if (!this.peers.some((peer) => peer.id === event.id) && this.peers.length < 50)
        this.peers.push({ id: event.id, name });
      this.changed();
    } else if (event.type === 'connected') {
      this.state = 'connecting';
      this.limit(15000);
      await this.channel?.start();
      this.changed();
    } else if (event.type === 'data') {
      await this.channel?.receive(event.data);
    } else if (event.type === 'error') {
      await this.stop('connectionError');
    } else if (event.type === 'disconnected') {
      await this.stop('ended');
    }
  }
  private watch(key: string, pending: boolean) {
    if (pending && !this.timers.has(key))
      this.timers.set(
        key,
        setTimeout(() => {
          void this.stop('timeout');
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
      if (session.paired) {
        clearTimeout(this.deadline);
        this.state = 'room';
      }
      this.watch('state', session.pending);
      this.watch('chat', session.chatPending);
      this.watch('approval', session.approvalPending);
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
        gathering.games.push({ round: match.round, at: now, finished: false, scores: [0, 0] });
      if (session.matchComplete || session.closed) {
        const game = gathering.games.find((g) => g.round === match.round)!;
        game.finished = session.matchComplete;
        game.scores = totals(match) as [number, number];
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
    this.active = false;
    this.flushing = flushRejection;
    this.reason = reason;
    this.state = 'ended';
    clearTimeout(this.deadline);
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.session?.end(reason, false);
    this.capture();
    this.changed();
    if (!flushRejection) this.channel?.close();
    const listener = this.listener;
    this.listener = null;
    this.stopping = (async () => {
      if (flushRejection) {
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
