/**
 * The rules, one at a time (docs/NESTED_TIC_TAC_TOE_RULES.md §1–§3, §13).
 *
 * Positions are reached by playing move lists, never built by hand: the
 * position is the list (§1), and a hand-built board could hold a state no
 * list reaches. Short lists are written out with what each move does; rarer
 * shapes (a ninth mark that takes, a drawn match, a win with open boards
 * left) are found by searching seeded random games for the first one that
 * shows them — the search is deterministic, and the test fails if the shape
 * stops turning up.
 */
import { describe, expect, it } from 'vitest';
import {
  isFreeMove,
  isLegalMove,
  legalMoves,
  makeMove,
  newPosition,
  playableBoards,
  playMove,
  positionFromMoves,
  sendTarget,
  takenCount,
  toMove,
  unmakeMove,
  winningLine,
  wouldTake,
  type Position,
} from './engine';
import { judge, randomGame } from './test-helpers';
import {
  boardOf,
  CELL_COUNT,
  cellAtRowCol,
  cellOf,
  CIRCLE,
  colOf,
  CROSS,
  DRAWN,
  LINE_WEIGHT,
  LINES,
  ONGOING,
  OPEN,
  placeOf,
  rowOf,
} from './types';

const play = (moves: readonly number[]): Position => {
  const position = positionFromMoves(moves);
  if (position === null) throw new Error(`fixture is not legal: ${moves.join(',')}`);
  return position;
};

const cellsOfBoard = (board: number): number[] =>
  Array.from({ length: 9 }, (_, place) => cellOf(board, place));

/**
 * Cross takes small board 0 with its last move on place 0, which sends
 * circle to board 0 — the board it just closed (§2): 1 (b0 c1) → circle to
 * b1, 9 (b1 c0) → cross to b0, 2 (b0 c2) → b2, 18 (b2 c0) → b0, 0 (b0 c0):
 * the top row 0-1-2.
 */
const SELF_CLOSING = [1, 9, 2, 18, 0];

/** Cross takes board 0 with the middle column 1-4-7; the last move sends circle to b7. */
const TAKES_BOARD_0 = [1, 9, 4, 36, 7];

/** The first seeded random game (seeds `engine-<n>`) for which `pick` finds a ply, and that ply. */
function findInRandomGames(
  pick: (moves: readonly number[]) => number | null,
  limit = 2_000,
): { moves: number[]; ply: number; seed: string } {
  for (let n = 1; n <= limit; n++) {
    const seed = `engine-${n}`;
    const moves = randomGame(seed);
    const ply = pick(moves);
    if (ply !== null) return { moves, ply, seed };
  }
  throw new Error('no seeded random game showed the shape');
}

describe('the index (§1)', () => {
  it('is small-board first: cell 9·b + c', () => {
    expect(boardOf(40)).toBe(4);
    expect(placeOf(40)).toBe(4);
    expect(cellOf(8, 8)).toBe(80);
  });

  it('maps to screen rows and columns and back', () => {
    // Board 1's top-left cell sits at screen row 0, column 3.
    expect([rowOf(9), colOf(9)]).toEqual([0, 3]);
    // Board 3's bottom-right cell: row 5, column 2.
    expect([rowOf(35), colOf(35)]).toEqual([5, 2]);
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      expect(cellAtRowCol(rowOf(cell), colOf(cell))).toBe(cell);
    }
  });

  it('weights each small board by the big-board lines through it (§4.2)', () => {
    expect(LINE_WEIGHT).toEqual([3, 2, 3, 2, 4, 2, 3, 2, 3]);
    expect(LINES).toHaveLength(8);
  });
});

describe('the turn (§1)', () => {
  it('belongs to cross first, then alternates with the move count', () => {
    const position = newPosition();
    expect(toMove(position)).toBe(CROSS);
    makeMove(position, 40);
    expect(toMove(position)).toBe(CIRCLE);
    makeMove(position, 36);
    expect(toMove(position)).toBe(CROSS);
  });
});

