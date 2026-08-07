/**
 * What the opponent is, and what it is not (docs/CHECKERS_RULES.md §4).
 *
 * The properties that matter are: it is bound by the rules (easy included),
 * it is decided entirely by the seed and the move count — which is what makes
 * Undo a take-back rather than a reroll (§5) — and it gets stronger with the
 * difficulty rather than luckier.
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuTurn, evaluate } from './cpu';
import { enumerateTurns, legalMoves } from './engine';
import {
  CPU,
  CPU_MAN,
  DRAW_QUIET_PLIES,
  EMPTY,
  PLAYER,
  PLAYER_KING,
  PLAYER_MAN,
  countPieces,
  initialBoard,
  isDarkSquare,
  type Board,
  type Difficulty,
  type Piece,
} from './types';

function boardOf(rows: readonly string[]): Board {
  const cells: Piece[] = [];
  for (const row of rows) {
    for (const character of row) {
      cells.push(
        character === 'p'
          ? PLAYER_MAN
          : character === 'P'
            ? PLAYER_KING
            : character === 'c'
              ? CPU_MAN
              : character === 'C'
                ? (4 as Piece)
                : EMPTY,
      );
    }
  }
  for (let cell = 0; cell < cells.length; cell++) {
    if (cells[cell] !== EMPTY && !isDarkSquare(cell)) {
      throw new Error(`fixture puts a piece on the light square ${cell}`);
    }
  }
  return cells;
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/**
 * The CPU can win a man with one jump, or two men with the other — the
 * second lands on (4,7) and is then forced on over (5,6).
 */
const twoWaysToCapture = boardOf([
  '........',
  '........',
  '.....c..',
  '....p.p.',
  '........',
  '......p.',
  '........',
  '........',
]);

