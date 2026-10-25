import { describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION, Session, type Wire } from './session';
import { apply, finished, isMatch, newMatch, turn } from './yacht';
import { CATEGORIES } from '../../../src/games/yacht/game/types';

function pair() {
  const queue: Array<{ target: 'host' | 'guest'; wire: Wire }> = [];
  const sent: Array<{ target: 'host' | 'guest'; wire: Wire }> = [];
  const die = vi.fn(() => 6);
  const send = (target: 'host' | 'guest') => (wire: Wire) => {
    queue.push({ target, wire });
    sent.push({ target, wire });
  };
  const host = new Session({
    name: 'ホスト',
    host: true,
    nonce: 'a'.repeat(32),
    die,
    send: send('guest'),
    changed: () => {},
  });
  const guestDie = vi.fn(() => {
    throw new Error('Guest must never draw dice');
  });
  const guest = new Session({
    name: 'Guest',
    host: false,
    nonce: 'b'.repeat(32),
    die: guestDie,
    send: send('host'),
    changed: () => {},
  });
  const flush = () => {
    let n = 0;
    while (queue.length) {
      if (++n > 100) throw new Error('Protocol loop');
      const { target, wire } = queue.shift()!;
      ({ host, guest })[target].receive(JSON.stringify(wire));
    }
  };
  const deliver = () => {
    const { target, wire } = queue.shift()!;
    ({ host, guest })[target].receive(JSON.stringify(wire));
    return wire;
  };
  const connect = () => {
    host.start();
    guest.start();
    flush();
  };
  const consent = () => {
    connect();
    host.confirm();
    guest.confirm();
    flush();
  };
  const begin = () => {
    consent();
    host.ready();
    guest.ready();
    flush();
  };
  return { host, guest, die, guestDie, queue, sent, deliver, flush, connect, consent, begin };
}

