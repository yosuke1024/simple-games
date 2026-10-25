import { describe, expect, it, vi } from 'vitest';
import { defineGame, integer, record, type GameAdapter, type Seat } from './gameTypes';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, Session, type Wire } from './session';

interface Full {
  hands: [string, string];
  deck: string[];
  counter: number;
}
interface View {
  card: string;
  count: number;
  counter: number;
  padding?: string;
}
type Action = { kind: 'move' };
const adapter = defineGame<Full, View, Action>({
  id: 'gin-rummy',
  create: (random) => {
    random();
    return {
      hands: ['HOST-PRIVATE-CARD', 'GUEST-PRIVATE-CARD'],
      deck: ['UNDEALT-CARD'],
      counter: 0,
    };
  },
  project: (full, seat) => ({
    card: full.hands[seat],
    count: full.deck.length,
    counter: full.counter,
  }),
  isView: (value): value is View =>
    record(value) &&
    typeof value.card === 'string' &&
    integer(value.count, 0, 10) &&
    integer(value.counter, 0, 2) &&
    (value.padding === undefined || typeof value.padding === 'string'),
  isAction: (value): value is Action =>
    record(value) && value.kind === 'move' && Object.keys(value).length === 1,
  turn: (view) => (view.counter % 2) as Seat,
  finished: (view) => view.counter === 2,
  apply: (full, seat, _action, random) => {
    if (full.counter === 2 || seat !== full.counter % 2) return null;
    random();
    return { ...full, counter: full.counter + 1 };
  },
  result: (view) => ({ scores: [view.counter, 0], winner: view.counter === 2 ? 0 : null }),
});

function pair(hostAdapter: GameAdapter = adapter, guestAdapter: GameAdapter = adapter) {
  const queue: Array<{ target: 'host' | 'guest'; wire: Wire }> = [];
  const sent: typeof queue = [];
  const random = vi.fn(() => 0.5);
  const guestRandom = vi.fn(() => {
    throw new Error('Guest RNG called');
  });
  const send = (target: 'host' | 'guest') => (wire: Wire) => {
    queue.push({ target, wire });
    sent.push({ target, wire });
  };
  const host = new Session({
    host: true,
    roomName: 'Game 1234',
    name: 'Host',
    nonce: 'a'.repeat(32),
    identity: 'c'.repeat(32),
    adapter: hostAdapter,
    random,
    send: send('guest'),
    changed: () => {},
  });
  const guest = new Session({
    host: false,
    name: 'Guest',
    nonce: 'b'.repeat(32),
    identity: 'd'.repeat(32),
    adapter: guestAdapter,
    random: guestRandom,
    send: send('host'),
    changed: () => {},
  });
  const deliver = () => {
    const frame = queue.shift()!;
    ({ host, guest })[frame.target].receive(JSON.stringify(frame.wire));
    return frame.wire;
  };
  const flush = () => {
    let n = 0;
    while (queue.length) {
      if (++n > 100) throw new Error('Loop');
      deliver();
    }
  };
  const connect = () => {
    host.start();
    guest.start();
    flush();
  };
  const begin = () => {
    connect();
    host.approve();
    flush();
    host.proposeGame();
    flush();
    host.ready();
    guest.ready();
    flush();
  };
  return { host, guest, queue, sent, random, guestRandom, deliver, flush, connect, begin };
}

