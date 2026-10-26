import {
  integer,
  isGameResult,
  record,
  type GameAdapter,
  type GameResult,
  type NearbyMatch,
  type Random,
  type Seat,
} from './gameTypes';
import { adapter as yachtAdapter } from './games/yacht';
import { isAllowedNearbyText } from './contentFilter';

export const MAX_FRAME_BYTES = 4096;
// Leave room for delivery seq/ACK before the channel's 2800-byte plaintext cap.
export const MAX_MESSAGE_BYTES = 2600;
export const PROTOCOL_VERSION = 7;
export const MAX_CHAT_CHARACTERS = 160;
export const MAX_CHAT_MESSAGES = 1000;
const token = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
// eslint-disable-next-line no-control-regex -- Explicitly reject wire control characters, bidi overrides and lone surrogates.
const unsafeText = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ud800-\udfff]/u;
export const isPlayerName = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.trim() === v &&
  v.length > 0 &&
  Array.from(v).length <= 24 &&
  !unsafeText.test(v) &&
  isAllowedNearbyText(v);
export const isRoomName = isPlayerName;
export const isChatText = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.trim().length > 0 &&
  Array.from(v).length <= MAX_CHAT_CHARACTERS &&
  !unsafeText.test(v) &&
  isAllowedNearbyText(v);
export interface ChatMessage {
  id: string;
  sender: 'self' | 'peer';
  text: string;
  status: 'sending' | 'delivered' | 'failed';
}
export type Wire = Record<string, unknown> & { v: typeof PROTOCOL_VERSION; type: string };
export interface Options {
  host: boolean;
  chatEnabled?: boolean;
  name: string;
  roomName?: string;
  nonce: string;
  identity: string;
  adapter?: GameAdapter;
  random?: Random;
  die?: () => number; // Compatibility seam for deterministic Yacht tests.
  send: (message: Wire) => void;
  changed: () => void;
}

/** One resumable, two-peer session; no timers, storage, HTTP or platform dependencies. */
export class Session {
  readonly host: boolean;
  readonly name: string;
  readonly adapter: GameAdapter;
  peerName = '';
  peerIdentity = '';
  sid = '';
  admission: 'pending' | 'approved' | 'rejected' = 'pending';
  gameProposed = false;
  proposedRound = 0;
  messages: ChatMessage[] = [];
  localReady = false;
  peerReady = false;
  match: NearbyMatch | null = null;
  pending = false;
  closed = '';
  suspended = false;
  private peerNonce = '';
  private seq = 0;
  private receivedSeq = 0;
  private stateSeq = 0;
  private acknowledgedStateSeq = 0;
  private stateCommandAck = 0;
  private started = false;
  private earlyFrame: string | null = null;
  private chatSeq = 0;
  private receivedChatSeq = 0;
  private pendingChatSeq = 0;
  private lastReceivedText = '';
  private approvalSent = false;
  private roomChatEnabled: boolean;
  private roomTitle: string;
  private readonly expectedRoomName: string | undefined;
  private fullState: unknown;
  private guestMatch: NearbyMatch | null = null;
  private readonly random: Random;

