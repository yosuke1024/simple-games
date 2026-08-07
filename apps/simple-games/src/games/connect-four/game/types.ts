/**
 * Core Connect Four types. See docs/CONNECT_FOUR_RULES.md — the single source
 * of truth for the rules these shapes serve.
 *
 * A board is 42 cells, row-major with row 0 at the top, holding empty /
 * player / CPU (§1). Cells carry a colour and nothing else, which is what
 * makes one board legible in every language at once (docs/I18N_POLICY.md).
 */

/** 7 columns by 6 rows, and only that (§1). */
export const COLS = 7;
export const ROWS = 6;
export const CELL_COUNT = COLS * ROWS;

/** Four in a row is the game (§3). */
export const LINE_LENGTH = 4;

export const EMPTY = 0;
export const PLAYER = 1;
export const CPU = 2;

export type Piece = typeof EMPTY | typeof PLAYER | typeof CPU;
export type Side = typeof PLAYER | typeof CPU;

/** Cell contents, row-major, row 0 the top. */
export type Board = readonly Piece[];

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

export const rowOf = (index: number): number => Math.floor(index / COLS);
export const colOf = (index: number): number => index % COLS;
export const cellAt = (row: number, col: number): number => row * COLS + col;

export const opponentOf = (side: Side): Side => (side === PLAYER ? CPU : PLAYER);

export const emptyBoard = (): Board => new Array<Piece>(CELL_COUNT).fill(EMPTY);

export interface PieceCounts {
  readonly player: number;
  readonly cpu: number;
  readonly empty: number;
}

export function countPieces(board: Board): PieceCounts {
  let player = 0;
  let cpu = 0;
  let empty = 0;
  for (const piece of board) {
    if (piece === PLAYER) player += 1;
    else if (piece === CPU) cpu += 1;
    else empty += 1;
  }
  return { player, cpu, empty };
}

/**
 * A board that could have come from play: 42 known cells, gravity intact (no
 * disc floats above an empty cell), and the side that opened the match (§1)
 * exactly level with the other or one disc ahead.
 */
export function isValidBoard(board: Board, first: Side): boolean {
  if (board.length !== CELL_COUNT) return false;
  for (const piece of board) {
    if (piece !== EMPTY && piece !== PLAYER && piece !== CPU) return false;
  }
  for (let col = 0; col < COLS; col++) {
    for (let row = ROWS - 1; row > 0; row--) {
      if (board[cellAt(row, col)] === EMPTY && board[cellAt(row - 1, col)] !== EMPTY) return false;
    }
  }
  const { player, cpu } = countPieces(board);
  const opened = first === PLAYER ? player : cpu;
  const answered = first === PLAYER ? cpu : player;
  return opened === answered || opened === answered + 1;
}

/**
 * Whose turn a board implies: the alternation never breaks in this game, so
 * the disc counts and the side that opened say it between them (§1). Level
 * counts mean the opener is up again.
 */
export function sideToMove(board: Board, first: Side): Side {
  const { player, cpu } = countPieces(board);
  return player === cpu ? first : opponentOf(first);
}