describe('the send (§2)', () => {
  it('lets the first move go anywhere: all 81 cells', () => {
    const position = newPosition();
    expect(legalMoves(position)).toEqual(Array.from({ length: 81 }, (_, cell) => cell));
    expect(isFreeMove(position)).toBe(true);
    expect(sendTarget(position)).toBeNull();
  });

  it('sends the reply to the board at the last move’s place: i mod 9', () => {
    // Bottom-right of board 0 (cell 8) sends to board 8 — the rules' example.
    const position = play([8]);
    expect(sendTarget(position)).toBe(8);
    expect(playableBoards(position)).toEqual([8]);
    expect(legalMoves(position)).toEqual(cellsOfBoard(8));
  });

  it('never offers a filled cell of the board it sends to', () => {
    // 40 (b4 c4) sends to b4 itself; its centre is already taken.
    const position = play([40]);
    expect(legalMoves(position)).toEqual(cellsOfBoard(4).filter((cell) => cell !== 40));
    expect(isLegalMove(position, 40)).toBe(false);
  });

  it('does not let a move leave the board it was sent to', () => {
    const position = play([8]);
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      expect(isLegalMove(position, cell)).toBe(boardOf(cell) === 8);
    }
    expect(playMove(position, 0)).toBe(false);
    expect(position.moves).toEqual([8]);
  });
});

