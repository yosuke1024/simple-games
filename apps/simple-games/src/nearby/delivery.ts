import { integer, record } from './yacht';

/** A bounded, in-memory outbox for one approved gathering. Physical reconnects
 * use new encryption keys, but replay the same logical messages exactly once. */
export class Delivery {
  private sent = 0;
  private received = 0;
  private acknowledged = 0;
  private outbox = new Map<number, unknown>();
  private transport: ((plain: string) => void) | null = null;

  constructor(
    private readonly message: (plain: string) => void,
    private readonly changed: () => void = () => {},
  ) {}
  get pendingSequence(): number {
    return this.outbox.keys().next().value ?? 0;
  }

  attach(transport: (plain: string) => void) {
    this.transport = transport;
    // The peer may have applied a message whose receipt was lost.
    this.ack();
    for (const [seq, message] of this.outbox) this.transmit(seq, message);
  }
  detach() {
    this.transport = null;
  }
  send(message: unknown) {
    if (this.outbox.size >= 64 || this.sent >= 1000000) throw new Error('Delivery limit');
    const seq = ++this.sent;
    this.outbox.set(seq, message);
    this.transmit(seq, message);
    this.changed();
  }
  private transmit(seq: number, message: unknown) {
    this.transport?.(JSON.stringify({ delivery: 1, seq, ack: this.received, message }));
  }
  private ack() {
    this.transport?.(JSON.stringify({ delivery: 1, ack: this.received }));
  }
  receive(raw: string) {
    const v: unknown = JSON.parse(raw);
    if (!record(v) || v.delivery !== 1 || !integer(v.ack, 0, this.sent))
      throw new Error('Invalid delivery acknowledgement');
    if (v.ack > this.acknowledged) {
      this.acknowledged = v.ack;
      for (const seq of this.outbox.keys()) if (seq <= v.ack) this.outbox.delete(seq);
      this.changed();
    }
    if (v.seq === undefined) return;
    if (!integer(v.seq, 1, this.received + 1) || !record(v.message))
      throw new Error('Delivery sequence mismatch');
    if (v.seq === this.received + 1) {
      this.received = v.seq;
      this.message(JSON.stringify(v.message));
    }
    this.ack();
  }
}
