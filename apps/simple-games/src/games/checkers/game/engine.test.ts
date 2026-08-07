/**
 * The rules, pinned (docs/CHECKERS_RULES.md §1–§3). The capture obligation is
 * the one that shapes the game, so most of this file is about it: that a
 * quiet move stops existing while a jump is on the board, that a sequence is
 * forced to its end, and that a crowning stops it anyway.
 */
import { describe, expect, it } from 'vitest';
import {
  applyStep,
  enumerateTurns,
  hasAnyMove,
  hasJumpFrom,
  isCapture,
  isQuietKingStep,
  legalMoves,
  moveCaptured,
  moveFrom,
  moveTo,
  mustCapture,
  packMove,
  unpackMove,
  NO_CAPTURE,
} from './engine';
import { decodeBoard, encodeBoard } from './serialize';
import {
  CELL_COUNT,
  CPU,
  CPU_KING,
  CPU_MAN,
  EMPTY,
  PIECES_PER_SIDE,
  PLAYER,
  PLAYER_KING,
  PLAYER_MAN,
  cellAt,
  countPieces,
  initialBoard,
  isDarkSquare,
  isValidBoard,
  sideToMove,
  type Board,
  type Piece,
} from './types';

/**
 * Builds a board from eight eight-character rows, row 0 first:
 * `.` empty, `p`/`P` the player's man/king, `c`/`C` the CPU's.
 */
function boardOf(rows: readonly string[]): Board {
  expect(rows).toHaveLength(8);
  const cells: Piece[] = [];
  for (const row of rows) {
    expect(row).toHaveLength(8);
    for (const character of row) {
      cells.push(
        character === 'p'
          ? PLAYER_MAN
          : character === 'P'
            ? PLAYER_KING
            : character === 'c'
              ? CPU_MAN
              : character === 'C'
                ? CPU_KING
                : EMPTY,
      );
    }
  }
  // The generators only walk the dark squares (§1), so a fixture that puts a
  // piece on a light one is testing a board the game cannot produce — and it
  // would fail quietly, with the piece simply having no moves.
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (cells[cell] !== EMPTY && !isDarkSquare(cell)) {
      throw new Error(`fixture puts a piece on the light square ${cell}`);
    }
  }
  return cells;
}

const destinationsFrom = (board: Board, side: typeof PLAYER | typeof CPU, from: number) =>
  legalMoves(board, side)
    .filter((move) => move.from === from)
    .map((move) => move.to)
    .sort((a, b) => a - b);

describe('the opening position', () => {
  it('sets twelve a side on the three dark ranks nearest each player', () => {
    const board = initialBoard();
    const counts = countPieces(board);
    expect(counts.player).toBe(PIECES_PER_SIDE);
    expect(counts.cpu).toBe(PIECES_PER_SIDE);
    expect(counts.playerKings).toBe(0);
    expect(counts.cpuKings).toBe(0);
  });

  it('puts nothing on a light square', () => {
    const board = initialBoard();
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (!isDarkSquare(cell)) expect(board[cell]).toBe(EMPTY);
    }
  });

  it('leaves the two middle ranks empty', () => {
    const board = initialBoard();
    for (let col = 0; col < 8; col++) {
      expect(board[cellAt(3, col)]).toBe(EMPTY);
      expect(board[cellAt(4, col)]).toBe(EMPTY);
    }
  });

  it('offers each side the seven opening moves the game is known for', () => {
    const board = initialBoard();
    expect(legalMoves(board, PLAYER)).toHaveLength(7);
    expect(legalMoves(board, CPU)).toHaveLength(7);
  });

  it('is a board that could have come from play', () => {
    expect(isValidBoard(initialBoard())).toBe(true);
  });
});

