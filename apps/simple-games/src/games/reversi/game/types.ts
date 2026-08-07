/**
 * Core Reversi types. See docs/REVERSI_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * A board is 64 cells, row-major, holding empty / black / white (§1). Cells
 * carry a colour and nothing else — no letters, no numbers — which is what
 * makes one board legible in every language at once (docs/I18N_POLICY.md).
 */

/** 8×8, and only 8×8 (§1). */
export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Piece = typeof EMPTY | typeof BLACK | typeof WHITE;
export type Player = typeof BLACK | typeof WHITE;

/**
 * Black always opens (§1), so the colour the player takes *is* the choice of
 * going first or second — there is no third thing to pick. Which colour that
 * is belongs to the match, not to this module: a session carries
 * `playerColor` and the CPU holds the other one (session.ts).
 */
export const FIRST_MOVE: Player = BLACK;

/** Cell contents, row-major. */
export type Board = readonly Piece[];

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

export const rowOf = (index: number): number => Math.floor(index / BOARD_SIZE);
export const colOf = (index: number): number => index % BOARD_SIZE;

export const opponentOf = (player: Player): Player => (player === BLACK ? WHITE : BLACK);

/** The four centre cells, occupied from the first frame to the last (§1). */
const CENTER = (): { cell: number; piece: Piece }[] => {
  const half = BOARD_SIZE / 2;
  const at = (row: number, col: number) => row * BOARD_SIZE + col;
  return [
    { cell: at(half - 1, half - 1), piece: WHITE },
    { cell: at(half - 1, half), piece: BLACK },
    { cell: at(half, half - 1), piece: BLACK },
    { cell: at(half, half), piece: WHITE },
  ];
};

/** The opening position: two discs each, crossed in the centre (§1). */
export function initialBoard(): Board {
  const board = new Array<Piece>(CELL_COUNT).fill(EMPTY);
  for (const { cell, piece } of CENTER()) board[cell] = piece;
  return board;
}

export interface DiscCounts {
  readonly black: number;
  readonly white: number;
  readonly empty: number;
}

export function countDiscs(board: Board): DiscCounts {
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
 * A board that could have come from play: 64 cells of empty or a disc, the
 * four centre cells occupied (they are filled before the first move and no
 * rule ever empties a cell), and at least the opening's four discs on it.
 */
export function isValidBoard(board: Board): boolean {
  if (board.length !== CELL_COUNT) return false;
  for (const piece of board) {
    if (piece !== EMPTY && piece !== BLACK && piece !== WHITE) return false;
  }
  for (const { cell } of CENTER()) {
    if (board[cell] === EMPTY) return false;
  }
  const { black, white } = countDiscs(board);
  return black >= 1 && white >= 1 && black + white >= 4;
}
