import {
  apply,
  finished,
  integer,
  isAction,
  isMatch,
  newMatch,
  record,
  turn,
  type Action,
  type Match,
} from './yacht';

export const MAX_FRAME_BYTES = 4096;
const token = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const playerName = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.trim() === v &&
  v.length > 0 &&
  v.length <= 24 &&
  !/[\u0000-\u001f\u007f]/.test(v);
export type Wire = Record<string, unknown> & { v: 1; type: string };
export interface Options {
  host: boolean;
  name: string;
  nonce: string;
  die: () => number;
  send: (message: Wire) => void;
  changed: () => void;
}

/** One foreground, two-peer session; no timers, storage, HTTP or platform dependencies. */
export class Session {
  readonly host: boolean;
  readonly name: string;
  peerName = '';
  code = '';
  sid = '';
  localConsent = false;
  peerConsent = false;
  localReady = false;
  peerReady = false;
  match: Match | null = null;
  pending = false;
  closed = '';
  pings = 0;
  private peerNonce = '';
  private seq = 0;
  private receivedSeq = 0;
  private started = false;
  private earlyFrame: string | null = null;
  private pingId = 0;
  private pendingPing = 0;

  constructor(private readonly options: Options) {
    if (!token(options.nonce) || !playerName(options.name))
      throw new Error('Invalid session identity');
    this.host = options.host;
    this.name = options.name;
  }
  get paired() {
    return this.localConsent && this.peerConsent && !this.closed;
  }
  get canAct() {
    return (
      this.paired &&
      this.match !== null &&
      !finished(this.match) &&
      !this.pending &&
      turn(this.match) === (this.host ? 0 : 1)
    );
  }
  get names() {
    return this.host ? [this.name, this.peerName] : [this.peerName, this.name];
  }
  private send(type: string, fields: Record<string, unknown> = {}) {
    this.options.send({ v: 1, type, sid: this.sid, ...fields });
  }
  private changed() {
    this.options.changed();
  }
  start() {
    if (this.started || this.closed) return;
    this.started = true;
    this.options.send({
      v: 1,
      type: 'hello',
      name: this.name,
      host: this.host,
      nonce: this.options.nonce,
    });
    if (this.earlyFrame !== null) {
      const frame = this.earlyFrame;
      this.earlyFrame = null;
      this.receive(frame);
    }
  }
  confirm() {
    if (!this.peerNonce || this.closed || this.localConsent) return;
    this.localConsent = true;
    this.send('confirm', { nonce: this.options.nonce });
    this.changed();
  }
  ready() {
    if (!this.paired || this.localReady || (this.match && !finished(this.match))) return;
    this.localReady = true;
    this.send('ready', { round: this.match?.round ?? 0 });
    this.tryStart();
    this.changed();
  }
  private tryStart() {
    if (!this.host || !this.paired || !this.localReady || !this.peerReady) return;
    const round = (this.match?.round ?? 0) + 1;
    if (round > 10000) {
      this.end('Round limit');
      return;
    }
    this.match = newMatch(round);
    this.localReady = this.peerReady = false;
    this.publish();
  }
  private publish() {
    this.send('state', { match: this.match, ack: this.receivedSeq });
  }
  act(action: Action) {
    if (!isAction(action) || !this.canAct || !this.match) return;
    if (this.host) {
      const next = apply(this.match, 0, action, this.options.die);
      if (!next) return;
      this.match = next;
      this.publish();
    } else {
      this.pending = true;
      this.send('command', {
        round: this.match.round,
        revision: this.match.revision,
        seq: ++this.seq,
        action,
      });
    }
    this.changed();
  }
  ping() {
    if (!this.paired || this.pendingPing) return;
    this.pendingPing = ++this.pingId;
    // A >MTU frame proves the native frame splitter is being used; never auto-repeat.
    this.send('ping', { id: this.pendingPing, padding: '0123456789'.repeat(100) });
  }
  end(reason = 'Ended locally', notify = true) {
    if (this.closed) return;
    this.closed = reason;
    this.pending = false;
    if (notify && this.sid) this.send('end');
    this.changed();
  }
  receive(raw: string) {
    if (this.closed) return;
    // Native data and connected callbacks can race across the two devices.
    // Retain only one bounded first frame until our transport is usable.
    if (!this.started) {
      if (this.earlyFrame !== null || new TextEncoder().encode(raw).length > MAX_FRAME_BYTES) {
        this.end('Invalid pre-connection data', false);
      } else this.earlyFrame = raw;
      return;
    }
    let v: unknown;
    try {
      if (new TextEncoder().encode(raw).length > MAX_FRAME_BYTES || /[\r\n]/.test(raw))
        throw new Error();
      v = JSON.parse(raw);
    } catch {
      this.end('Malformed frame');
      return;
    }
    if (!record(v) || v.v !== 1 || typeof v.type !== 'string') {
      this.end('Protocol mismatch');
      return;
    }
    if (v.type === 'hello') {
      if (
        this.peerNonce ||
        !token(v.nonce) ||
        v.nonce === this.options.nonce ||
        !playerName(v.name) ||
        typeof v.host !== 'boolean' ||
        v.host === this.host
      ) {
        this.end('Choose one game host and one guest, then reconnect');
        return;
      }
      this.peerNonce = v.nonce;
      this.peerName = v.name;
      this.sid = this.host ? this.options.nonce : this.peerNonce;
      this.code = String(parseInt(this.sid.slice(0, 8), 16) % 1000000).padStart(6, '0');
      this.changed();
      return;
    }
    if (!this.peerNonce || v.sid !== this.sid) {
      this.end('Wrong session');
      return;
    }
    if (v.type === 'end') {
      this.end('Peer ended the session', false);
      return;
    }
    if (v.type === 'confirm') {
      if (v.nonce !== this.peerNonce || this.peerConsent) {
        this.end('Invalid confirmation');
        return;
      }
      this.peerConsent = true;
    } else if (!this.paired) {
      this.end('Both players must confirm first');
      return;
    } else if (v.type === 'ready') {
      if (
        v.round !== (this.match?.round ?? 0) ||
        this.peerReady ||
        (this.match && !finished(this.match))
      ) {
        this.end('Unexpected ready');
        return;
      }
      this.peerReady = true;
      this.tryStart();
    } else if (v.type === 'command' && this.host) {
      if (
        !this.match ||
        !integer(v.seq, 1, 1000000) ||
        !integer(v.revision, 0, 100000) ||
        !integer(v.round, 1, 10000) ||
        !isAction(v.action)
      ) {
        this.end('Invalid command');
        return;
      }
      // Duplicate or late commands never consume RNG or change scores. Reply with current truth.
      if (v.seq <= this.receivedSeq) {
        this.publish();
        return;
      }
      if (v.seq !== this.receivedSeq + 1) {
        this.end('Command sequence gap');
        return;
      }
      this.receivedSeq = v.seq;
      if (v.round === this.match.round && v.revision === this.match.revision) {
        const next = apply(this.match, 1, v.action, this.options.die);
        if (next) this.match = next;
      }
      this.publish();
    } else if (v.type === 'state' && !this.host) {
      if (!isMatch(v.match) || !integer(v.ack, 0, this.seq)) {
        this.end('Invalid state');
        return;
      }
      const incoming = v.match;
      const round = this.match?.round ?? 0;
      if (incoming.round === round + 1) {
        if (
          !this.localReady ||
          !this.peerReady ||
          incoming.revision !== 0 ||
          JSON.stringify(incoming) !== JSON.stringify(newMatch(round + 1))
        ) {
          this.end('Unexpected new match');
          return;
        }
        this.localReady = this.peerReady = false;
      } else if (this.match && incoming.round === round) {
        if (incoming.revision < this.match.revision) return;
        if (
          incoming.revision > this.match.revision + 1 ||
          (incoming.revision === this.match.revision &&
            JSON.stringify(incoming) !== JSON.stringify(this.match))
        ) {
          this.end('State sequence mismatch');
          return;
        }
      } else {
        this.end('Unexpected match');
        return;
      }
      this.match = incoming;
      if (v.ack === this.seq) this.pending = false;
    } else if (
      v.type === 'ping' &&
      integer(v.id, 1, 1000000) &&
      v.padding === '0123456789'.repeat(100)
    ) {
      this.send('pong', { id: v.id });
    } else if (v.type === 'pong' && v.id === this.pendingPing && this.pendingPing > 0) {
      this.pendingPing = 0;
      this.pings++;
    } else {
      this.end('Unexpected message');
      return;
    }
    this.changed();
  }
}
