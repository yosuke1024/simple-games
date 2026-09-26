/**
 * Golden boards, v1: fixed seeds, exact values.
 *
 * A seed is a promise. Two players on the same daily, and one player before
 * and after an update, must see the same board — and a personal best only
 * means something if the board it was set on still exists. Any change to the
 * rng, to the backbite schedule, to how clues are spread or reduced, to the
 * solver's pruning (which decides what "unique" means) or to the tier ranges
 * that moves a board will fail here, which is the point: changing these
 * values is a decision, not a side effect.
 *
 * **Fix the implementation, not the test.** A saved game holds these values
 * verbatim (§9), so a change to the encoding strands every game in progress,
 * and a change to the boards quietly retires every daily time on record.
 * Number Path is in early release on the web (§9「ベータ中の注意」), so such
 * a change is allowed — but only with the strings regenerated here and the
 * cost to existing players named in the commit message.
 */
import { describe, expect, it } from 'vitest';
import { isSolution } from './engine';
import { encodeNumbers } from './serialize';
import { createDailySession, createDifficultySession, doTap } from './session';

describe('golden puzzles (v1)', () => {
  it('the easy board for its golden seed is unchanged', () => {
    const session = createDifficultySession('easy', 'number-path-easy-golden');
    expect(session.board.width).toBe(5);
    expect(encodeNumbers(session.board)).toEqual([
      [2, 1],
      [3, 2],
      [19, 3],
      [16, 4],
      [20, 5],
      [10, 6],
    ]);
    expect(session.board.walls).toEqual(['h14', 'h7']);
    expect(session.solution).toEqual([
      2, 1, 0, 5, 6, 7, 8, 3, 4, 9, 14, 13, 18, 19, 24, 23, 22, 17, 12, 11, 16, 21, 20, 15, 10,
    ]);
  });

  it('the medium board for its golden seed is unchanged', () => {
    const session = createDifficultySession('medium', 'number-path-medium-golden');
    expect(session.board.width).toBe(6);
    expect(encodeNumbers(session.board)).toEqual([
      [35, 1],
      [7, 2],
      [12, 3],
      [20, 4],
      [34, 5],
    ]);
    expect(session.board.walls).toEqual(['h20', 'h27', 'h6', 'v10', 'v2', 'v24', 'v28']);
    expect(session.solution).toEqual([
      35, 29, 23, 17, 11, 5, 4, 3, 9, 10, 16, 15, 14, 8, 2, 1, 0, 6, 7, 13, 12, 18, 24, 30, 31, 25,
      19, 20, 21, 22, 28, 27, 26, 32, 33, 34,
    ]);
  });

  it('the hard board for its golden seed is unchanged', () => {
    const session = createDifficultySession('hard', 'number-path-hard-golden');
    expect(session.board.width).toBe(7);
    expect(encodeNumbers(session.board)).toEqual([
      [0, 1],
      [39, 2],
      [36, 3],
      [38, 4],
      [22, 5],
    ]);
    expect(session.board.walls).toEqual(['h0', 'h18', 'h30', 'h4', 'h8', 'v25', 'v45']);
    expect(session.solution).toEqual([
      0, 1, 2, 3, 4, 5, 6, 13, 20, 27, 34, 41, 48, 47, 46, 39, 40, 33, 26, 19, 12, 11, 18, 17, 10,
      9, 8, 7, 14, 15, 16, 23, 24, 25, 32, 31, 30, 29, 36, 37, 38, 45, 44, 43, 42, 35, 28, 21, 22,
    ]);
  });

  it('the daily for 2026-09-26 is unchanged', () => {
    const session = createDailySession('2026-09-26');
    expect(session.board.width).toBe(6);
    expect(encodeNumbers(session.board)).toEqual([
      [21, 1],
      [10, 2],
      [0, 3],
      [8, 4],
      [30, 5],
      [13, 6],
    ]);
    expect(session.board.walls).toEqual(['h4', 'v16', 'v25', 'v33']);
    expect(session.solution).toEqual([
      21, 15, 9, 10, 16, 22, 28, 34, 35, 29, 23, 17, 11, 5, 4, 3, 2, 1, 0, 6, 7, 8, 14, 20, 26, 27,
      33, 32, 31, 30, 24, 25, 19, 18, 12, 13,
    ]);
  });

  it('ships boards whose stored solution is a legal road in the first place', () => {
    for (const session of [
      createDifficultySession('easy', 'number-path-easy-golden'),
      createDifficultySession('medium', 'number-path-medium-golden'),
      createDifficultySession('hard', 'number-path-hard-golden'),
      createDailySession('2026-09-26'),
    ]) {
      expect(isSolution(session.board, session.solution), session.seed).toBe(true);
    }
  });
});

/**
 * The save format of §9, v1: the board as a sparse number list and a wall
 * list, the solution and the path as cell lists. Nothing here derives a clue
 * from the board, so there is nothing that can drift between what was
 * written and what is read back.
 */
describe('the saved game format (v1)', () => {
  it('writes what a save holds', () => {
    let session = createDifficultySession('easy', 'number-path-easy-golden');
    session = doTap(session, 1)!;
    session = doTap(session, 0)!;
    expect([...session.path]).toEqual([2, 1, 0]);
    expect(encodeNumbers(session.board).map(([cell]) => cell)).toEqual([2, 3, 19, 16, 20, 10]);
    expect(session.board.walls).toEqual(['h14', 'h7']);
  });
});
