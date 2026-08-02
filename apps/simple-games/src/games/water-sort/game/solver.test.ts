/**
 * The solver's contract (docs/WATER_SORT_RULES.md §5, §8): 'solved' comes
 * with a replayable proof, 'unsolvable' is exact, and the Hint move keeps the
 * board winnable.
 */
import { describe, expect, it } from 'vitest';
import { applyPour, isSolved } from './engine';
import { generatePuzzle } from './generator';
import { findWinningPour, solve } from './solver';
import type { Tubes } from './types';

/** Plays a move list from a position; throws on an illegal move. */
function play(tubes: Tubes, moves: readonly { from: number; to: number }[]): Tubes {
  let current = tubes;
  for (const move of moves) {
    const result = applyPour(current, move.from, move.to);
    if (!result) throw new Error(`illegal move ${move.from}->${move.to}`);
    current = result.tubes;
  }
  return current;
}

describe('solve', () => {
  it('returns a replayable solution for a generated board', () => {
    for (const colors of [3, 6, 9]) {
      const puzzle = generatePuzzle(`solver-replay-${colors}`, colors, 0.5);
      const result = solve(puzzle.tubes);
      expect(result.status).toBe('solved');
      if (result.status === 'solved') {
        expect(isSolved(play(puzzle.tubes, result.moves))).toBe(true);
      }
    }
  });

  it('recognises a solved board immediately', () => {
    const result = solve([[0, 0, 0, 0], [1, 1, 1, 1], [], []]);
    expect(result).toEqual({ status: 'solved', moves: [] });
  });

  it('proves a dead end unsolvable (§8)', () => {
    // Two colors interleaved in full tubes with no room anywhere: nothing can
    // legally pour, and the board is not sorted.
    const stuck: Tubes = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ];
    expect(solve(stuck)).toEqual({ status: 'unsolvable' });
  });

  it('reports capped, not unsolvable, when the budget runs out', () => {
    const puzzle = generatePuzzle('solver-cap', 9, 0.5);
    expect(solve(puzzle.tubes, 1).status).toBe('capped');
  });
});

describe('findWinningPour', () => {
  it('returns a move that keeps the board solvable (§8)', () => {
    const puzzle = generatePuzzle('solver-hint', 7, 0.5);
    const hint = findWinningPour(puzzle.tubes);
    expect(hint).not.toBeNull();
    const after = applyPour(puzzle.tubes, hint!.from, hint!.to);
    expect(after).not.toBeNull();
    expect(solve(after!.tubes).status).toBe('solved');
  });

  it('returns null from a proven dead end', () => {
    const stuck: Tubes = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ];
    expect(findWinningPour(stuck)).toBeNull();
  });
});