describe('a man', () => {
  it('moves diagonally forward and never back', () => {
    const board = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '..p.....',
      '........',
      '......c.',
    ]);
    // (5,2) advances to (4,1) and (4,3); the two squares behind it are not
    // offered even though they are empty.
    expect(destinationsFrom(board, PLAYER, cellAt(5, 2))).toEqual([cellAt(4, 1), cellAt(4, 3)]);
  });

  it('moves the other way for the CPU', () => {
    const board = boardOf([
      '........',
      '........',
      '.c......',
      '........',
      '........',
      '........',
      '........',
      '......p.',
    ]);
    expect(destinationsFrom(board, CPU, cellAt(2, 1))).toEqual([cellAt(3, 0), cellAt(3, 2)]);
  });

  it('cannot move onto an occupied square', () => {
    const board = boardOf([
      '........',
      '........',
      '........',
      '........',
      '.p.p....',
      '..p.....',
      '........',
      '......c.',
    ]);
    expect(destinationsFrom(board, PLAYER, cellAt(5, 2))).toEqual([]);
  });
});

describe('a king', () => {
  it('moves one square in all four diagonals', () => {
    const board = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '..P.....',
      '........',
      '......c.',
    ]);
    expect(destinationsFrom(board, PLAYER, cellAt(5, 2))).toEqual([
      cellAt(4, 1),
      cellAt(4, 3),
      cellAt(6, 1),
      cellAt(6, 3),
    ]);
  });

  it('does not fly: a distant square on the diagonal is not a move', () => {
    const board = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '..P.....',
      '........',
      '......c.',
    ]);
    expect(destinationsFrom(board, PLAYER, cellAt(5, 2))).not.toContain(cellAt(2, 5));
  });
});

describe('the capture obligation', () => {
  // (5,2) can jump the man on (4,3) and land on (3,4). Another man of the
  // player's sits where it has a quiet move and nothing to take.
  const forced = boardOf([
    '........',
    '........',
    '........',
    '........',
    '...c....',
    '..p...p.',
    '........',
    '........',
  ]);

  it('reports that a capture is available', () => {
    expect(mustCapture(forced, PLAYER)).toBe(true);
  });

  it('generates the jump and nothing else — the quiet moves stop existing', () => {
    const moves = legalMoves(forced, PLAYER);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ from: cellAt(5, 2), to: cellAt(3, 4), captured: cellAt(4, 3) });
  });

  it('offers the quiet moves again once nothing can be taken', () => {
    const quiet = boardOf([
      '........',
      '........',
      '........',
      '........',
      '.....c..',
      '..p.....',
      '........',
      '........',
    ]);
    expect(mustCapture(quiet, PLAYER)).toBe(false);
    expect(legalMoves(quiet, PLAYER).every((move) => move.captured === NO_CAPTURE)).toBe(true);
  });

  it('does not let a man jump its own side', () => {
    const own = boardOf([
      '........',
      '........',
      '........',
      '........',
      '...p....',
      '..p.....',
      '........',
      '......c.',
    ]);
    expect(mustCapture(own, PLAYER)).toBe(false);
  });

  it('does not let a man jump onto an occupied landing square', () => {
    const blocked = boardOf([
      '........',
      '........',
      '........',
      '....p...',
      '...c....',
      '..p.....',
      '........',
      '......c.',
    ]);
    expect(mustCapture(blocked, PLAYER)).toBe(false);
  });

  it('does not let a man jump backwards, even to take a piece', () => {
    const behind = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '..p.....',
      '...c....',
      '......c.',
    ]);
    expect(mustCapture(behind, PLAYER)).toBe(false);
  });

  it('lets a king jump backwards', () => {
    const behind = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '..P.....',
      '...c....',
      '......c.',
    ]);
    const moves = legalMoves(behind, PLAYER);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ from: cellAt(5, 2), to: cellAt(7, 4), captured: cellAt(6, 3) });
  });
});

