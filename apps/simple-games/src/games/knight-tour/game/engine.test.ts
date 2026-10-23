import { describe, expect, it } from 'vitest';
import {
  MODES,
  TOURS,
  createSession,
  isKnightMove,
  legalMoves,
  move,
  parseSession,
  random,
  routeFor,
  undo,
} from './index';
describe('Knight’s Tour', () => {
  it('proves every bundled route has every square once and only knight steps', () => {
    for (const size of MODES)
      for (const route of TOURS[size]) {
        expect(route).toHaveLength(size * size);
        expect(new Set(route).size).toBe(size * size);
        expect(Math.min(...route)).toBe(0);
        expect(Math.max(...route)).toBe(size * size - 1);
        for (let i = 1; i < route.length; i++)
          expect(isKnightMove(size, route[i - 1]!, route[i]!)).toBe(true);
      }
  });
  it('transforms seeded starts into proven complete tours with no runtime search', () => {
    for (const size of MODES) {
      const starts = new Set<number>();
      const variants = new Set<string>();
      for (let seed = 0; seed < 512; seed++) {
        const hash = random(seed);
        variants.add(`${hash % 6}:${(hash >>> 8) % 8}:${!!(hash & 0x10000)}`);
        const route = routeFor(size, seed);
        expect(routeFor(size, seed)).toEqual(route);
        starts.add(route[0]!);
        let session = createSession(size, seed);
        for (const cell of route.slice(1)) {
          const next = move(session, cell);
          expect(next).not.toBeNull();
          session = next!;
        }
        expect(session.status).toBe('won');
        expect(session.path).toEqual(route);
        expect(undo(session)?.path).toEqual(route.slice(0, -1));
        expect(undo(session)?.status).toBe('playing');
      }
      expect(starts.size).toBeGreaterThan(4);
      expect(variants.size).toBe(6 * 8 * 2);
    }
  });
  it('rejects repeats, off-board destinations and non-knight jumps', () => {
    const initial = createSession(5, 1),
      first = initial.path[0]!;
    for (const cell of [-1, 25, 2.5, first]) expect(move(initial, cell)).toBeNull();
    expect(undo(initial)).toBeNull();
    const next = move(initial, legalMoves(initial)[0]!)!;
    expect(move(next, first)).toBeNull();
    expect(initial.path).toEqual([first]);
  });
  it('leaves a stuck route reversible rather than forcing a loss', () => {
    let stuck = false;
    for (let seed = 0; seed < 50 && !stuck; seed++) {
      let session = createSession(5, seed);
      while (legalMoves(session).length) session = move(session, legalMoves(session)[0]!)!;
      if (session.status !== 'won') {
        stuck = true;
        expect(session.status).toBe('playing');
        expect(undo(session)).not.toBeNull();
        expect(legalMoves(undo(session)!)).toContain(session.path[session.path.length - 1]);
      }
    }
    expect(stuck).toBe(true);
  });
  it('replays saved paths and rejects forged starts, duplicates and finished records', () => {
    const initial = createSession(6, 44),
      route = routeFor(6, 44);
    const saved = {
      ...initial,
      path: route.slice(0, 17),
      elapsedSeconds: 101,
      resultRecorded: true,
    };
    expect(parseSession(saved)).toEqual(saved);
    for (const corrupt of [
      null,
      {},
      { ...saved, seed: -1 },
      { ...saved, mode: 7 },
      { ...saved, path: [99] },
      { ...saved, path: [route[0], route[0]] },
      { ...saved, path: route },
      { ...saved, path: Array(10000).fill(0) },
      { ...saved, elapsedSeconds: -1 },
    ])
      expect(parseSession(corrupt)).toBeNull();
  });
});
