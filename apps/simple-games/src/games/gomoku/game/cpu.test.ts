/**
 * What the opponent is, and what it is not (docs/GOMOKU_RULES.md §4).
 *
 * The two properties that decide whether this is a game at all are: it takes
 * the five that is there, and it stops yours. Everything else about the
 * search is a matter of degree; those two are not. The rest of the file is
 * about the narrowing that makes any of it fit in the pause — the candidate
 * set — and about the determinism Undo rests on (§5).
 */
import { describe, expect, it } from 'vitest';
import { __test, candidateMoves, chooseCpuMove, evaluate, scoreFor } from './cpu';
import { createRng } from './rng';
import {
  BLACK,
  CENTRE,
  WHITE,
  cellAt,
  colOf,
  emptyBoard,
  rowOf,
  type Board,
  type Difficulty,
  type Piece,
} from './types';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** A board with the given stones down, black first in each list. */
function boardOf(
  black: readonly (readonly [number, number])[],
  white: readonly (readonly [number, number])[] = [],
): Board {
  const cells = emptyBoard().slice() as Piece[];
  for (const [row, col] of black) cells[cellAt(row, col)] = BLACK;
  for (const [row, col] of white) cells[cellAt(row, col)] = WHITE;
  return cells;
}

const chebyshev = (a: number, b: number): number =>
  Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b)));

describe('the opening', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} opens in the centre — there is nowhere else to be`, () => {
      expect(
        chooseCpuMove({
          board: emptyBoard(),
          player: BLACK,
          difficulty,
          seed: 'seed',
          moveCount: 0,
        }),
      ).toBe(CENTRE);
    });
  }
});

describe('the candidate set (§4)', () => {
  it('is only the intersections near a stone', () => {
    const board = boardOf([[7, 7]]);
    const candidates = candidateMoves(board);
    // Two rings around one stone, minus the stone itself.
    expect(candidates).toHaveLength(24);
    expect(candidates.every((cell) => chebyshev(cell, cellAt(7, 7)) <= 2)).toBe(true);
  });

  it('never offers an intersection that already has a stone', () => {
    const board = boardOf(
      [
        [7, 7],
        [7, 8],
      ],
      [[8, 7]],
    );
    expect(candidateMoves(board)).not.toContain(cellAt(7, 8));
    expect(candidateMoves(board)).not.toContain(cellAt(8, 7));
  });

  it('stays inside the board at a corner', () => {
    const board = boardOf([[0, 0]]);
    expect(candidateMoves(board)).toHaveLength(8);
  });

  it('is the centre alone when nothing is down', () => {
    expect(candidateMoves(emptyBoard())).toEqual([CENTRE]);
  });
});

describe('taking the win in front of it', () => {
  // Black has four in a row with both ends open.
  const fourInARow = boardOf(
    [
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ],
    [
      [8, 4],
      [8, 5],
      [8, 6],
      [9, 9],
    ],
  );

  for (const difficulty of ['normal', 'hard'] as const) {
    it(`${difficulty} plays the fifth stone`, () => {
      const cell = chooseCpuMove({
        board: fourInARow,
        player: BLACK,
        difficulty,
        seed: 'seed',
        moveCount: 8,
      });
      expect([cellAt(7, 3), cellAt(7, 8)]).toContain(cell);
    });
  }
});

describe('stopping the win in front of it', () => {
  /**
   * White has four in a row walled at one end by a black stone, so (7,8) is
   * the only intersection that would make it five. Black must take it.
   *
   * The obvious fixture — an *open* four, empty at both ends — is not a test
   * of blocking at all: taking one end leaves the other, so the position is
   * already lost and a CPU that reads far enough correctly spends the move on
   * its own game instead. This one has a right answer.
   */
  const mustBlock = boardOf(
    [
      [7, 3],
      [9, 5],
      [9, 6],
    ],
    [
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ],
  );

  for (const difficulty of ['normal', 'hard'] as const) {
    it(`${difficulty} takes the only intersection that would complete it`, () => {
      const cell = chooseCpuMove({
        board: mustBlock,
        player: BLACK,
        difficulty,
        seed: 'seed',
        moveCount: 7,
      });
      expect(cell).toBe(cellAt(7, 8));
    });
  }
});

describe('the same seed answers the same way', () => {
  const board = boardOf([[7, 7]], [[7, 8]]);

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} is decided by the seed and the move count`, () => {
      const input = { board, player: BLACK, difficulty, seed: 'repeatable', moveCount: 2 } as const;
      expect(chooseCpuMove(input)).toBe(chooseCpuMove(input));
    });
  }

  it('moves on with the counter', () => {
    const answers = new Set(
      Array.from({ length: 8 }, (_, moveCount) =>
        chooseCpuMove({ board, player: BLACK, difficulty: 'easy', seed: 's', moveCount }),
      ),
    );
    expect(answers.size).toBeGreaterThan(1);
  });
});