describe('a capture sequence', () => {
  // Jumping (4,3) lands on (3,4), from where (2,5) can be jumped too.
  const double = boardOf([
    '........',
    '........',
    '.....c..',
    '........',
    '...c....',
    '..p.....',
    '........',
    '........',
  ]);

  it('leaves the same piece to jump on, and says so', () => {
    const first = legalMoves(double, PLAYER)[0]!;
    const outcome = applyStep(double, first);
    expect(outcome.continueFrom).toBe(cellAt(3, 4));
    expect(hasJumpFrom(outcome.board, cellAt(3, 4), PLAYER)).toBe(true);
  });

  it('narrows the legal moves to that one piece while it goes on', () => {
    const outcome = applyStep(double, legalMoves(double, PLAYER)[0]!);
    const next = legalMoves(outcome.board, PLAYER, outcome.continueFrom);
    expect(next).toHaveLength(1);
    expect(next[0]!.from).toBe(cellAt(3, 4));
    expect(next[0]!.captured).toBe(cellAt(2, 5));
  });

  it('ends with both pieces gone and the mover on the far square', () => {
    const turns = enumerateTurns(double, PLAYER);
    expect(turns).toHaveLength(1);
    const turn = turns[0]!;
    expect(turn.steps).toHaveLength(2);
    expect(countPieces(turn.board).cpu).toBe(0);
    expect(turn.board[cellAt(1, 6)]).toBe(PLAYER_MAN);
  });

  it('enumerates both branches when the sequence forks', () => {
    // From (3,4) the piece could go on over (2,3) or over (2,5).
    const fork = boardOf([
      '........',
      '........',
      '...c.c..',
      '........',
      '...c....',
      '..p.....',
      '........',
      '........',
    ]);
    const turns = enumerateTurns(fork, PLAYER);
    expect(turns).toHaveLength(2);
    expect(turns.every((turn) => turn.steps.length === 2)).toBe(true);
    expect(turns.map((turn) => countPieces(turn.board).cpu)).toEqual([1, 1]);
  });
});

describe('crowning', () => {
  it('turns a man that reaches the far edge into a king', () => {
    const board = boardOf([
      '........',
      '..p.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '......c.',
    ]);
    const outcome = applyStep(board, {
      from: cellAt(1, 2),
      to: cellAt(0, 1),
      captured: NO_CAPTURE,
    });
    expect(outcome.promoted).toBe(true);
    expect(outcome.board[cellAt(0, 1)]).toBe(PLAYER_KING);
  });

  it('ends the turn even when the new king could jump on', () => {
    // Jumping (1,2) crowns the man on (0,3); from there the new king has
    // (1,4) to take, with (2,5) empty behind it…
    const board = boardOf([
      '........',
      '..c.c...',
      '.p......',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const jump = legalMoves(board, PLAYER).find((move) => move.to === cellAt(0, 3))!;
    const outcome = applyStep(board, jump);
    expect(outcome.promoted).toBe(true);
    // …but the turn is over: English rules crown and stop (§2, §11).
    expect(outcome.continueFrom).toBeNull();
    expect(hasJumpFrom(outcome.board, cellAt(0, 3), PLAYER)).toBe(true);
  });

  it('does not re-crown a king', () => {
    const board = boardOf([
      '........',
      '..P.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '......c.',
    ]);
    const outcome = applyStep(board, {
      from: cellAt(1, 2),
      to: cellAt(0, 1),
      captured: NO_CAPTURE,
    });
    expect(outcome.promoted).toBe(false);
    expect(outcome.board[cellAt(0, 1)]).toBe(PLAYER_KING);
  });
});

describe('being shut in', () => {
  it('is the same as being wiped out: no legal move at all', () => {
    // The player's man is walled in: both squares ahead are taken, the jump
    // over (6,5) has no room to land, and the one over (6,7) runs off the
    // board. Being able to take nothing and go nowhere is a loss (§3).
    const board = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '....c...',
      '.....c.c',
      '......p.',
    ]);
    expect(hasAnyMove(board, PLAYER)).toBe(false);
    expect(hasAnyMove(board, CPU)).toBe(true);
  });
});