describe('taking a small board (§2 5)', () => {
  it('takes the board with three in a line, and closes it', () => {
    const position = play(TAKES_BOARD_0);
    expect(position.smalls[0]).toBe(CROSS);
    expect(takenCount(position, CROSS)).toBe(1);
    expect(position.result).toBe(ONGOING);
  });

  it('never lets anyone play the empty cells of a taken board again', () => {
    // SELF_CLOSING leaves circle on a free move with board 0 taken: a free
    // move is the widest offer there is, and board 0's empty cells are still
    // not part of it.
    const position = play(SELF_CLOSING);
    const emptyInBoard0 = cellsOfBoard(0).filter((cell) => position.cells[cell] === 0);
    expect(emptyInBoard0.length).toBeGreaterThan(0);
    for (const cell of emptyInBoard0) expect(isLegalMove(position, cell)).toBe(false);
    expect(legalMoves(position).some((cell) => boardOf(cell) === 0)).toBe(false);
  });

  it('checks all eight lines of a small board — and nothing else', () => {
    // wouldTake reads marks only, so two marks set by hand are enough to ask
    // it about each line's third cell (the fuzz below checks lines in play).
    for (const line of LINES) {
      for (const missing of line) {
        const position = newPosition();
        for (const place of line) if (place !== missing) position.cells[cellOf(4, place)] = CROSS;
        expect(wouldTake(position, cellOf(4, missing), CROSS)).toBe(true);
        expect(wouldTake(position, cellOf(4, missing), CIRCLE)).toBe(false);
      }
    }
    // Two marks that share no line take nothing: 0 and 5, 1 and 6, …
    const position = newPosition();
    position.cells[cellOf(4, 0)] = CROSS;
    position.cells[cellOf(4, 5)] = CROSS;
    for (let place = 0; place < 9; place++) {
      if (place === 0 || place === 5) continue;
      expect(wouldTake(position, cellOf(4, place), CROSS)).toBe(false);
    }
  });

  it('frees the next move when the target is closed — the mover can close its own target', () => {
    const position = play(SELF_CLOSING);
    expect(position.smalls[0]).toBe(CROSS);
    // The last move's place is 0: circle is sent to board 0, which is closed.
    expect(placeOf(SELF_CLOSING[SELF_CLOSING.length - 1]!)).toBe(0);
    expect(sendTarget(position)).toBeNull();
    expect(isFreeMove(position)).toBe(true);
    expect(playableBoards(position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('frees the move when sent to a board closed earlier', () => {
    // Circle (free) plays b3 c0, sending cross to the taken board 0.
    const position = play([...SELF_CLOSING, 27]);
    expect(isFreeMove(position)).toBe(true);
    expect(playableBoards(position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(legalMoves(position)).toEqual(judge(position.moves).legal);
  });

  it('takes rather than draws when the ninth mark completes a line (§2 6)', () => {
    const found = findInRandomGames((moves) => {
      for (let ply = 0; ply < moves.length; ply++) {
        const board = boardOf(moves[ply]!);
        const before = judge(moves.slice(0, ply)).smalls[board];
        const after = judge(moves.slice(0, ply + 1));
        const marks = moves.slice(0, ply + 1).filter((cell) => boardOf(cell) === board).length;
        if (before === OPEN && marks === 9 && after.smalls[board] !== DRAWN) return ply;
      }
      return null;
    });
    const position = play(found.moves.slice(0, found.ply + 1));
    const board = boardOf(found.moves[found.ply]!);
    expect(position.filled[board]).toBe(9);
    expect(position.smalls[board]).toBe(found.ply % 2 === 0 ? CROSS : CIRCLE);
  });

  it('draws a small board filled without a line; it belongs to no one', () => {
    const found = findInRandomGames((moves) => {
      for (let ply = 0; ply < moves.length; ply++) {
        if (judge(moves.slice(0, ply + 1)).smalls[boardOf(moves[ply]!)] === DRAWN) return ply;
      }
      return null;
    });
    const before = play(found.moves.slice(0, found.ply));
    const position = play(found.moves.slice(0, found.ply + 1));
    const board = boardOf(found.moves[found.ply]!);
    expect(position.smalls[board]).toBe(DRAWN);
    // Closing it drawn added a board to neither side's count (§7's "n – m").
    expect(takenCount(position, CROSS)).toBe(takenCount(before, CROSS));
    expect(takenCount(position, CIRCLE)).toBe(takenCount(before, CIRCLE));
  });
});

describe('the end of the match (§3)', () => {
  it('wins with three taken boards in a big-board line — with open boards still left', () => {
    const found = findInRandomGames((moves) => {
      const end = judge(moves);
      return (end.result === CROSS || end.result === CIRCLE) && end.smalls.includes(OPEN)
        ? moves.length - 1
        : null;
    });
    const position = play(found.moves);
    expect(position.result).toBe(found.ply % 2 === 0 ? CROSS : CIRCLE);
    expect(position.smalls.some((s) => s === OPEN)).toBe(true);
    // Finished: nothing is legal, even inside the open boards.
    expect(legalMoves(position)).toEqual([]);
    expect(playableBoards(position)).toEqual([]);
    const line = winningLine(position)!;
    expect(line.every((board) => position.smalls[board] === position.result)).toBe(true);
    const open = position.smalls.findIndex((s) => s === OPEN);
    const emptyCell = cellsOfBoard(open).find((cell) => position.cells[cell] === 0)!;
    expect(isLegalMove(position, emptyCell)).toBe(false);
    expect(positionFromMoves([...found.moves, emptyCell])).toBeNull();
  });

  it('does not count a drawn small board toward either side’s line', () => {
    // A match that ended in a draw with some big-board line holding two of
    // one side's boards and a drawn one: two taken, no win.
    const found = findInRandomGames((moves) => {
      const end = judge(moves);
      if (end.result !== DRAWN) return null;
      const blocked = LINES.some(([a, b, c]) => {
        const states = [end.smalls[a], end.smalls[b], end.smalls[c]];
        return (
          states.filter((s) => s === DRAWN).length === 1 &&
          (states.filter((s) => s === CROSS).length === 2 ||
            states.filter((s) => s === CIRCLE).length === 2)
        );
      });
      return blocked ? moves.length - 1 : null;
    });
    const position = play(found.moves);
    expect(position.result).toBe(DRAWN);
    expect(winningLine(position)).toBeNull();
  });

  it('names one winning line when a move completes two: the first in LINES order (§10)', () => {
    const found = findInRandomGames((moves) => {
      const end = judge(moves);
      if (end.result !== CROSS && end.result !== CIRCLE) return null;
      const completed = LINES.filter((line) =>
        line.every((board) => end.smalls[board] === end.result),
      );
      return completed.length >= 2 ? moves.length - 1 : null;
    });
    const position = play(found.moves);
    const completed = LINES.filter((line) =>
      line.every((board) => position.smalls[board] === position.result),
    );
    expect(completed.length).toBeGreaterThanOrEqual(2);
    expect(winningLine(position)).toEqual(completed[0]);
  });

  it('draws when every small board is closed and no big-board line exists', () => {
    const found = findInRandomGames((moves) =>
      judge(moves).result === DRAWN ? moves.length - 1 : null,
    );
    const position = play(found.moves);
    expect(position.result).toBe(DRAWN);
    expect(position.smalls.every((s) => s !== OPEN)).toBe(true);
    expect(legalMoves(position)).toEqual([]);
  });

  it('wins, not draws, when the move that closes the last board also completes a line (§3 3)', () => {
    const found = findInRandomGames((moves) => {
      const end = judge(moves);
      return end.result !== ONGOING && end.result !== DRAWN && !end.smalls.includes(OPEN)
        ? moves.length - 1
        : null;
    }, 20_000);
    const position = play(found.moves);
    expect(position.smalls.every((s) => s !== OPEN)).toBe(true);
    expect(position.result).toBe(found.ply % 2 === 0 ? CROSS : CIRCLE);
  });

  it('ends within 81 moves', () => {
    for (let n = 1; n <= 200; n++) {
      const moves = randomGame(`engine-${n}`);
      expect(moves.length).toBeLessThanOrEqual(81);
      expect(play(moves).result).not.toBe(ONGOING);
    }
  });
});

describe('make / unmake (§4)', () => {
  it('takes a move back exactly, including a take and a win', () => {
    for (let n = 1; n <= 50; n++) {
      const moves = randomGame(`engine-${n}`);
      const position = newPosition();
      const snapshots: string[] = [];
      for (const cell of moves) {
        snapshots.push(JSON.stringify(position));
        makeMove(position, cell);
      }
      for (let ply = moves.length - 1; ply >= 0; ply--) {
        unmakeMove(position);
        expect(JSON.stringify(position)).toBe(snapshots[ply]);
      }
    }
  });
});

describe('positionFromMoves (§8.2)', () => {
  it('rejects a filled cell, a closed board, and a board the move was not sent to', () => {
    expect(positionFromMoves([40, 40])).toBeNull();
    // Board 0 is closed after SELF_CLOSING; 3 is one of its empty cells.
    expect(positionFromMoves([...SELF_CLOSING, 3])).toBeNull();
    expect(positionFromMoves([8, 0])).toBeNull();
  });

  it('rejects any move after the match has finished', () => {
    const found = findInRandomGames((moves) =>
      judge(moves).smalls.includes(OPEN) ? moves.length - 1 : null,
    );
    const finished = play(found.moves);
    expect(finished.result).not.toBe(ONGOING);
    const open = finished.smalls.findIndex((s) => s === OPEN);
    const cell = cellsOfBoard(open).find((c) => finished.cells[c] === 0)!;
    expect(positionFromMoves([...found.moves, cell])).toBeNull();
  });

  it('refuses a list longer than 81 before reading any of it', () => {
    // Every list that long is illegal by its second or third move anyway, so
    // the result alone cannot show the length check; what it buys is that a
    // huge array costs nothing. The proxy counts the elements read.
    let reads = 0;
    const huge = new Proxy(new Array<number>(1_000_000).fill(0), {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads += 1;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    expect(positionFromMoves(huge)).toBeNull();
    expect(reads).toBe(0);
  });

  it('rejects cells outside 0–80', () => {
    expect(positionFromMoves([81])).toBeNull();
    expect(positionFromMoves([-1])).toBeNull();
    expect(positionFromMoves([1.5])).toBeNull();
  });
});

describe('random-game fuzz against an independent judge (§13)', () => {
  it('agrees on the legal moves, every small board and the result at every ply of 2,000 games', () => {
    let plies = 0;
    let wins = 0;
    let draws = 0;
    let freeMoves = 0;
    for (let n = 1; n <= 2_000; n++) {
      const moves = randomGame(`nt-fuzz-${n}`);
      expect(moves.length).toBeLessThanOrEqual(81);
      const position = newPosition();
      for (let ply = 0; ply <= moves.length; ply++) {
        const expected = judge(moves.slice(0, ply));
        expect(legalMoves(position)).toEqual(expected.legal);
        expect(Array.from(position.smalls)).toEqual(expected.smalls);
        expect(position.result).toBe(expected.result);
        // The screen's and the replay's question, cell by cell — off-board
        // and fractional cells included — for the first 300 games.
        if (n <= 300) {
          for (let cell = -1; cell <= CELL_COUNT; cell++) {
            expect(isLegalMove(position, cell)).toBe(expected.legal.includes(cell));
          }
          expect(isLegalMove(position, 0.5)).toBe(false);
        }
        if (isFreeMove(position)) freeMoves += 1;
        if (ply < moves.length) {
          expect(playMove(position, moves[ply]!)).toBe(true);
          plies += 1;
        }
      }
      expect(position.result).not.toBe(ONGOING);
      if (position.result === DRAWN) draws += 1;
      else wins += 1;
    }
    // Deterministic per seed: §13 states these numbers, so they are pinned here.
    expect({ plies, wins, draws, freeMoves }).toEqual({
      plies: 117_592,
      wins: 1_579,
      draws: 421,
      freeMoves: 16_740,
    });
  }, 60_000);
});
