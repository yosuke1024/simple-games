import { describe, it, expect } from 'vitest';
import { act, createSession, slide, solve, undo, type Board } from './index';
describe('Frost Route rules', () => {
  it('slides to the edge, collecting along the whole route', () => {
    const b: Board = { size: 7, walls: [4], start: 0, exit: 6, gems: [1, 2, 3], par: 0 };
    expect(slide(b, 0, 0, 1)).toEqual({ position: 3, mask: 7, path: [1, 2, 3] });
  });
  it('only wins at a stop on the exit after all crystals', () => {
    const s = createSession('easy', 1);
    s.board = { size: 7, walls: [], start: 0, exit: 3, gems: [1, 2, 3], par: 0 };
    s.position = 0;
    const next = act(s, 1)!;
    expect(next.mask).toBe(7);
    expect(next.status).toBe('playing');
  });
  it('generates reproducible solvable boards in all modes', () => {
    for (const mode of ['easy', 'normal', 'hard'] as const)
      for (let seed = 0; seed < 60; seed++) {
        let s = createSession(mode, seed);
        expect(s).toEqual(createSession(mode, seed));
        const route = solve(s.board)!;
        expect(route.length).toBe(s.board.par);
        expect(route.length).toBeGreaterThan(0);
        for (const dir of route) s = act(s, dir)!;
        expect(s.status).toBe('won');
        expect(s.mask).toBe(7);
      }
  });
  it('undo restores collected crystals as well as the position', () => {
    const s = createSession('easy', 7),
      direction = solve(s.board)![0]!,
      next = act(s, direction)!;
    expect(undo(next)).toEqual(s);
    expect(undo(s)).toBeNull();
    expect(act(s, 7 as 0)).toBeNull();
  });
});
