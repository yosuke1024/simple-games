/**
 * The play rules of docs/MINESWEEPER_RULES.md §2 and §3: flood fill, flags,
 * chording, and the two ways a game ends. Fields are hand-built so every count
 * in the assertions can be read off the picture above it.
 */
import { describe, expect, it } from 'vitest';
import { fieldFromMines, type MineField } from './board';
import {
  canChord,
  cellViews,
  chord,
  createBoard,
  isLost,
  isWon,
  remainingMines,
  reveal,
  statusOf,
  toggleFlag,
  type Board,
} from './engine';

/** '*' is a mine, anything else is not. */
function fieldOf(rows: readonly string[]): MineField {
  const height = rows.length;
  const width = rows[0]!.length;
  const mines: boolean[] = [];
  for (const row of rows) for (const character of row) mines.push(character === '*');
  return fieldFromMines(width, height, mines);
}

/** A board in a hand-chosen state, for the positions play cannot reach quickly. */
function boardWith(field: MineField, opened: readonly number[], flagged: readonly number[]): Board {
  return {
    field,
    opened: field.mines.map((_, index) => opened.includes(index)),
    flagged: field.mines.map((_, index) => flagged.includes(index)),
    exploded: null,
  };
}

/**
 * A wall of mines down the middle column splits the board into two regions
 * that cannot be opened by one tap:
 *
 *   . . * . .      counts:  0 2 * 2 0
 *   . . * . .               0 3 * 3 0
 *   . . * . .               0 2 * 2 0
 */
const SPLIT = fieldOf(['..*..', '..*..', '..*..']);
const LEFT_REGION = [0, 1, 5, 6, 10, 11];
const RIGHT_REGION = [3, 4, 8, 9, 13, 14];

/** One mine in the corner; everything else is a 0 or a 1. */
const CORNER = fieldOf(['*..', '...', '...']);

describe('flood fill (§3)', () => {
  it('opens the connected zeros and the numbers around them, and stops there', () => {
    const board = reveal(createBoard(SPLIT), 0)!;
    const opened = board.opened.flatMap((isOpen, index) => (isOpen ? [index] : []));
    expect(opened).toEqual(LEFT_REGION);
    // The wall of mines is a wall: the far side is untouched.
    for (const cell of RIGHT_REGION) expect(board.opened[cell]).toBe(false);
    expect(statusOf(board)).toBe('playing');
  });

  it('opens a single cell when it already sees a mine', () => {
    // A 2 has a number to report, so it is where the flood stops.
    const board = reveal(createBoard(SPLIT), 1)!;
    expect(board.opened.filter(Boolean)).toHaveLength(1);
    expect(board.field.counts[1]).toBe(2);
  });

  it('does nothing for a cell that is already open', () => {
    const board = reveal(createBoard(SPLIT), 0)!;
    expect(reveal(board, 0)).toBeNull();
  });
});

describe('flags (§3, §6)', () => {
  it('goes on and off, and keeps the cell shut while it is there', () => {
    const empty = createBoard(SPLIT);
    const flagged = toggleFlag(empty, 2)!;
    expect(flagged.flagged[2]).toBe(true);
    // A flag is a decision: the cell cannot be opened until it is taken back.
    expect(reveal(flagged, 2)).toBeNull();

    const unflagged = toggleFlag(flagged, 2)!;
    expect(unflagged.flagged[2]).toBe(false);
    expect(reveal(unflagged, 2)).not.toBeNull();
  });

  it('refuses a flag on an open cell', () => {
    const board = reveal(createBoard(SPLIT), 0)!;
    expect(toggleFlag(board, 0)).toBeNull();
  });

  it('counts mines minus flags, and lets the count go negative (§6)', () => {
    let board = createBoard(SPLIT);
    expect(remainingMines(board)).toBe(3);
    board = toggleFlag(board, 2)!;
    expect(remainingMines(board)).toBe(2);
    for (const cell of [0, 1, 3, 4]) board = toggleFlag(board, cell)!;
    // Five flags for three mines: over-flagging is the player's business (§6).
    expect(remainingMines(board)).toBe(-2);
  });
});

