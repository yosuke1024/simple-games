/**
 * Golden boards: one per difficulty and one daily, pinned exactly
 * (docs/SUDOKU_6X6_RULES.md §7「同じ seed なら、必ず同じ盤面になる」).
 *
 * A seed is a promise. A retried board, a saved board and the daily everyone
 * plays on one date must stay the board they were — and a best time only
 * means something if the board it was set on still exists. Any change to the
 * rng, the dig order, or the technique set that moves a board fails here,
 * which is the point: changing these strings is a decision, not a side effect.
 */
import { describe, expect, it } from 'vitest';
import { gridToString } from './generator';
import { createDailySession, createDifficultySession } from './session';

describe('golden puzzles', () => {
  it.each([
    ['easy', '.2.5...61.2...524..463...5.13...3.5.', '324561561423135246246315652134413652'],
    ['medium', '2..4.55...3..4........6..3...11.2..3', '263415514236641352325164436521152643'],
    ['hard', '..6......2...6....5..4.3..5.3..1....', '256314134256463521521463645132312645'],
  ] as const)('sudoku-6x6-%s-golden is unchanged', (difficulty, givens, solution) => {
    const session = createDifficultySession(difficulty, `sudoku-6x6-${difficulty}-golden`);
    expect(gridToString(session.board.givens)).toBe(givens);
    expect(gridToString(session.solution)).toBe(solution);
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.difficulty).toBe('medium');
    expect(gridToString(session.board.givens)).toBe('....6..653....2.3113.2....612..1....');
    expect(gridToString(session.solution)).toBe('321564465312652431134256546123213645');
  });
});
