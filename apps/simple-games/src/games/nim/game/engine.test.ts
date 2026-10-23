import { describe, expect, it } from 'vitest';
import {
  MODES,
  cpuMove,
  createSession,
  initialHeaps,
  isCpuTurn,
  legalMoves,
  move,
  nimSum,
  parseSession,
  undo,
} from './index';
describe('normal-play Nim', () => {
  it('rejects invalid removals and never mutates a previous decision', () => {
    const start = createSession('hard', 7),
      heaps = [...start.heaps];
    for (const action of [
      { row: -1, count: 1 },
      { row: 4, count: 1 },
      { row: 1, count: 0 },
      { row: 0, count: 99 },
      { row: 0, count: 1.5 },
    ])
      expect(move(start, action)).toBeNull();
    const next = move(start, { row: 0, count: 1 })!;
    expect(next.heaps[0]).toBe(heaps[0]! - 1);
    expect(start.heaps).toEqual(heaps);
    expect(isCpuTurn(next)).toBe(true);
  });
  it('takes the final stone to win and forbids moves after the result', () => {
    let session = createSession('easy', 4);
    while (session.status === 'playing') session = move(session, legalMoves(session.heaps)[0]!)!;
    expect(session.status).toBe(session.moves.length % 2 ? 'won' : 'lost');
    expect(move(session, { row: 0, count: 1 })).toBeNull();
    const previous = undo(session)!;
    expect(previous.status).toBe('playing');
    expect(isCpuTurn(previous)).toBe(false);
  });
  it('undoes both a pending reply and the complete player/CPU turn', () => {
    const initial = createSession('normal', 123);
    const human = move(initial, { row: 1, count: 1 })!;
    expect(undo(human)?.heaps).toEqual(initial.heaps);
    const cpu = move(human, cpuMove(human)!)!;
    expect(undo(cpu)?.heaps).toEqual(initial.heaps);
    expect(undo(initial)).toBeNull();
  });
  it('makes every seeded start winnable, including against a perfect hard CPU', () => {
    for (let seed = 0; seed < 1000; seed++) {
      expect(nimSum(initialHeaps(seed))).not.toBe(0);
      let session = createSession('hard', seed);
      let steps = 0;
      while (session.status === 'playing') {
        const legal = legalMoves(session.heaps);
        const action = isCpuTurn(session)
          ? cpuMove(session)!
          : legal.find((action) => nimSum(move(session, action)!.heaps) === 0)!;
        expect(action).toBeDefined();
        session = move(session, action)!;
        expect(++steps).toBeLessThanOrEqual(32);
      }
      expect(session.status).toBe('won');
    }
  });
  it('keeps CPU replies deterministic and optimal in every nonzero hard position', () => {
    for (const mode of MODES)
      for (let seed = 0; seed < 200; seed++) {
        const session = move(createSession(mode, seed), { row: 0, count: 1 })!;
        const action = cpuMove(session)!;
        expect(cpuMove(session)).toEqual(action);
        expect(legalMoves(session.heaps)).toContainEqual(action);
        if (mode === 'hard' && nimSum(session.heaps))
          expect(nimSum(move(session, action)!.heaps)).toBe(0);
      }
  });
  it('replays saves, retains full undo and refuses corrupt or oversized data', () => {
    const initial = createSession('normal', 77);
    const pending = {
      ...move(initial, { row: 0, count: 2 })!,
      elapsedSeconds: 90,
      resultRecorded: true,
    };
    expect(parseSession(JSON.parse(JSON.stringify(pending)))).toEqual(pending);
    expect(undo(parseSession(pending)!)?.heaps).toEqual(initial.heaps);
    for (const corrupt of [
      null,
      [],
      {},
      { ...pending, seed: -1 },
      { ...pending, mode: 'expert' },
      { ...pending, elapsedSeconds: Infinity },
      { ...pending, moves: Array(10000).fill({ row: 1, count: 1 }) },
      { ...pending, moves: [{ row: 0, count: 999 }] },
    ])
      expect(parseSession(corrupt)).toBeNull();
    expect(parseSession({ ...pending, heaps: [100, 100, 100, 100] })?.heaps).toEqual(pending.heaps);
  });
});