describe('chording (§3)', () => {
  it('opens the rest when the flags already account for the number', () => {
    // The 1 at the centre, with the corner mine correctly flagged.
    const board = boardWith(CORNER, [4], [0]);
    expect(canChord(board, 4)).toBe(true);
    const chorded = chord(board, 4)!;
    expect(isLost(chorded)).toBe(false);
    expect(isWon(chorded)).toBe(true);
  });

  it('opens a mine — and ends the game — when a flag is wrong', () => {
    // The same 1, but the flag sits on a safe cell instead of the mine. The
    // number is satisfied as far as the rules can tell, so the chord goes
    // ahead and opens the corner. That is the player's reading, and it stands.
    const board = boardWith(CORNER, [4], [1]);
    expect(canChord(board, 4)).toBe(true);
    const chorded = chord(board, 4)!;
    expect(isLost(chorded)).toBe(true);
    expect(chorded.exploded).toBe(0);
    expect(statusOf(chorded)).toBe('lost');
  });

  it('does nothing when the flags do not match, or there is nothing to open', () => {
    expect(chord(boardWith(CORNER, [4], []), 4)).toBeNull();
    expect(chord(boardWith(CORNER, [4], [0, 1]), 4)).toBeNull();
    // Every neighbour already open: satisfied, but with nothing left to do.
    expect(chord(boardWith(CORNER, [1, 2, 3, 4, 5, 6, 7, 8], [0]), 4)).toBeNull();
    // A closed cell and a 0 are not chordable at all.
    expect(chord(boardWith(CORNER, [4], [0]), 3)).toBeNull();
    expect(chord(boardWith(CORNER, [8], [0]), 8)).toBeNull();
  });
});

describe('winning (§2)', () => {
  it('is reached by opening every cell without a mine, with no flags at all', () => {
    let board = reveal(createBoard(SPLIT), 0)!;
    expect(isWon(board)).toBe(false);
    board = reveal(board, 4)!;
    expect(isWon(board)).toBe(true);
    expect(statusOf(board)).toBe('won');
    expect(board.flagged.some(Boolean)).toBe(false);
  });

  it('does not care how many mines were flagged, or whether any were', () => {
    // One of the three mines flagged, the other two never touched.
    let board = toggleFlag(createBoard(SPLIT), 7)!;
    board = reveal(board, 0)!;
    board = reveal(board, 4)!;
    expect(isWon(board)).toBe(true);
    expect(remainingMines(board)).toBe(2);
  });

  it('is not reached while a safe cell is still shut, however many flags are down', () => {
    // All three mines flagged, one safe cell left: flags decide nothing (§2).
    const board = boardWith(SPLIT, [...LEFT_REGION, 3, 8, 9, 13, 14], [2, 7, 12]);
    expect(isWon(board)).toBe(false);
    expect(statusOf(board)).toBe('playing');
  });

  it('accepts no further moves once it is won', () => {
    let board = reveal(createBoard(SPLIT), 0)!;
    board = reveal(board, 4)!;
    expect(reveal(board, 2)).toBeNull();
    expect(toggleFlag(board, 2)).toBeNull();
    expect(chord(board, 1)).toBeNull();
  });
});

describe('losing (§2)', () => {
  it('ends the moment a mine is opened, and shows the mines that were hiding', () => {
    const board = reveal(createBoard(SPLIT), 2)!;
    expect(isLost(board)).toBe(true);
    expect(isWon(board)).toBe(false);
    expect(board.exploded).toBe(2);

    const views = cellViews(board);
    expect(views[2]).toEqual({ kind: 'mine', exploded: true });
    // The other two mines are revealed as well, unexploded — the board the
    // player was reading, shown as it really was.
    expect(views[7]).toEqual({ kind: 'mine', exploded: false });
    expect(views[12]).toEqual({ kind: 'mine', exploded: false });
    expect(views[0]).toEqual({ kind: 'hidden' });
  });

  it('accepts no further moves once it is lost', () => {
    const board = reveal(createBoard(SPLIT), 2)!;
    expect(reveal(board, 0)).toBeNull();
    expect(toggleFlag(board, 0)).toBeNull();
    expect(canChord(board, 1)).toBe(false);
  });
});

describe('what a cell shows (§12)', () => {
  it('names hidden, flagged, numbered and mined cells apart', () => {
    const board = boardWith(SPLIT, [1], [3]);
    const views = cellViews(board);
    expect(views[1]).toEqual({ kind: 'number', count: 2 });
    expect(views[3]).toEqual({ kind: 'flagged' });
    expect(views[0]).toEqual({ kind: 'hidden' });
    // A mine stays hidden while the game is still running.
    expect(views[2]).toEqual({ kind: 'hidden' });
  });
});