describe('every difficulty obeys the rules', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} plays a turn the rules allow`, () => {
      const legal = enumerateTurns(twoWaysToCapture, CPU);
      const turn = chooseCpuTurn({
        board: twoWaysToCapture,
        side: CPU,
        difficulty,
        seed: 'seed',
        moveCount: 3,
      })!;
      expect(turn).not.toBeNull();
      expect(legal.map((candidate) => JSON.stringify(candidate.steps))).toContain(
        JSON.stringify(turn.steps),
      );
    });

    it(`${difficulty} takes a capture when one exists — even easy`, () => {
      const turn = chooseCpuTurn({
        board: twoWaysToCapture,
        side: CPU,
        difficulty,
        seed: 'seed',
        moveCount: 3,
      })!;
      expect(turn.steps.every((step) => step.captured !== -1)).toBe(true);
    });

    it(`${difficulty} answers the same way to the same seed and move count`, () => {
      const input = {
        board: twoWaysToCapture,
        side: CPU,
        difficulty,
        seed: 'repeatable',
        moveCount: 9,
      } as const;
      expect(chooseCpuTurn(input)!.steps).toEqual(chooseCpuTurn(input)!.steps);
    });
  }

  it('answers differently once the move count has moved on', () => {
    // Not a guarantee about any one position — only that the counter is part
    // of the draw, so a replayed game cannot drift out of step with itself.
    const base = { board: initialBoard(), side: CPU, difficulty: 'easy', seed: 's' } as const;
    const answers = new Set(
      Array.from({ length: 8 }, (_, moveCount) =>
        JSON.stringify(chooseCpuTurn({ ...base, moveCount })!.steps),
      ),
    );
    expect(answers.size).toBeGreaterThan(1);
  });
});

describe('reading further finds more', () => {
  it('normal and hard take the double capture over the single', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const turn = chooseCpuTurn({
        board: twoWaysToCapture,
        side: CPU,
        difficulty,
        seed: 'seed',
        moveCount: 3,
      })!;
      expect(turn.steps).toHaveLength(2);
      expect(countPieces(turn.board).player).toBe(1);
    }
  });

  it('hard finishes the match when the last piece is there to take', () => {
    const oneLeft = boardOf([
      '........',
      '........',
      '.....c..',
      '....p...',
      '........',
      '........',
      '........',
      '........',
    ]);
    const turn = chooseCpuTurn({
      board: oneLeft,
      side: CPU,
      difficulty: 'hard',
      seed: 'seed',
      moveCount: 5,
    })!;
    expect(countPieces(turn.board).player).toBe(0);
  });

  it('normal keeps a man out of a square where it would just be taken', () => {
    // Moving to (4,3) offers the man to (3,2), which would take it and land
    // on (5,4). Going to (4,5) instead is safe: (3,6) is empty.
    const board = boardOf([
      '........',
      '........',
      '.c......',
      '..c.....',
      '........',
      '....p...',
      '........',
      '........',
    ]);
    const turn = chooseCpuTurn({
      board,
      side: PLAYER,
      difficulty: 'normal',
      seed: 'seed',
      moveCount: 4,
    })!;
    expect(turn.steps[0]!.to).toBe(4 * 8 + 5);
  });
});

describe('a side with nothing to play', () => {
  it('gets no turn at all — that is a loss, not a pass', () => {
    const shutIn = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '....c...',
      '.....c.c',
      '......p.',
    ]);
    expect(legalMoves(shutIn, PLAYER)).toHaveLength(0);
    expect(
      chooseCpuTurn({
        board: shutIn,
        side: PLAYER,
        difficulty: 'hard',
        seed: 'seed',
        moveCount: 20,
      }),
    ).toBeNull();
  });
});

describe('the evaluation', () => {
  it('is symmetric: what is good for one side is bad for the other', () => {
    // Deliberately lopsided — from the opening the score is zero either way,
    // which would pass this test without saying anything.
    const board = boardOf([
      '........',
      '........',
      '.....c..',
      '........',
      '........',
      '..P...p.',
      '........',
      '........',
    ]);
    const forPlayer = evaluate(board, PLAYER);
    expect(forPlayer).toBeGreaterThan(0);
    expect(evaluate(board, CPU)).toBe(-forPlayer);
  });

  it('starts level from the opening position', () => {
    expect(evaluate(initialBoard(), PLAYER)).toBe(0);
  });

  it('prefers a king to a man', () => {
    const withMan = boardOf([
      '........',
      '........',
      '.....c..',
      '........',
      '........',
      '..p.....',
      '........',
      '........',
    ]);
    const withKing = boardOf([
      '........',
      '........',
      '.....c..',
      '........',
      '........',
      '..P.....',
      '........',
      '........',
    ]);
    expect(evaluate(withKing, PLAYER)).toBeGreaterThan(evaluate(withMan, PLAYER));
  });
});

describe('the draw is part of the game the search reads (§3)', () => {
  /**
   * Kings only, and the CPU is a whole piece ahead. Every move on this board
   * is a quiet king move, so the counter can only go up.
   */
  const kingsOnly = boardOf([
    '........',
    '..C.....',
    '........',
    '....C...',
    '........',
    '..P.....',
    '........',
    '........',
  ]);

  it('sees a draw one quiet move away, and prices it as a draw', () => {
    // At 49, any move the CPU makes here reaches 50 and ends the match level,
    // throwing away the piece it is up. The search has to be reading that.
    const atTheEdge = chooseCpuTurn({
      board: kingsOnly,
      side: CPU,
      difficulty: 'hard',
      seed: 'draw-edge',
      moveCount: 60,
      quietPlies: DRAW_QUIET_PLIES - 1,
    });
    // It still has to move — a drawn game is not a reason to return nothing.
    expect(atTheEdge).not.toBeNull();
    expect(atTheEdge!.steps).toHaveLength(1);
  });

  it('reads the same position differently depending on the counter', () => {
    // The only thing separating these two calls is how close the draw is. If
    // the counter were not reaching the search, they could not disagree, and
    // this test would be impossible to write.
    const seen = new Set<string>();
    for (const quietPlies of [0, DRAW_QUIET_PLIES - 1]) {
      const turn = chooseCpuTurn({
        board: kingsOnly,
        side: CPU,
        difficulty: 'hard',
        seed: 'draw-compare',
        moveCount: 60,
        quietPlies,
      })!;
      seen.add(JSON.stringify(turn.steps));
    }
    expect(seen.size).toBe(2);
  });

  it('defaults to nought when the caller says nothing, so old calls still read', () => {
    const withDefault = chooseCpuTurn({
      board: kingsOnly,
      side: CPU,
      difficulty: 'hard',
      seed: 'draw-default',
      moveCount: 60,
    })!;
    const explicit = chooseCpuTurn({
      board: kingsOnly,
      side: CPU,
      difficulty: 'hard',
      seed: 'draw-default',
      moveCount: 60,
      quietPlies: 0,
    })!;
    expect(withDefault.steps).toEqual(explicit.steps);
  });
});
