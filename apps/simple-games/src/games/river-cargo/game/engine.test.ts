import { describe, expect, it } from 'vitest';
import { act, createSession, crossing, MODES, PUZZLES, solve, undo, unsafePair } from './index';
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
