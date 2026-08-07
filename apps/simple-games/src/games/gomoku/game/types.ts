/**
 * Core Gomoku types. See docs/GOMOKU_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * A board is 225 intersections, row-major with row 0 at the top, holding
 * empty / black / white (§1). Stones carry a colour and nothing else, which
 * is what makes one board legible in every language at once
 * (docs/I18N_POLICY.md).
 *
 * Black always opens, so the turn follows from the stone counts alone — the
 * board never has to remember it. Which colour the *player* holds is a
 * separate thing and lives on the session (§1).
 */

/** 15×15, and only that (§1, §11). */
export const SIZE = 15;
export const CELL_COUNT = SIZE * SIZE;

/** Five in a row is the game — and more than five still counts (§3, §11). */
export const WIN_LENGTH = 5;

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Piece = typeof EMPTY | typeof BLACK | typeof WHITE;
export type Player = typeof BLACK | typeof WHITE;

/** Intersection contents, row-major, row 0 the top. */
export type Board = readonly Piece[];

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

export const rowOf = (index: number): number => Math.floor(index / SIZE);
export const colOf = (index: number): number => index % SIZE;
export const cellAt = (row: number, col: number): number => row * SIZE + col;

/** The middle of the board — where a first stone goes when nothing is placed. */
export const CENTRE = cellAt((SIZE - 1) / 2, (SIZE - 1) / 2);

export const opponentOf = (player: Player): Player => (player === BLACK ? WHITE : BLACK);

export const emptyBoard = (): Board => new Array<Piece>(CELL_COUNT).fill(EMPTY);

export interface StoneCounts {
  readonly black: number;
  readonly white: number;
  readonly empty: number;
}

export function countStones(board: Board): StoneCounts {
  let black = 0;
  let white = 0;
  let empty = 0;
  for (const piece of board) {
    if (piece === BLACK) black += 1;
    else if (piece === WHITE) white += 1;
    else empty += 1;
  }
  return { black, white, empty };
}

/**
 * A board that could have come from play: 225 known intersections, and black
 * either level with white or one stone ahead — black opens and the turn never
 * skips, so no other split can happen (§8).
 */
export function isValidBoard(board: Board): boolean {
  if (board.length !== CELL_COUNT) return false;
  for (const piece of board) {
    if (piece !== EMPTY && piece !== BLACK && piece !== WHITE) return false;
  }
  const { black, white } = countStones(board);
  return black === white || black === white + 1;
}

/**
 * Whose turn a board implies (§1). Black opens and nobody ever passes — there
 * is always an empty intersection while the board has one — so the counts say
 * it on their own.
 */
export const sideToMove = (board: Board): Player => {
  const { black, white } = countStones(board);
  return black === white ? BLACK : WHITE;
};
