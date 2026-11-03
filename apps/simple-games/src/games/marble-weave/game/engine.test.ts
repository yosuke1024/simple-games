import { describe, expect, it } from 'vitest';
import { act, createSession, lines, undo, PUZZLES } from './index';
describe('Marble Weave all-clear puzzles', () => {
  it.each(PUZZLES)(
    '$id has a complete solution in its move limit, without random additions',
    (p) => {
      let s = createSession(p.mode, 0, p.id);
      expect(
        lines(
          s.board,
          s.board.map((_, i) => i),
          p.size,
          p.target,
        ),
      ).toEqual([]);
      expect(p.solution.length).toBe(p.moveLimit);
      expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(12);
      for (const a of p.solution) {
        const before = s.board.filter(Boolean).length;
        s = act(s, a)!;
        expect(s).not.toBeNull();
        expect(s.board.filter(Boolean).length).toBe(before - s.cleared.length);
        expect(s.next).toEqual([]);
        expect(s.spawned).toEqual([]);
      }
      expect(s.status).toBe('won');
      expect(s.actions).toHaveLength(p.moveLimit);
      expect(act(s, p.solution[0]!)).toBeNull();
    },
  );
  it('requires a setup move on every normal and hard puzzle', () => {
    for (const p of PUZZLES.filter((p) => p.mode !== 'easy')) {
      let s = createSession(p.mode, 0, p.id);
      const counts: number[] = [];
      for (const a of p.solution) {
        s = act(s, a)!;
        counts.push(s.cleared.length);
      }
      expect(counts).toContain(0);
    }
  });
  it('keeps an exhausted attempt available for undo, with no extra moves or balls', () => {
    const initial = createSession('easy', 0, 'easy-1');
    const from = initial.board.findIndex(Boolean);
    const to = initial.board.findIndex((n) => !n);
    const a = act(initial, { from, to })!;
    const b = act(a, { from: to, to: from })!;
    expect(b.board).toEqual(initial.board);
    expect(b.status).toBe('playing');
    expect(b.actions).toHaveLength(2);
    expect(act(b, { from, to })).toBeNull();
    expect(undo(b)).toEqual(a);
    expect(undo(a)).toEqual(initial);
  });
  it('uses fixed puzzle identity across seeds and rejects an unknown or mismatched identity', () => {
    expect(createSession('hard', 0, 'hard-4').board).toEqual(
      createSession('hard', 999, 'hard-4').board,
    );
    expect(() => createSession('easy', 0, 'unknown')).toThrow();
    expect(() => createSession('easy', 0, 'hard-1')).toThrow();
    const s = createSession('easy', 0);
    for (const action of [
      { from: -1, to: 0 },
      { from: 0, to: 99 },
      { from: 1.5, to: 0 },
      { from: 0, to: 0 },
    ])
      expect(act(s, action)).toBeNull();
  });
});