describe('adapter-independent authority and private projections', () => {
  it('sends only the guest view and resumes the full host state without rerolling or leaking secrets', () => {
    const p = pair();
    p.begin();
    expect(p.host.match?.state).toMatchObject({ card: 'HOST-PRIVATE-CARD', counter: 0 });
    expect(p.guest.match?.state).toMatchObject({ card: 'GUEST-PRIVATE-CARD', counter: 0 });
    expect(p.host.match).not.toEqual(p.guest.match);
    expect(p.random).toHaveBeenCalledTimes(1);
    expect(p.guestRandom).not.toHaveBeenCalled();
    p.host.act({ kind: 'move' });
    p.flush();
    p.host.suspend();
    p.guest.suspend();
    const before = p.host.match;
    p.host.act({ kind: 'move' });
    expect(p.host.match).toBe(before);
    p.host.resume();
    p.guest.resume();
    p.guest.act({ kind: 'move' });
    const command = p.deliver();
    expect(p.host.matchComplete).toBe(false);
    expect(p.host.result).toEqual({ scores: [2, 0], winner: 0 });
    p.host.receive(JSON.stringify(command)); // Replay while state ACK is pending.
    expect(p.random).toHaveBeenCalledTimes(3);
    p.flush();
    expect(p.host.matchComplete && p.guest.matchComplete).toBe(true);
    p.host.receive(JSON.stringify(command)); // Replay after ACK returns the cached guest view.
    p.flush();
    expect(p.random).toHaveBeenCalledTimes(3);
    expect(p.host.result).toEqual(p.guest.result);
    const frames = p.sent
      .filter((frame) => frame.target === 'guest')
      .map(({ wire }) => JSON.stringify(wire));
    expect(frames.join('')).not.toContain('HOST-PRIVATE-CARD');
    expect(frames.join('')).not.toContain('UNDEALT-CARD');
    expect(frames.some((frame) => frame.includes('GUEST-PRIVATE-CARD'))).toBe(true);
    for (const { wire } of p.sent) {
      expect(new TextEncoder().encode(JSON.stringify(wire)).length).toBeLessThanOrEqual(
        MAX_MESSAGE_BYTES,
      );
      expect(
        new TextEncoder().encode(
          JSON.stringify({ delivery: 1, seq: 1000000, ack: 1000000, message: wire }),
        ).length,
      ).toBeLessThanOrEqual(2800);
    }
    p.host.proposeGame();
    p.flush();
    p.host.ready();
    p.guest.ready();
    p.flush();
    expect(p.host.match?.round).toBe(2);
    expect(p.guest.match?.revision).toBe(0);
    expect(p.guest.match?.state).toMatchObject({ counter: 0 });
  });
  it('rejects different selected games before admission and later game-switch attempts', () => {
    const different = pair(adapter, { ...adapter, id: 'nim' });
    different.connect();
    expect(different.host.closed).toBe('Wrong game');
    expect(different.guest.closed).toBe('Wrong game');
    expect(different.host.peerName).toBe('');
    for (const type of ['game-proposal', 'state', 'command']) {
      const p = pair();
      p.begin();
      const before = structuredClone(p.host.match);
      p.host.receive(JSON.stringify({ v: PROTOCOL_VERSION, type, gameId: 'nim', sid: p.host.sid }));
      expect(p.host.closed).toBe('Wrong game');
      expect(p.host.match).toEqual(before);
    }
  });
  it('rejects invalid guest projections and guest-authored state without changing the local board', () => {
    const p = pair();
    p.begin();
    const before = structuredClone(p.guest.match);
    const state = p.sent.find(({ wire }) => wire.type === 'state')!.wire;
    p.guest.receive(
      JSON.stringify({
        ...state,
        stateSeq: 2,
        match: { ...p.guest.match, revision: 1, state: { card: 'x', count: 1, counter: -1 } },
      }),
    );
    expect(p.guest.closed).toBe('Invalid state');
    expect(p.guest.match).toEqual(before);
    const q = pair();
    q.begin();
    const hostBefore = structuredClone(q.host.match);
    q.host.receive(JSON.stringify({ ...state, sid: q.host.sid }));
    expect(q.host.closed).toBe('Unexpected message');
    expect(q.host.match).toEqual(hostBefore);
  });
  it('binds remote commands to seat one, even when a payload claims seat zero', () => {
    const apply = vi.fn(adapter.apply);
    const p = pair({ ...adapter, apply });
    p.begin();
    p.host.receive(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'command',
        gameId: 'gin-rummy',
        sid: p.host.sid,
        seq: 1,
        round: 1,
        revision: 0,
        seat: 0,
        action: { kind: 'move' },
      }),
    );
    expect(apply).not.toHaveBeenCalled();
    expect(p.host.match?.revision).toBe(0);
    expect(p.random).toHaveBeenCalledTimes(1);
  });
  it.each(['oversized', 'inconsistent', 'throwing'] as const)(
    'rejects an %s adapter projection before publishing',
    (kind) => {
      const broken: GameAdapter = {
        ...adapter,
        project: (full, seat) => {
          if (kind === 'throwing') throw new Error('Invalid state');
          const view = adapter.project(full, seat) as View;
          return kind === 'oversized'
            ? { ...view, padding: 'x'.repeat(2600) }
            : { ...view, counter: seat };
        },
      };
      const p = pair(broken);
      p.begin();
      expect(p.host.closed).toBe('Invalid game state');
      expect(p.host.match).toBeNull();
      expect(p.sent.some(({ wire }) => wire.type === 'state')).toBe(false);
    },
  );
});
