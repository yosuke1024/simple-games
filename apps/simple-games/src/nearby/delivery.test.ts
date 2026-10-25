import { describe, expect, it } from 'vitest';
import { Delivery } from './delivery';

function pair() {
  const a: string[] = [],
    b: string[] = [],
    receivedA: unknown[] = [],
    receivedB: unknown[] = [];
  const host = new Delivery((v) => receivedA.push(JSON.parse(v)));
  const guest = new Delivery((v) => receivedB.push(JSON.parse(v)));
  const attach = () => {
    host.attach((v) => a.push(v));
    guest.attach((v) => b.push(v));
  };
  const pump = () => {
    while (a.length || b.length) {
      while (a.length) guest.receive(a.shift()!);
      while (b.length) host.receive(b.shift()!);
    }
  };
  attach();
  pump();
  return { host, guest, a, b, receivedA, receivedB, attach, pump };
}

describe('gathering message continuity', () => {
  it('replays lost commands and receipts without applying an operation twice', () => {
    const p = pair();
    p.host.send({ type: 'roll' });
    p.a.length = 0;
    p.host.detach();
    p.guest.detach();
    p.attach();
    p.pump();
    expect(p.receivedB).toEqual([{ type: 'roll' }]);
    p.guest.send({ type: 'score', score: 30 });
    p.host.receive(p.b.shift()!);
    p.a.length = 0;
    p.host.detach();
    p.guest.detach();
    p.attach();
    p.pump();
    expect(p.receivedA).toEqual([{ type: 'score', score: 30 }]);
    p.host.send({ type: 'next turn' });
    p.pump();
    expect(p.receivedB).toHaveLength(2);
  });
  it('bounds retained messages and rejects fabricated receipts or sequence gaps', () => {
    const p = pair();
    expect(() => p.host.receive('{"delivery":1,"ack":1}')).toThrow();
    expect(() => p.host.receive('{"delivery":1,"ack":0,"seq":2,"message":{}}')).toThrow();
    p.host.detach();
    for (let i = 0; i < 64; i++) p.host.send({ i });
    expect(() => p.host.send({ overflow: true })).toThrow('limit');
  });
});
