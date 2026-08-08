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
import {
  __test,
  candidateMoves,
  chooseCpuMove,
  evaluate,
  scoreFor,
  type CpuMoveInput,
} from './cpu';
import { createRng } from './rng';
import {
  BLACK,
  CENTRE,
  WHITE,
  cellAt,
  colOf,
  emptyBoard,
  isValidBoard,
  rowOf,
  sideToMove,
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

/**
 * Asks the CPU for a move, having first checked that the question is a fair
 * one: a position play could have reached, and this colour's turn in it.
 *
 * The guard is here because a fixture that fails it got through. The blocking
 * test below used to pose black *three* stones against white four — black
 * opens and the turn never skips, so no game arrives at that (`isValidBoard`,
 * §8) — and an unreachable position let the CPU look like it stopped a five in
 * a situation it can never be in. Every test that asks for a move goes through
 * here, so the next such fixture fails instead of passing quietly.
 */
function cpuMove(input: CpuMoveInput): number | null {
  expect(isValidBoard(input.board)).toBe(true);
  expect(sideToMove(input.board)).toBe(input.player);
  return chooseCpuMove(input);
}

const chebyshev = (a: number, b: number): number =>
  Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b)));

describe('the opening', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} opens in the centre — there is nowhere else to be`, () => {
      expect(
        cpuMove({
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
      const cell = cpuMove({
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

/**
 * White has four in a row walled at one end by a black stone, so (7,8) is the
 * only intersection that would make it five. Black must take it — and black
 * would much rather not, which is the point of this fixture: its own three on
 * row 9 is open at both ends, so (9,4) and (9,8) each build an *open four*,
 * worth six figures to the evaluation against the eight thousand that blocking
 * leaves it with. The position is legal and it is black's turn (four stones
 * each).
 *
 * A CPU that only compares those numbers plays (9,4), and white plays (7,8)
 * and wins. That is exactly what this one did until the search was taught to
 * settle a five before it weighs anything, so read a failure here as "the CPU
 * is choosing by score in a position that does not allow a choice".
 *
 * The obvious fixture — an *open* four, empty at both ends — is not a test of
 * blocking at all: taking one end leaves the other, so the position is already
 * lost. It appears below, where the only thing left to ask of it is that the
 * answer be the same every time.
 */
const mustBlock = boardOf(
  [
    [7, 3],
    [9, 5],
    [9, 6],
    [9, 7],
  ],
  [
    [7, 4],
    [7, 5],
    [7, 6],
    [7, 7],
  ],
);

describe('stopping the win in front of it', () => {
  for (const difficulty of ['normal', 'hard'] as const) {
    it(`${difficulty} takes the only intersection that would complete it`, () => {
      const cell = cpuMove({
        board: mustBlock,
        player: BLACK,
        difficulty,
        seed: 'seed',
        moveCount: 8,
      });
      expect(cell).toBe(cellAt(7, 8));
    });

    // Eight searches, one set of them at `hard`, and the assertion is about the
    // move rather than about how long it took — but vitest's 5s default made
    // the wall clock the judge anyway: this passes alone in a fraction of that
    // and times out under a loaded `pnpm test`, where the other forks compete
    // for the same cores. A gate that fails occasionally is as bad as one that
    // never passes (SUDOKU_RULES.md §7), so the limit sits where it can only
    // catch a real hang.
    it(`${difficulty} blocks whatever the seed`, () => {
      // The tie-break is seeded, and a guarantee that held for one seed and
      // not another would not be a guarantee.
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const cell = cpuMove({ board: mustBlock, player: BLACK, difficulty, seed, moveCount: 8 });
        expect(cell).toBe(cellAt(7, 8));
      }
    }, 60_000);
  }

  /**
   * The same threat, but black can finish first: its own four on row 9 becomes
   * five at (9,3) or (9,8). Taking the game has to outrank stopping theirs —
   * a CPU that blocked here would be answering a threat it had already
   * outrun. Five stones each, so it is still black's turn.
   */
  const winRatherThanBlock = boardOf(
    [
      [7, 3],
      [9, 4],
      [9, 5],
      [9, 6],
      [9, 7],
    ],
    [
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
      [11, 11],
    ],
  );

  for (const difficulty of ['normal', 'hard'] as const) {
    it(`${difficulty} takes its own five rather than block`, () => {
      const cell = cpuMove({
        board: winRatherThanBlock,
        player: BLACK,
        difficulty,
        seed: 'seed',
        moveCount: 10,
      });
      expect([cellAt(9, 3), cellAt(9, 8)]).toContain(cell);
    });
  }

  /**
   * White's four is open at both ends, so black loses whichever end it takes.
   * There is no right answer left to test — only that the CPU still gives the
   * same one for the same seed, because Undo has to be a take-back rather than
   * a reroll (§5) in lost positions too.
   */
  const alreadyLost = boardOf(
    [
      [12, 2],
      [12, 3],
      [0, 0],
      [0, 14],
    ],
    [
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ],
  );

  for (const difficulty of ['normal', 'hard'] as const) {
    it(`${difficulty} answers an unstoppable four the same way every time`, () => {
      for (const seed of ['a', 'b', 'c', 'd']) {
        const input = {
          board: alreadyLost,
          player: BLACK,
          difficulty,
          seed,
          moveCount: 8,
        } as const;
        const cell = cpuMove(input);
        expect(cell).toBe(cpuMove(input));
        expect([cellAt(7, 3), cellAt(7, 8)]).toContain(cell);
      }
    });
  }
});

describe('what a node is willing to look at (§4)', () => {
  const { createSearch, make, collectCandidates, completesFive } = __test;

  /**
   * The position after black answers the fixture above with its own attack
   * instead of the block: white now completes five at (7,8), and it is white's
   * turn.
   *
   * This is where the bug lived, and it was invisible from the outside at
   * depth 1. Interior nodes ranked candidates by how many stones sat within
   * two rings and read the busiest eight; (7,8) ranked *twelfth*. So the
   * search could not see white's win at any depth, which is why it was happy
   * to walk into it.
   */
  const whiteToWin = (() => {
    const state = createSearch(mustBlock);
    make(state, cellAt(9, 4), BLACK);
    return state;
  })();

  const read = (state: ReturnType<typeof createSearch>, toMove: typeof BLACK | typeof WHITE) => {
    const out = new Int32Array(8);
    const count = collectCandidates(state, toMove, out, 8);
    const cells: number[] = [];
    for (let i = 0; i < count; i++) cells.push(out[i]!);
    return cells;
  };

  it('reads its own five and nothing else', () => {
    // Not merely "includes": once a move ends the game, every sibling is a
    // node spent on a position that will not happen. Before this, (7,8) was
    // not even in the list.
    expect(read(whiteToWin, WHITE)).toEqual([cellAt(7, 8)]);
  });

  it('reads the block and nothing else when the five is against it', () => {
    const state = createSearch(mustBlock);
    expect(read(state, BLACK)).toEqual([cellAt(7, 8)]);
  });

  it('prefers its own five to the block, at a node as at the root', () => {
    // Black's attack left it an open four of its own, so with the move it
    // finishes rather than answers — the two rules in order, not one of them.
    expect(read(whiteToWin, BLACK)).toEqual([cellAt(9, 3), cellAt(9, 8)]);
  });

  it('falls back to busyness when nothing is forced', () => {
    const quiet = createSearch(boardOf([[7, 7]], [[7, 8]]));
    const out = new Int32Array(8);
    expect(collectCandidates(quiet, BLACK, out, 8)).toBe(8);
  });

  it('asks about five without placing a stone', () => {
    const board = boardOf([
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ]);
    expect(completesFive(board, cellAt(7, 8), BLACK)).toBe(true);
    expect(completesFive(board, cellAt(7, 8), WHITE)).toBe(false);
    // Four with a gap is still five when the gap is filled.
    const split = boardOf([
      [7, 4],
      [7, 5],
      [7, 7],
      [7, 8],
    ]);
    expect(completesFive(split, cellAt(7, 6), BLACK)).toBe(true);
    expect(board[cellAt(7, 8)]).toBe(0);
  });
});

describe('the same seed answers the same way', () => {
  const board = boardOf([[7, 7]], [[7, 8]]);

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} is decided by the seed and the move count`, () => {
      const input = { board, player: BLACK, difficulty, seed: 'repeatable', moveCount: 2 } as const;
      expect(cpuMove(input)).toBe(cpuMove(input));
    });
  }

  it('moves on with the counter', () => {
    const answers = new Set(
      Array.from({ length: 8 }, (_, moveCount) =>
        cpuMove({ board, player: BLACK, difficulty: 'easy', seed: 's', moveCount }),
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
      cpuMove({ board: cells, player: WHITE, difficulty: 'hard', seed: 's', moveCount: 225 }),
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