  constructor(private readonly options: Options) {
    if (!token(options.nonce) || !token(options.identity) || !isPlayerName(options.name))
      throw new Error('Invalid session identity');
    if (
      (options.host && !isRoomName(options.roomName)) ||
      (options.roomName !== undefined && options.roomName !== '' && !isRoomName(options.roomName))
    )
      throw new Error('Invalid room name');
    this.host = options.host;
    this.name = options.name;
    this.adapter = options.adapter ?? yachtAdapter;
    this.random = () => {
      const value = options.random
        ? options.random()
        : options.die
          ? (options.die() - 1) / 6
          : Math.random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid host RNG');
      return value;
    };
    // Only the host chooses the immutable room policy. A guest learns it from
    // the first host hello; its local setup can never enable room chat.
    this.roomChatEnabled = options.host && options.chatEnabled === true;
    this.roomTitle = options.host ? options.roomName! : '';
    this.expectedRoomName = options.host ? undefined : options.roomName || undefined;
  }
  get paired() {
    return !!this.peerNonce && this.admission === 'approved' && !this.closed;
  }
  get gameId() {
    return this.adapter.id;
  }
  get seat(): Seat {
    return this.host ? 0 : 1;
  }
  get result(): GameResult | null {
    return this.match ? this.adapter.result(this.match.state) : null;
  }
  get chatPending() {
    return this.pendingChatSeq !== 0;
  }
  get chatEnabled(): boolean {
    return this.roomChatEnabled;
  }
  get roomName(): string {
    return this.roomTitle;
  }
  get approvalPending() {
    return this.approvalSent && this.admission === 'pending' && !this.closed;
  }
  get canAct() {
    return (
      this.paired &&
      !this.suspended &&
      this.match !== null &&
      !this.adapter.finished(this.match.state) &&
      !this.pending &&
      this.adapter.turn(this.match.state) === this.seat
    );
  }
  get matchComplete() {
    return !!(
      this.match &&
      this.adapter.finished(this.match.state) &&
      (!this.host || this.acknowledgedStateSeq === this.stateSeq)
    );
  }
  get names() {
    return this.host ? [this.name, this.peerName] : [this.peerName, this.name];
  }
  private send(type: string, fields: Record<string, unknown> = {}) {
    const wire: Wire = { v: PROTOCOL_VERSION, type, sid: this.sid, gameId: this.gameId, ...fields };
    if (new TextEncoder().encode(JSON.stringify(wire)).length > MAX_MESSAGE_BYTES)
      throw new Error('Frame limit');
    this.options.send(wire);
  }
  private changed() {
    this.options.changed();
  }
  start() {
    if (this.started || this.closed) return;
    this.started = true;
    this.options.send({
      v: PROTOCOL_VERSION,
      type: 'hello',
      gameId: this.gameId,
      name: this.name,
      host: this.host,
      nonce: this.options.nonce,
      identity: this.options.identity,
      ...(this.host ? { chatEnabled: this.chatEnabled, roomName: this.roomName } : {}),
    });
    if (this.earlyFrame !== null) {
      const frame = this.earlyFrame;
      this.earlyFrame = null;
      this.receive(frame);
    }
  }
  approve() {
    if (
      !this.host ||
      !this.peerNonce ||
      this.closed ||
      this.admission !== 'pending' ||
      this.approvalSent
    )
      return;
    this.approvalSent = true;
    this.send('admission', {
      approved: true,
      chatEnabled: this.chatEnabled,
      roomName: this.roomName,
    });
    this.changed();
  }
  reject() {
    if (
      !this.host ||
      !this.peerNonce ||
      this.closed ||
      this.admission !== 'pending' ||
      this.approvalSent
    )
      return;
    this.admission = 'rejected';
    this.send('admission', {
      approved: false,
      chatEnabled: this.chatEnabled,
      roomName: this.roomName,
    });
    this.end('Admission rejected', false);
  }
  proposeGame() {
    if (
      this.suspended ||
      !this.paired ||
      this.pending ||
      this.gameProposed ||
      (this.match && !this.matchComplete)
    )
      return;
    const round = (this.match?.round ?? 0) + 1;
    if (round > 10000) {
      this.end('Round limit');
      return;
    }
    this.proposedRound = round;
    this.gameProposed = true;
    this.localReady = this.peerReady = false;
    this.send('game-proposal', { round });
    this.changed();
  }
  ready() {
    if (
      this.suspended ||
      !this.paired ||
      !this.gameProposed ||
      this.pending ||
      this.localReady ||
      (this.match && !this.matchComplete)
    )
      return;
    this.localReady = true;
    this.send('ready', { round: this.proposedRound });
    this.tryStart();
    this.changed();
  }
  private tryStart() {
    if (
      !this.host ||
      !this.paired ||
      !this.gameProposed ||
      this.pending ||
      !this.localReady ||
      !this.peerReady
    )
      return;
    const round = this.proposedRound;
    if (round > 10000) {
      this.end('Round limit');
      return;
    }
    try {
      if (!this.setFullState(this.adapter.create(this.random), round, 0)) return;
    } catch {
      this.end('Invalid game state');
      return;
    }
    this.gameProposed = false;
    this.localReady = this.peerReady = false;
    this.publish();
  }
  private publish() {
    if (!this.guestMatch || this.pending) return;
    if (this.stateSeq >= 1000000) {
      this.end('State sequence limit');
      return;
    }
    // Native send acceptance is not proof that the peer received this snapshot.
    this.pending = true;
    this.send('state', {
      match: this.guestMatch,
      ack: this.receivedSeq,
      stateSeq: ++this.stateSeq,
    });
  }
  private setFullState(full: unknown, round: number, revision: number): boolean {
    // Clone projections even when a public-information adapter returns full
    // directly. UI state and transmitted snapshots must not alias host secrets.
    const projection = (seat: Seat): NearbyMatch => ({
      gameId: this.gameId,
      round,
      revision,
      state: JSON.parse(JSON.stringify(this.adapter.project(full, seat))),
    });
    try {
      const local = projection(0),
        guest = projection(1);
      if (!this.validMatch(local) || !this.validMatch(guest)) throw new Error('Invalid projection');
      if (
        this.adapter.turn(local.state) !== this.adapter.turn(guest.state) ||
        JSON.stringify(this.adapter.result(local.state)) !==
          JSON.stringify(this.adapter.result(guest.state))
      )
        throw new Error('Inconsistent projection');
      const frame = {
        v: PROTOCOL_VERSION,
        type: 'state',
        sid: this.sid,
        gameId: this.gameId,
        match: guest,
        ack: 1000000,
        stateSeq: 1000000,
      };
      if (new TextEncoder().encode(JSON.stringify(frame)).length > MAX_MESSAGE_BYTES)
        throw new Error('Projection limit');
      this.fullState = full;
      this.match = local;
      this.guestMatch = guest;
      return true;
    } catch {
      this.end('Invalid game state');
      return false;
    }
  }
  private validMatch(value: unknown): value is NearbyMatch {
    try {
      if (!(
        record(value) &&
        value.gameId === this.gameId &&
        Object.keys(value).length === 4 &&
        integer(value.round, 1, 10000) &&
        integer(value.revision, 0, 100000) &&
        this.adapter.isView(value.state)
      ))
        return false;
      const result = this.adapter.result(value.state);
      const finished = this.adapter.finished(value.state);
      return (
        integer(this.adapter.turn(value.state), 0, 1) &&
        typeof finished === 'boolean' &&
        isGameResult(result) &&
        finished === (result.winner !== null)
      );
    } catch {
      return false;
    }
  }
  private applyAction(seat: Seat, action: unknown): boolean {
    if (
      !this.match ||
      this.adapter.finished(this.match.state) ||
      this.adapter.turn(this.match.state) !== seat ||
      this.match.revision >= 100000
    )
      return false;
    try {
      const next = this.adapter.apply(this.fullState, seat, action, this.random);
      return next !== null && this.setFullState(next, this.match.round, this.match.revision + 1);
    } catch {
      this.end('Invalid game state');
      return false;
    }
  }
  act(action: unknown) {
    if (!this.adapter.isAction(action) || !this.canAct || !this.match) return;
    if (this.host) {
      if (!this.applyAction(0, action)) return;
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
  sendChat(text: string): boolean {
    if (
      !this.chatEnabled ||
      this.suspended ||
      !this.paired ||
      this.chatPending ||
      !isChatText(text)
    )
      return false;
    if (this.messages.length >= MAX_CHAT_MESSAGES) {
      this.end('Chat limit');
      return false;
    }
    this.pendingChatSeq = ++this.chatSeq;
    this.messages.push({
      id: this.chatId(this.host, this.chatSeq),
      sender: 'self',
      text,
      status: 'sending',
    });
    this.send('chat', { seq: this.chatSeq, text });
    this.changed();
    return true;
  }
  checkConnection() {
    if (this.paired && !this.suspended) this.send('presence');
  }
  suspend() {
    if (this.closed || this.suspended) return;
    this.suspended = true;
    this.changed();
  }
  resume() {
    if (this.closed || !this.suspended) return;
    this.suspended = false;
    this.changed();
  }
  private chatId(host: boolean, seq: number) {
    return `${this.sid}:${host ? 'h' : 'g'}:${seq}`;
  }
  end(reason = 'Ended locally', notify = true) {
    if (this.closed) return;
    this.closed = reason;
    this.pending = false;
    this.pendingChatSeq = 0;
    for (const message of this.messages)
      if (message.status === 'sending') message.status = 'failed';
    this.localReady = this.peerReady = false;
    this.gameProposed = false;
    this.earlyFrame = null;
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
      if (new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES || /[\r\n]/.test(raw))
        throw new Error();
      v = JSON.parse(raw);
    } catch {
      this.end('Malformed frame');
      return;
    }
    if (!record(v) || v.v !== PROTOCOL_VERSION || typeof v.type !== 'string') {
      this.end('Protocol mismatch');
      return;
    }
    if (v.gameId !== this.gameId) {
      this.end('Wrong game');
      return;
    }
    if (v.type === 'hello') {
      if (
        this.peerNonce ||
        !token(v.nonce) ||
        v.nonce === this.options.nonce ||
        !isPlayerName(v.name) ||
        !token(v.identity) ||
        typeof v.host !== 'boolean' ||
        v.host === this.host
      ) {
        this.end('Choose one game host and one guest, then reconnect');
        return;
      }
      if (
        (v.host && (typeof v.chatEnabled !== 'boolean' || !isRoomName(v.roomName))) ||
        (!v.host && ('chatEnabled' in v || 'roomName' in v))
      ) {
        this.end('Invalid room policy');
        return;
      }
      if (!this.host) {
        if (this.expectedRoomName !== undefined && v.roomName !== this.expectedRoomName) {
          this.end('Room name mismatch');
          return;
        }
        this.roomChatEnabled = v.chatEnabled as boolean;
        this.roomTitle = v.roomName as string;
      }
      this.peerNonce = v.nonce;
      this.peerName = v.name;
      this.peerIdentity = v.identity;
      this.sid = this.host ? this.options.nonce : this.peerNonce;
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
    if (v.type === 'admission' && !this.host) {
      if (this.admission !== 'pending' || typeof v.approved !== 'boolean') {
        this.end('Invalid admission');
        return;
      }
      if (v.chatEnabled !== this.chatEnabled || v.roomName !== this.roomName) {
        this.end('Room policy mismatch');
        return;
      }
      this.admission = v.approved ? 'approved' : 'rejected';
      if (!v.approved) {
        this.end('Admission rejected', false);
        return;
      }
      // Queue receipt before the UI can send chat or accept a proposal.
      this.send('admission-ack', { chatEnabled: this.chatEnabled, roomName: this.roomName });
    } else if (v.type === 'admission-ack' && this.host) {
      if (!this.approvalSent || this.admission !== 'pending') {
        this.end('Invalid admission acknowledgement');
        return;
      }
      if (v.chatEnabled !== this.chatEnabled || v.roomName !== this.roomName) {
        this.end('Room policy mismatch');
        return;
      }
      this.admission = 'approved';
    } else if (!this.paired) {
      this.end('Admission required');
      return;
    } else if (v.type === 'game-proposal') {
      if (
        !integer(v.round, 1, 10000) ||
        v.round !== (this.match?.round ?? 0) + 1 ||
        this.pending ||
        (this.match && !this.matchComplete)
      ) {
        this.end('Unexpected game proposal');
        return;
      }
      // Both players may propose the same round at once. Do not reset a
      // Ready choice already made for that proposal.
      if (this.gameProposed && v.round === this.proposedRound) return;
      this.gameProposed = true;
      this.proposedRound = v.round;
      this.localReady = this.peerReady = false;
    } else if (v.type === 'ready') {
      if (
        !this.gameProposed ||
        v.round !== this.proposedRound ||
        this.pending ||
        this.peerReady ||
        (this.match && !this.matchComplete)
      ) {
        this.end('Unexpected ready');
        return;
      }
      this.peerReady = true;
      this.tryStart();
    } else if (v.type === 'state-ack' && this.host) {
      if (
        !integer(v.stateSeq, 1, this.stateSeq) ||
        !integer(v.round, 1, 10000) ||
        !integer(v.revision, 0, 100000)
      ) {
        this.end('Invalid state acknowledgement');
        return;
      }
      // Old or repeated ACKs cannot release a newer pending state or extend its timer.
      if (v.stateSeq <= this.acknowledgedStateSeq) return;
      if (
        !this.pending ||
        v.stateSeq !== this.stateSeq ||
        v.round !== this.match?.round ||
        v.revision !== this.match.revision
      ) {
        this.end('State acknowledgement mismatch');
        return;
      }
      this.acknowledgedStateSeq = v.stateSeq;
      this.pending = false;
    } else if (v.type === 'command' && this.host) {
      if (
        !this.match ||
        !integer(v.seq, 1, 1000000) ||
        !integer(v.revision, 0, 100000) ||
        !integer(v.round, 1, 10000) ||
        !this.adapter.isAction(v.action)
      ) {
        this.end('Invalid command');
        return;
      }
      // Duplicate or late commands never consume RNG or change scores. Reply with current truth.
      if (v.seq <= this.receivedSeq) {
        // An already acknowledged snapshot stays acknowledged. Starting another ACK
        // wait here could race with the guest's next command already in transit.
        if (!this.pending)
          this.send('state', {
            match: this.guestMatch,
            ack: this.receivedSeq,
            stateSeq: this.stateSeq,
          });
        return;
      }
      if (this.pending) {
        this.end('State acknowledgement required before command');
        return;
      }
      if (v.seq !== this.receivedSeq + 1) {
        this.end('Command sequence gap');
        return;
      }
      this.receivedSeq = v.seq;
      if (v.round === this.match.round && v.revision === this.match.revision) {
        this.applyAction(1, v.action);
        if (this.closed) return;
      }
      this.publish();
    } else if (v.type === 'state' && !this.host) {
      if (
        !this.validMatch(v.match) ||
        !integer(v.ack, 0, this.seq) ||
        !integer(v.stateSeq, 1, 1000000)
      ) {
        this.end('Invalid state');
        return;
      }
      const incoming = v.match;
      if (v.stateSeq < this.stateSeq) return;
      if (
        v.stateSeq > this.stateSeq + 1 ||
        v.ack < this.stateCommandAck ||
        (v.stateSeq === this.stateSeq &&
          (v.ack !== this.stateCommandAck ||
            JSON.stringify(incoming) !== JSON.stringify(this.match)))
      ) {
        this.end('State sequence mismatch');
        return;
      }
      const round = this.match?.round ?? 0;
      if (incoming.round === round + 1) {
        if (
          !this.gameProposed ||
          incoming.round !== this.proposedRound ||
          !this.localReady ||
          !this.peerReady ||
          incoming.revision !== 0
        ) {
          this.end('Unexpected new match');
          return;
        }
        this.localReady = this.peerReady = false;
        this.gameProposed = false;
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
      this.stateSeq = v.stateSeq;
      this.stateCommandAck = v.ack;
      if (v.ack === this.seq) this.pending = false;
      // Enqueue the ACK before changed() can enable a guest command or rematch Ready.
      this.send('state-ack', {
        stateSeq: this.stateSeq,
        round: incoming.round,
        revision: incoming.revision,
      });
    } else if (v.type === 'presence') {
      // A foreground-return probe uses the reliable envelope receipt.
      // No heartbeat, no board mutation, and no UI or history entry.
      return;
    } else if (v.type === 'chat') {
      if (!this.chatEnabled) {
        this.end('Chat disabled');
        return;
      }
      if (!integer(v.seq, 1, MAX_CHAT_MESSAGES) || !isChatText(v.text)) {
        this.end('Invalid chat');
        return;
      }
      if (v.seq <= this.receivedChatSeq) {
        if (v.seq === this.receivedChatSeq && v.text !== this.lastReceivedText) {
          this.end('Conflicting chat');
          return;
        }
        this.send('chat-ack', { seq: v.seq });
        return;
      }
      if (v.seq !== this.receivedChatSeq + 1 || this.messages.length >= MAX_CHAT_MESSAGES) {
        this.end('Chat sequence limit');
        return;
      }
      this.receivedChatSeq = v.seq;
      this.lastReceivedText = v.text;
      this.messages.push({
        id: this.chatId(!this.host, v.seq),
        sender: 'peer',
        text: v.text,
        status: 'delivered',
      });
      this.send('chat-ack', { seq: v.seq });
    } else if (v.type === 'chat-ack') {
      if (!this.chatEnabled) {
        this.end('Chat disabled');
        return;
      }
      if (!integer(v.seq, 1, this.chatSeq)) {
        this.end('Invalid chat acknowledgement');
        return;
      }
      if (v.seq !== this.pendingChatSeq) return;
      const message = this.messages.find((m) => m.id === this.chatId(this.host, v.seq as number));
      if (!message || message.status !== 'sending') {
        this.end('Chat acknowledgement mismatch');
        return;
      }
      message.status = 'delivered';
      this.pendingChatSeq = 0;
    } else {
      this.end('Unexpected message');
      return;
    }
    this.changed();
  }
}