describe('the evaluation', () => {
  it('prefers an open three to a closed one', () => {
    const open = boardOf([
      [7, 5],
      [7, 6],
      [7, 7],
    ]);
    const closed = boardOf(
      [
        [7, 5],
        [7, 6],
        [7, 7],
      ],
      [[7, 4]],
    );
    expect(scoreFor(open, BLACK)).toBeGreaterThan(scoreFor(closed, BLACK));
  });

  it('prefers an open four to an open three', () => {
    const three = boardOf([
      [7, 5],
      [7, 6],
      [7, 7],
    ]);
    const four = boardOf([
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ]);
    expect(scoreFor(four, BLACK)).toBeGreaterThan(scoreFor(three, BLACK));
  });

  it('counts a run once, from whichever end it starts', () => {
    const one = boardOf([
      [7, 5],
      [7, 6],
      [7, 7],
    ]);
    const mirrored = boardOf([
      [7, 7],
      [7, 8],
      [7, 9],
    ]);
    expect(scoreFor(one, BLACK)).toBe(scoreFor(mirrored, BLACK));
  });

  it('weighs the threats against it slightly heavier than its own', () => {
    // The same three, once as mine and once as theirs. Symmetric would give
    // exactly opposite numbers; defence tips it.
    const mine = boardOf([
      [7, 5],
      [7, 6],
      [7, 7],
    ]);
    const theirs = boardOf(
      [],
      [
        [7, 5],
        [7, 6],
        [7, 7],
      ],
    );
    expect(evaluate(mine, BLACK)).toBeLessThan(-evaluate(theirs, BLACK));
  });
});

describe('a full board', () => {
  it('has no move to make', () => {
    const cells = emptyBoard().map((_, index) => (index % 2 === 0 ? BLACK : WHITE)) as Piece[];
    expect(
      chooseCpuMove({ board: cells, player: BLACK, difficulty: 'hard', seed: 's', moveCount: 225 }),
    ).toBeNull();
  });
});

describe('the running score and its definition agree', () => {
  it('stays equal to a full re-count through a long random game', () => {
    const { createSearch, make, unmake } = __test;
    const state = createSearch(emptyBoard());
    const rng = createRng('score-agreement');
    const played: number[] = [];

    for (let move = 0; move < 60; move++) {
      const open = candidateMoves(state.board);
      const cell = open[Math.floor(rng() * open.length)]!;
      make(state, cell, move % 2 === 0 ? BLACK : WHITE);
      played.push(cell);
      expect(state.black).toBe(scoreFor(state.board, BLACK));
      expect(state.white).toBe(scoreFor(state.board, WHITE));
    }

    // And unwinds exactly: an unmake is not an approximate undo.
    for (let i = played.length - 1; i >= 0; i--) {
      unmake(state, played[i]!);
      expect(state.black).toBe(scoreFor(state.board, BLACK));
      expect(state.white).toBe(scoreFor(state.board, WHITE));
    }
    expect(state.black).toBe(0);
    expect(state.white).toBe(0);
    expect(state.near.every((count) => count === 0)).toBe(true);
  });
});
