import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  loadProblem,
  puzzleById,
  act,
  createSession,
  crossing,
  MODES,
  PUZZLES,
  solve,
  undo,
  unsafePair,
} from './index';
describe('River Cargo rules', () => {
  it('solves every fixed puzzle optimally without unsafe banks', () => {
    for (const mode of MODES) {
      let s = createSession(mode, 1);
      const solution = solve(mode)!;
      expect(solution).toHaveLength(mode === 'normal' ? 9 : 7);
      for (const cargo of solution) {
        s = act(s, cargo)!;
        expect(unsafePair(PUZZLES[mode], s.mask, s.boat)).toBeNull();
      }
      expect(s.status).toBe('won');
      expect(act(s, 0)).toBeNull();
    }
  });
  it('rejects unsafe departures, overloaded boats, and cargo on the other bank', () => {
    const s = createSession('easy', 0);
    expect(act(s, 1)).toBeNull();
    expect(act(s, 0)).toBeNull();
    expect(act(s, 3)).toBeNull();
    expect(act(s, -1)).toBeNull();
    expect(act(s, 256)).toBeNull();
    const moved = act(s, 2)!;
    expect(act(moved, 1)).toBeNull();
    expect(act(moved, 0)).not.toBeNull();
    expect(undo(moved)).toEqual(s);
  });
  it('can guide every legal reachable position back to the goal', () => {
    for (const mode of MODES) {
      const p = PUZZLES[mode],
        queue = [{ mask: 0, boat: 0 as 0 | 1 }],
        seen = new Set([0]);
      for (let head = 0; head < queue.length; head++) {
        const state = queue[head]!;
        expect(solve(mode, state.mask, state.boat)).not.toBeNull();
        for (let cargo = 0; cargo < 1 << p.cargo.length; cargo++) {
          const next = crossing(p, state.mask, state.boat, cargo);
          if (!next) continue;
          const key = next.mask * 2 + next.boat;
          if (seen.has(key)) continue;
          seen.add(key);
          queue.push(next);
        }
      }
    }
  });
});

const routes = [
  [2, 0, 1, 2, 4, 0, 2],
  [2, 0, 5],
  [6, 2, 1, 0, 10],
  [1, 0, 6, 0, 8],
  [2, 0, 1, 2, 4, 0, 8, 0, 2],
  [3, 2, 6, 2, 10],
  [10, 0, 5, 2, 18],
  [18, 0, 1, 2, 12, 16, 18],
  [18, 0, 5, 2, 40, 16, 18],
  [18, 0, 1, 2, 4, 0, 40, 16, 18],
  [18, 2, 3, 2, 6, 2, 10, 18, 34, 2, 18],
  [18, 2, 6, 2, 10, 18, 17, 16, 34, 2, 66, 2, 18],
];
it('solves all twelve distinct problems using independently checked routes', () => {
  expect(new Set(CATALOG.map((p) => p.id)).size).toBe(12);
  CATALOG.forEach((p, i) => {
    let s = createSession(p.mode, 3, p.id);
    const route = routes[i]!;
    expect(s.par).toBe(route.length);
    expect(solve(p)).toHaveLength(route.length);
    for (const a of route) {
      const before = s;
      s = act(s, a)!;
      expect(s).not.toBeNull();
      expect(unsafePair(p, s.mask, s.boat)).toBeNull();
      if (s.status === 'playing') expect(undo(s)).toEqual(before);
    }
    expect(s.status).toBe('won');
  });
});
it('checks weight, companions and incompatible boat passengers independently of bank safety', () => {
  const weight = puzzleById('easy-4')!;
  expect(loadProblem(weight, 12)).toEqual({ kind: 'weight' });
  expect(crossing(weight, 0, 0, 12)).toBeNull();
  expect(crossing(weight, 0, 0, 6)).not.toBeNull();
  const crew = puzzleById('normal-2')!;
  expect(loadProblem(crew, 0)).toEqual({ kind: 'crew' });
  const moved = crossing(crew, 0, 0, 3)!;
  expect(crossing(crew, moved.mask, moved.boat, 0)).toBeNull();
  expect(crossing(crew, moved.mask, moved.boat, 2)).not.toBeNull();
  const pair = puzzleById('normal-3')!;
  expect(loadProblem(pair, 9)).toEqual({ kind: 'together', pair: [0, 3] });
  expect(crossing(pair, 0, 0, 9)).toBeNull();
});