describe('the quiet-move counter', () => {
  const board = boardOf([
    '........',
    '........',
    '........',
    '........',
    '...P....',
    '..p.....',
    '........',
    '......c.',
  ]);

  it('counts a quiet king move', () => {
    expect(
      isQuietKingStep(board, { from: cellAt(4, 3), to: cellAt(3, 2), captured: NO_CAPTURE }),
    ).toBe(true);
  });

  it('does not count a man move — that is progress towards a crowning', () => {
    expect(
      isQuietKingStep(board, { from: cellAt(5, 2), to: cellAt(4, 1), captured: NO_CAPTURE }),
    ).toBe(false);
  });

  it('does not count a capture', () => {
    expect(
      isQuietKingStep(board, { from: cellAt(4, 3), to: cellAt(6, 5), captured: cellAt(5, 4) }),
    ).toBe(false);
  });
});

describe('the packed move form', () => {
  it('round-trips every cell pair, capture or not', () => {
    for (const captured of [NO_CAPTURE, 0, 27, 63]) {
      for (const from of [0, 1, 34, 63]) {
        for (const to of [0, 7, 45, 63]) {
          const packed = packMove(from, to, captured);
          expect(moveFrom(packed)).toBe(from);
          expect(moveTo(packed)).toBe(to);
          expect(moveCaptured(packed)).toBe(captured);
          expect(isCapture(packed)).toBe(captured !== NO_CAPTURE);
          expect(unpackMove(packed)).toEqual({ from, to, captured });
        }
      }
    }
  });
});

describe('whose turn it is', () => {
  it('follows from the completed-turn count and the opener', () => {
    expect(sideToMove(0, PLAYER)).toBe(PLAYER);
    expect(sideToMove(1, PLAYER)).toBe(CPU);
    expect(sideToMove(0, CPU)).toBe(CPU);
    expect(sideToMove(7, CPU)).toBe(PLAYER);
  });
});

describe('board validation fails closed', () => {
  const encoded = encodeBoard(initialBoard());

  it('accepts what it wrote', () => {
    expect(decodeBoard(encoded)).toEqual(initialBoard());
  });

  it('rejects the wrong length', () => {
    expect(decodeBoard(encoded.slice(1))).toBeNull();
    expect(decodeBoard(`${encoded}0`)).toBeNull();
  });

  it('rejects an unknown piece', () => {
    expect(decodeBoard(`5${encoded.slice(1)}`)).toBeNull();
  });

  it('rejects a piece standing on a light square', () => {
    const light = initialBoard().slice() as Piece[];
    light[cellAt(4, 0)] = PLAYER_MAN;
    expect(isValidBoard(light)).toBe(false);
    expect(decodeBoard(encodeBoard(light))).toBeNull();
  });

  it('rejects a man left un-crowned on the far edge', () => {
    const stranded = initialBoard().slice() as Piece[];
    stranded[cellAt(5, 0)] = EMPTY;
    stranded[cellAt(0, 1)] = PLAYER_MAN;
    expect(isValidBoard(stranded)).toBe(false);
  });

  it('accepts a king on the far edge', () => {
    const crowned = initialBoard().slice() as Piece[];
    crowned[cellAt(5, 0)] = EMPTY;
    crowned[cellAt(0, 1)] = PLAYER_KING;
    expect(isValidBoard(crowned)).toBe(true);
  });

  it('rejects a side with more than twelve pieces', () => {
    const extra = initialBoard().slice() as Piece[];
    extra[cellAt(3, 0)] = PLAYER_MAN;
    expect(isValidBoard(extra)).toBe(false);
  });

  it('rejects a side already wiped out — that match was over', () => {
    const finished = initialBoard().map((piece) =>
      piece === CPU_MAN || piece === CPU_KING ? EMPTY : piece,
    ) as Piece[];
    expect(isValidBoard(finished)).toBe(false);
  });
});
