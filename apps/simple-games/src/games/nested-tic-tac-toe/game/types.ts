/**
 * Core Nested Tic-Tac-Toe types. See docs/NESTED_TIC_TAC_TOE_RULES.md — the
 * single source of truth for the rules these shapes serve.
 *
 * The board is 81 cells, indexed small-board first (§1): cell `i = 9·b + c`,
 * where `b` is the small board's place on the big board and `c` the cell's
 * place inside its small board, both row-major from the top left. The send
 * rule (§2) depends on `c` alone, so with this index the board the next move
 * goes to is simply `i mod 9`.
 *
 * Cells hold a mark and nothing else. The engine thinks in marks (cross /
 * circle); which of them is "you" and which is "the CPU" is the session's
 * business (session.ts).
 */

/** Nine small boards of nine cells each (§1). */
export const BOARD_COUNT = 9;
export const CELLS_PER_BOARD = 9;
export const CELL_COUNT = BOARD_COUNT * CELLS_PER_BOARD;

export const EMPTY = 0;
/** Cross moves first — a rule, not a setting (§1). */
export const CROSS = 1;
export const CIRCLE = 2;

export type Cell = typeof EMPTY | typeof CROSS | typeof CIRCLE;
export type Mark = typeof CROSS | typeof CIRCLE;

/**
 * A small board's state (§1). OPEN boards can still be played; the other
 * three are "closed" — taken by one side, or full without a line (drawn).
 * The taken states reuse the mark values, so `state === mark` reads "taken
 * by mark".
 */
export const OPEN = 0;
export const DRAWN = 3;
export type SmallState = typeof OPEN | typeof CROSS | typeof CIRCLE | typeof DRAWN;

/**
 * The match's result as the engine sees it, from no one's side (§3). The
 * session turns it into the player's `status`.
 */
export const ONGOING = 0;
export type Result = typeof ONGOING | typeof CROSS | typeof CIRCLE | typeof DRAWN;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

/** From the player's side of the table: 'won' means the player did (§3). */
export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

/**
 * The eight lines of a 3×3 grid (§2 5): three rows, three columns, two
 * diagonals. The same shape serves a small board's cells (indexes `c`) and
 * the big board's small boards (indexes `b`, §3 1).
 */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** The lines through each place of a 3×3 grid — 3 at a corner, 2 on an edge, 4 in the centre. */
export const LINES_THROUGH: readonly (readonly (readonly [number, number, number])[])[] =
  Array.from({ length: 9 }, (_, place) => LINES.filter((line) => line.includes(place)));

/** `w(b)` of §4.2: how many big-board lines run through small board `b`. */
export const LINE_WEIGHT: readonly number[] = LINES_THROUGH.map((lines) => lines.length);

/** The small board a cell belongs to (`b`). */
export const boardOf = (cell: number): number => Math.floor(cell / CELLS_PER_BOARD);
/** The cell's place inside its small board (`c`) — and so the board it sends to (§2). */
export const placeOf = (cell: number): number => cell % CELLS_PER_BOARD;
/** Cell index of place `c` in small board `b`. */
export const cellOf = (board: number, place: number): number => board * CELLS_PER_BOARD + place;

/** Screen row 0–8 of a cell (§1): `3·⌊b/3⌋ + ⌊c/3⌋`. */
export const rowOf = (cell: number): number =>
  3 * Math.floor(boardOf(cell) / 3) + Math.floor(placeOf(cell) / 3);
/** Screen column 0–8 of a cell (§1): `3·(b mod 3) + (c mod 3)`. */
export const colOf = (cell: number): number => 3 * (boardOf(cell) % 3) + (placeOf(cell) % 3);
/** The cell at screen row and column — the inverse of rowOf / colOf. */
export const cellAtRowCol = (row: number, col: number): number =>
  cellOf(3 * Math.floor(row / 3) + Math.floor(col / 3), 3 * (row % 3) + (col % 3));

export const otherMark = (mark: Mark): Mark => (mark === CROSS ? CIRCLE : CROSS);

/**
 * Whose turn a move count implies (§1): there is no pass, so the alternation
 * never breaks — an even count means cross is up.
 */
export const markToMove = (moveCount: number): Mark => (moveCount % 2 === 0 ? CROSS : CIRCLE);

/** The mark the player holds: moving first means cross (§1). */
export const playerMarkOf = (playerGoesFirst: boolean): Mark => (playerGoesFirst ? CROSS : CIRCLE);