describe('two-peer host-authoritative Yacht PoC', () => {
  it('retains a bounded hello that arrives before the local connected callback', () => {
    const p = pair();
    p.host.start();
    p.flush();
    expect(p.guest.peerName).toBe('');
    p.guest.start();
    p.flush();
    p.host.confirm();
    p.guest.confirm();
    p.flush();
    p.host.ready();
    p.guest.ready();
    p.flush();
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.host.match).toEqual(newMatch(1));
    expect(p.guest.match).toEqual(p.host.match);
  });
  it('bounds buffering before the connection is usable', () => {
    const p = pair();
    p.guest.receive('{}');
    p.guest.receive('{}');
    p.guest.start();
    expect(p.guest.closed).not.toBe('');
    expect(p.sent).toHaveLength(0);
  });
  it('does nothing on creation and requires both confirmations and both Ready operations', () => {
    const p = pair();
    expect(p.sent).toHaveLength(0);
    p.connect();
    expect(p.host.code).toBe(p.guest.code);
    expect(p.host.match).toBeNull();
    p.host.confirm();
    p.flush();
    p.host.ready();
    expect(p.host.match).toBeNull();
    p.guest.confirm();
    p.flush();
    p.guest.ready();
    p.flush();
    expect(p.host.match).toBeNull();
    p.host.ready();
    p.flush();
    expect(p.host.match).toEqual(newMatch(1));
    expect(p.guest.match).toEqual(p.host.match);
  });
  it('completes 24 turns, shares exact scores, preserves holds, limits rolls, and requires mutual rematch readiness', () => {
    const p = pair();
    p.begin();
    for (const category of CATEGORIES)
      for (const actor of [p.host, p.guest]) {
        actor.act({ kind: 'roll' });
        p.flush();
        actor.act({ kind: 'hold', index: 0 });
        p.flush();
        actor.act({ kind: 'roll' });
        p.flush();
        actor.act({ kind: 'roll' });
        p.flush();
        const before = JSON.stringify(p.host.match);
        actor.act({ kind: 'roll' });
        p.flush();
        actor.act({ kind: 'hold', index: 0 });
        p.flush();
        expect(JSON.stringify(p.host.match)).toBe(before);
        actor.act({ kind: 'score', category });
        p.flush();
        expect(isMatch(p.guest.match)).toBe(true);
        expect(p.host.match).toEqual(p.guest.match);
        expect(p.host.closed || p.guest.closed).toBe('');
      }
    expect(finished(p.host.match!)).toBe(true);
    expect(p.host.match!.scores[0]).toEqual([0, 0, 0, 0, 0, 30, 0, 24, 0, 0, 30, 50]);
    expect(p.host.match!.scores[1]).toEqual(p.host.match!.scores[0]);
    expect(p.die).toHaveBeenCalledTimes(24 * 3 * 5);
    expect(p.guestDie).not.toHaveBeenCalled();
    p.guest.ready();
    p.flush();
    expect(p.host.match!.round).toBe(1);
    p.host.ready();
    p.flush();
    expect(p.host.match).toEqual(newMatch(2));
    expect(p.guest.match).toEqual(p.host.match);
  });
  it('requires receipt of the initial state before any host RNG or action', () => {
    const p = pair();
    p.consent();
    p.host.ready();
    p.guest.ready();
    p.deliver(); // host Ready
    p.deliver(); // guest Ready creates the initial state
    expect(p.host.pending).toBe(true);
    expect(p.host.match).toEqual(newMatch(1));
    p.host.act({ kind: 'roll' });
    expect(p.die).not.toHaveBeenCalled();
    expect(p.guest.match).toBeNull();
    p.deliver(); // state received, ACK still in transit
    expect(p.guest.match).toEqual(p.host.match);
    expect(p.host.canAct).toBe(false);
    p.deliver();
    expect(p.host.pending).toBe(false);
    expect(p.host.canAct).toBe(true);
  });
  it('blocks repeated host actions and ignores old ACKs until the exact state is acknowledged', () => {
    const p = pair();
    p.begin();
    const oldAck = p.sent.find(({ wire }) => wire.type === 'state-ack')!.wire;
    p.host.act({ kind: 'roll' });
    const before = structuredClone(p.host.match);
    const sent = p.sent.length;
    p.host.act({ kind: 'roll' });
    p.host.act({ kind: 'hold', index: 0 });
    p.host.act({ kind: 'score', category: 'ones' });
    p.host.ready();
    p.host.receive(JSON.stringify(oldAck));
    p.host.receive(JSON.stringify(oldAck));
    expect(p.host.pending).toBe(true);
    expect(p.host.match).toEqual(before);
    expect(p.host.localReady).toBe(false);
    expect(p.sent).toHaveLength(sent);
    expect(p.die).toHaveBeenCalledTimes(5);
    p.deliver();
    expect(p.host.pending).toBe(true);
    const ack = p.deliver();
    expect(p.host.canAct).toBe(true);
    p.host.receive(JSON.stringify(ack));
    expect(p.host.closed).toBe('');
    p.host.act({ kind: 'hold', index: 0 });
    p.host.receive(JSON.stringify(ack));
    expect(p.host.pending).toBe(true);
    p.flush();
    expect(p.host.pending).toBe(false);
  });
  it('orders the guest state ACK before its next command and bounds duplicate replies', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.flush();
    p.host.act({ kind: 'score', category: 'ones' });
    p.deliver();
    p.guest.act({ kind: 'roll' });
    expect(p.queue.map(({ wire }) => wire.type)).toEqual(['state-ack', 'command']);
    p.deliver();
    const command = p.deliver();
    const before = structuredClone(p.host.match);
    const draws = p.die.mock.calls.length;
    p.host.receive(JSON.stringify(command));
    p.host.receive(JSON.stringify(command));
    expect(p.queue).toHaveLength(1);
    const firstState = p.queue[0]!.wire;
    p.flush();
    p.host.receive(JSON.stringify(command));
    expect(p.host.pending).toBe(false);
    expect(p.queue[0]!.wire.stateSeq).toBe(firstState.stateSeq);
    p.flush();
    expect(p.host.pending || p.guest.pending).toBe(false);
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.host.match).toEqual(before);
    expect(p.guest.match).toEqual(before);
    expect(p.die).toHaveBeenCalledTimes(draws);
    // A duplicate may arrive while the guest's next command is already in transit.
    p.guest.act({ kind: 'hold', index: 0 });
    p.host.receive(JSON.stringify(command));
    p.flush();
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.host.pending || p.guest.pending).toBe(false);
    expect(p.host.match!.held[0]).toBe(true);
    expect(p.guest.match).toEqual(p.host.match);
    expect(p.die).toHaveBeenCalledTimes(draws);
  });
  it('keeps the final result and rematch unconfirmed until its ACK arrives', () => {
    const p = pair();
    p.begin();
    for (const category of CATEGORIES)
      for (const actor of [p.host, p.guest]) {
        actor.act({ kind: 'roll' });
        p.flush();
        actor.act({ kind: 'score', category });
        if (category !== 'yacht' || actor === p.host) p.flush();
      }
    p.deliver(); // last guest command
    expect(finished(p.host.match!)).toBe(true);
    expect(p.host.matchComplete).toBe(false);
    expect(p.host.pending).toBe(true);
    p.host.ready();
    expect(p.host.localReady).toBe(false);
    p.deliver(); // final state
    p.guest.ready();
    expect(p.queue.map(({ wire }) => wire.type)).toEqual(['state-ack', 'ready']);
    p.host.ready();
    expect(p.host.match!.round).toBe(1);
    expect(p.host.localReady).toBe(false);
    p.deliver(); // ACK
    expect(p.host.matchComplete).toBe(true);
    p.host.ready();
    p.flush();
    expect(p.host.match).toEqual(newMatch(2));
    expect(p.guest.match).toEqual(p.host.match);
    expect(p.host.pending).toBe(false);
  });
  it.each([
    { stateSeq: 0, round: 1, revision: 1 },
    { stateSeq: 3, round: 1, revision: 1 },
    { stateSeq: 2, round: 2, revision: 1 },
    { stateSeq: 2, round: 1, revision: 0 },
    { stateSeq: 2, round: 1, revision: '1' },
  ])('rejects malformed or mismatched state ACKs (%#)', (fields) => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    const before = structuredClone(p.host.match);
    p.host.receive(
      JSON.stringify({ v: PROTOCOL_VERSION, type: 'state-ack', sid: p.host.sid, ...fields }),
    );
    expect(p.host.closed).not.toBe('');
    expect(p.host.match).toEqual(before);
    expect(p.die).toHaveBeenCalledTimes(5);
  });
  it('rejects an unacknowledged next command and v1 peers explicitly', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.host.receive(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'command',
        sid: p.host.sid,
        round: 1,
        revision: 1,
        seq: 1,
        action: { kind: 'roll' },
      }),
    );
    expect(p.host.closed).toContain('acknowledgement required');
    expect(p.die).toHaveBeenCalledTimes(5);
    const old = pair();
    old.host.start();
    old.host.receive(
      JSON.stringify({ v: 1, type: 'hello', name: 'Old', host: false, nonce: 'b'.repeat(32) }),
    );
    expect(old.host.closed).toBe('Protocol mismatch');
    expect(old.host.peerName).toBe('');
  });
  it('rejects a remote operation on the host turn without consuming RNG or accepting a forged seat', () => {
    const p = pair();
    p.begin();
    const before = structuredClone(p.host.match);
    p.host.receive(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'command',
        sid: p.host.sid,
        round: 1,
        revision: 0,
        seq: 1,
        seat: 0,
        action: { kind: 'roll' },
      }),
    );
    expect(p.host.match).toEqual(before);
    expect(p.die).not.toHaveBeenCalled();
  });
  it('ignores duplicates, stale revisions and commands for a different round', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.flush();
    p.host.act({ kind: 'score', category: 'ones' });
    p.flush();
    p.guest.act({ kind: 'roll' });
    p.flush();
    const command = p.sent.find((m) => m.wire.type === 'command')!.wire;
    const before = structuredClone(p.host.match);
    const draws = p.die.mock.calls.length;
    p.host.receive(JSON.stringify({ ...command, revision: p.host.match!.revision }));
    p.flush();
    expect(p.host.match).toEqual(before);
    expect(p.die).toHaveBeenCalledTimes(draws);
    p.guest.act({ kind: 'roll' });
    const stale = p.queue.shift()!.wire;
    p.host.receive(JSON.stringify({ ...stale, revision: command.revision }));
    p.flush();
    p.guest.act({ kind: 'roll' });
    const wrongRound = p.queue.shift()!.wire;
    p.host.receive(JSON.stringify({ ...wrongRound, round: 2 }));
    p.flush();
    expect(p.host.match).toEqual(before);
    expect(p.host.pending || p.guest.pending).toBe(false);
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.die).toHaveBeenCalledTimes(draws);
  });
  it('sends a >MTU ping only on request and accepts one corresponding pong', () => {
    const p = pair();
    p.consent();
    p.guest.ping();
    p.guest.ping();
    p.flush();
    expect(p.guest.pings).toBe(1);
    const pings = p.sent.filter((m) => m.wire.type === 'ping');
    expect(pings).toHaveLength(1);
    expect(new TextEncoder().encode(JSON.stringify(pings[0]!.wire)).length).toBeGreaterThan(1000);
  });
  it('never advances the guest optimistically or continues after disconnect', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.flush();
    p.host.act({ kind: 'score', category: 'ones' });
    p.flush();
    const before = structuredClone(p.guest.match);
    p.guest.act({ kind: 'roll' });
    expect(p.guest.pending).toBe(true);
    expect(p.guest.match).toEqual(before);
    const commands = p.sent.length;
    p.guest.act({ kind: 'roll' });
    expect(p.sent).toHaveLength(commands);
    p.guest.end('Disconnected', false);
    p.flush();
    expect(p.guest.match).toEqual(before);
    expect(p.guest.canAct).toBe(false);
  });
  it.each([
    '{',
    JSON.stringify({ v: 1, type: 'hello' }),
    ' '.repeat(4097),
    JSON.stringify({ v: PROTOCOL_VERSION, type: 'command', sid: 'wrong', seq: 1 }),
    JSON.stringify({
      v: PROTOCOL_VERSION,
      type: 'state',
      sid: 'a'.repeat(32),
      match: newMatch(1),
      ack: 0,
    }),
    JSON.stringify({
      v: PROTOCOL_VERSION,
      type: 'command',
      sid: 'a'.repeat(32),
      round: 1,
      revision: 0,
      seq: 1,
      action: { kind: 'hold', index: 99 },
    }),
  ])('closes on malformed or unauthorized frames without changing host state (%#)', (raw) => {
    const p = pair();
    p.begin();
    const before = structuredClone(p.host.match);
    p.host.receive(raw);
    expect(p.host.closed).not.toBe('');
    expect(p.host.match).toEqual(before);
    expect(p.die).not.toHaveBeenCalled();
  });
  it('refuses a noncomplementary host role and does not auto-confirm', () => {
    const p = pair();
    p.host.start();
    p.host.receive(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'hello',
        host: true,
        name: 'Second host',
        nonce: 'b'.repeat(32),
      }),
    );
    expect(p.host.closed).not.toBe('');
    expect(p.host.localConsent).toBe(false);
  });
  it('rejects invalid, skipped and conflicting guest snapshots', () => {
    for (const match of [
      { ...newMatch(1), dice: [7, 1, 1, 1, 1], revision: 1 },
      { ...newMatch(1), revision: 2 },
      { ...newMatch(1), dice: [2, 2, 2, 2, 2] },
    ]) {
      const p = pair();
      p.begin();
      const before = structuredClone(p.guest.match);
      p.guest.receive(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          type: 'state',
          sid: p.guest.sid,
          match,
          ack: 0,
          stateSeq: 2,
        }),
      );
      expect(p.guest.closed).not.toBe('');
      expect(p.guest.match).toEqual(before);
    }
  });
});

describe('Yacht legal moves', () => {
  it('rejects scoring and holding before the first throw, all-held rolls, and reused categories', () => {
    const die = vi.fn(() => 4);
    let m = newMatch(1);
    expect(apply(m, 0, { kind: 'score', category: 'ones' }, die)).toBeNull();
    expect(apply(m, 0, { kind: 'hold', index: 1 }, die)).toBeNull();
    m = apply(m, 0, { kind: 'roll' }, die)!;
    for (let index = 0; index < 5; index++) m = apply(m, 0, { kind: 'hold', index }, die)!;
    expect(apply(m, 0, { kind: 'roll' }, die)).toBeNull();
    expect(die).toHaveBeenCalledTimes(5);
    m = apply(m, 0, { kind: 'score', category: 'fours' }, die)!;
    expect(m.scores[0][3]).toBe(20);
    expect(turn(m)).toBe(1);
    expect(m.held).toEqual(Array(5).fill(false));
    m = apply(m, 1, { kind: 'roll' }, die)!;
    m = apply(m, 1, { kind: 'score', category: 'ones' }, die)!;
    m = apply(m, 0, { kind: 'roll' }, die)!;
    expect(apply(m, 0, { kind: 'score', category: 'fours' }, die)).toBeNull();
  });
});
