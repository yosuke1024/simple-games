/**
 * Core Checkers types. See docs/CHECKERS_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * A board is 64 cells, row-major with row 0 at the top, but only the 32 dark
 * squares are ever occupied (§1). Cells carry a side and a rank and nothing
 * else, which is what makes one board legible in every language at once
 * (docs/I18N_POLICY.md).
 *
 * The player is always the side at the bottom of the screen, so a man of
 * theirs moves towards row 0 and one of the CPU's moves towards row 7. That
 * is a fact about the picture, not about who opened the match: which side
 * moves first is the player's choice and lives on the session (§1).
 */

/** 8×8, English draughts, and only that (§1, §11). */
export const COLS = 8;
export const ROWS = 8;
export const CELL_COUNT = COLS * ROWS;

/** Twelve a side, on the three dark ranks nearest each player (§1). */
export const PIECES_PER_SIDE = 12;

export const EMPTY = 0;
export const PLAYER_MAN = 1;
export const CPU_MAN = 2;
export const PLAYER_KING = 3;
export const CPU_KING = 4;

export type Piece =
  typeof EMPTY | typeof PLAYER_MAN | typeof CPU_MAN | typeof PLAYER_KING | typeof CPU_KING;

export const PLAYER = 1;
export const CPU = 2;
export type Side = typeof PLAYER | typeof CPU;

/** Cell contents, row-major, row 0 the top. */
export type Board = readonly Piece[];

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

/**
 * Consecutive turns of nothing but a king's quiet move that end the match in
 * a draw (§3). Neither side is making progress: no capture has changed the
 * material and no man has moved towards a crowning, so the position can only
 * repeat. One counter says that, where a table of past positions would have
 * to be carried in every save.
 *
 * It lives here rather than beside the session because the CPU's search needs
 * it too — a search that did not know the game can end this way would read
 * past a draw it is one move from causing (§4).
 */
export const DRAW_QUIET_PLIES = 50;

export const rowOf = (index: number): number => Math.floor(index / COLS);
export const colOf = (index: number): number => index % COLS;
export const cellAt = (row: number, col: number): number => row * COLS + col;

/**
 * The playable half of the board. The convention every printed set uses is a
 * light square in the near right corner, which puts the dark squares on the
 * odd sum of coordinates (§1).
 */
export const isDarkSquare = (index: number): boolean => (rowOf(index) + colOf(index)) % 2 === 1;

export const opponentOf = (side: Side): Side => (side === PLAYER ? CPU : PLAYER);

/** Which side owns a piece, or null for an empty square. */
export function sideOf(piece: Piece): Side | null {
  if (piece === PLAYER_MAN || piece === PLAYER_KING) return PLAYER;
  if (piece === CPU_MAN || piece === CPU_KING) return CPU;
  return null;
}

export const isKing = (piece: Piece): boolean => piece === PLAYER_KING || piece === CPU_KING;

export const manOf = (side: Side): Piece => (side === PLAYER ? PLAYER_MAN : CPU_MAN);
export const kingOf = (side: Side): Piece => (side === PLAYER ? PLAYER_KING : CPU_KING);

/**
 * The row a man of `side` is crowned on: the far edge, which for the player
 * (drawn at the bottom) is the top of the screen (§2).
 */
export const promotionRowOf = (side: Side): number => (side === PLAYER ? 0 : ROWS - 1);

/** Which way a man of `side` advances, in rows. */
export const forwardOf = (side: Side): number => (side === PLAYER ? -1 : 1);

/**
 * The opening position: three dark ranks each, the player nearest the reader
 * (§1). Deterministic — there is nothing to shuffle in this game, and the
 * seed exists only to pin the CPU's choices down (§4).
 */
export function initialBoard(): Board {
  const board: Piece[] = new Array<Piece>(CELL_COUNT).fill(EMPTY);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (!isDarkSquare(cell)) continue;
    const row = rowOf(cell);
    if (row <= 2) board[cell] = CPU_MAN;
    else if (row >= ROWS - 3) board[cell] = PLAYER_MAN;
  }
  return board;
}

/**
 * Whose turn a completed-turn count implies (§8). Turns strictly alternate in
 * this game — there is no pass — so the count and the side that opened say it
 * between them, and the turn never has to be saved.
 *
 * A sequence in progress does not disturb this: the counter advances when a
 * turn *ends*, so mid-sequence it still names the side holding the move.
 */
export const sideToMove = (moveCount: number, first: Side): Side =>
  moveCount % 2 === 0 ? first : opponentOf(first);

export interface PieceCounts {
  readonly player: number;
  readonly cpu: number;
  readonly playerKings: number;
  readonly cpuKings: number;
}

export function countPieces(board: Board): PieceCounts {
  let player = 0;
  let cpu = 0;
  let playerKings = 0;
  let cpuKings = 0;
  for (const piece of board) {
    if (piece === PLAYER_MAN) player += 1;
    else if (piece === PLAYER_KING) {
      player += 1;
      playerKings += 1;
    } else if (piece === CPU_MAN) cpu += 1;
    else if (piece === CPU_KING) {
      cpu += 1;
      cpuKings += 1;
    }
  }
  return { player, cpu, playerKings, cpuKings };
}

/**
 * A board that could have come from play: 64 known cells, nothing standing on
 * a light square, no man left un-crowned on the far edge, and neither side
 * over its twelve or already wiped out (§8).
 *
 * A side at zero is not merely unusual — the match ended when it happened, so
 * a saved board holding one could not have been saved mid-play.
 */
export function isValidBoard(board: Board): boolean {
  if (board.length !== CELL_COUNT) return false;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const piece = board[cell]!;
    if (piece === EMPTY) continue;
    if (piece !== PLAYER_MAN && piece !== CPU_MAN && piece !== PLAYER_KING && piece !== CPU_KING) {
      return false;
    }
    if (!isDarkSquare(cell)) return false;
    // A man that reached the far edge was crowned on arrival (§2), so one
    // standing there un-crowned is a position play cannot produce.
    if (piece === PLAYER_MAN && rowOf(cell) === promotionRowOf(PLAYER)) return false;
    if (piece === CPU_MAN && rowOf(cell) === promotionRowOf(CPU)) return false;
  }
  const { player, cpu } = countPieces(board);
  if (player === 0 || cpu === 0) return false;
  return player <= PIECES_PER_SIDE && cpu <= PIECES_PER_SIDE;
}
