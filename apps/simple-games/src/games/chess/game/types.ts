/**
 * Core Chess types. See docs/CHESS_RULES.md — the single source of truth for
 * the rules these shapes serve.
 *
 * Squares are numbered a1 = 0, b1 = 1, …, h8 = 63: rank-major from White's
 * side (§1). That numbering is the rules' and the save format's; the screen
 * turns the board round for a player who took Black, the numbers never move.
 *
 * A piece is its kind (1–6) plus a colour bit (8 for Black); 0 is empty. A
 * move is one integer (from, to, promotion and flags packed), so the search
 * and the perft walk never allocate a move object.
 */

export const BOARD_SIZE = 64;

export const WHITE = 0;
export const BLACK = 1;
export type Color = typeof WHITE | typeof BLACK;

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export type PieceKind =
  typeof PAWN | typeof KNIGHT | typeof BISHOP | typeof ROOK | typeof QUEEN | typeof KING;

/** The colour bit of a piece: set for Black. */
export const BLACK_BIT = 8;

/** A square's contents: 0, or a kind with or without the colour bit. */
export type Piece = number;

export const makePiece = (color: Color, kind: PieceKind): Piece =>
  color === BLACK ? kind | BLACK_BIT : kind;
export const kindOf = (piece: Piece): number => piece & 7;
export const colorOf = (piece: Piece): Color => (piece & BLACK_BIT ? BLACK : WHITE);
export const opponentOf = (color: Color): Color => (color === WHITE ? BLACK : WHITE);

export const fileOf = (square: number): number => square & 7;
export const rankOf = (square: number): number => square >> 3;
export const squareOf = (file: number, rank: number): number => rank * 8 + file;

/** The square's colour on a printed board: a1 is dark (§3, same-colour bishops). */
export const isLightSquare = (square: number): boolean =>
  (fileOf(square) + rankOf(square)) % 2 === 1;

const FILE_LETTERS = 'abcdefgh';

/** `e4` for square 28. */
export const squareName = (square: number): string =>
  `${FILE_LETTERS[fileOf(square)]}${rankOf(square) + 1}`;

/** The square named `e4`, or -1 when the text is not a square name. */
export function parseSquare(text: string): number {
  if (text.length !== 2) return -1;
  const file = FILE_LETTERS.indexOf(text[0]!);
  const rank = text.charCodeAt(1) - 49; // '1'
  if (file < 0 || rank < 0 || rank > 7) return -1;
  return squareOf(file, rank);
}

/** Castling rights, one bit each (§2.7). */
export const CASTLE_WHITE_KING = 1;
export const CASTLE_WHITE_QUEEN = 2;
export const CASTLE_BLACK_KING = 4;
export const CASTLE_BLACK_QUEEN = 8;
export const CASTLE_ALL = 15;

/*
 * Move packing: bits 0–5 from, 6–11 to, 12–14 promotion kind (0 none),
 * 15–18 flags. Everything a make/unmake needs that the board cannot tell it
 * afterwards is in the flags.
 */
export type Move = number;

export const FLAG_CAPTURE = 1;
export const FLAG_DOUBLE_PUSH = 2;
export const FLAG_EN_PASSANT = 4;
export const FLAG_CASTLE = 8;

export const encodeMove = (from: number, to: number, promotion = 0, flags = 0): Move =>
  from | (to << 6) | (promotion << 12) | (flags << 15);
export const moveFrom = (move: Move): number => move & 63;
export const moveTo = (move: Move): number => (move >> 6) & 63;
export const movePromotion = (move: Move): number => (move >> 12) & 7;
export const moveFlags = (move: Move): number => (move >> 15) & 15;
export const isCapture = (move: Move): boolean => (moveFlags(move) & FLAG_CAPTURE) !== 0;

/**
 * The order a promotion's four moves come in, and so the order of the picker
 * (queen first — §2.6, §4).
 */
export const PROMOTION_KINDS: readonly PieceKind[] = [QUEEN, ROOK, BISHOP, KNIGHT];

/**
 * Plies without a pawn move or a capture that draw the game: both sides' fifty
 * moves (§3.5). Checkers' `DRAW_QUIET_PLIES` is fifty plies — a different
 * count for a different rule.
 */
export const FIFTY_MOVE_PLIES = 100;

/** The occurrence of one position that draws the game (§3.4). */
export const REPETITION_DRAW_COUNT = 3;

/**
 * The longest game the save format accepts (§7.1). Arithmetic, not a
 * literature figure: at most 30 captures and 96 pawn moves (16 pawns × 6
 * steps) can reset the fifty-move count, and between resets at most 99 quiet
 * plies fit before the 100th ends the game, so 126 + 126 × 99 + 100 = 12,700.
 * No game the rules allow is longer, so the bound never refuses a real one.
 */
export const MAX_PLIES = 12_700;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

/** Why a game ended (§3). Kept apart from who won, so a mistranslated reason cannot flip the result (§10). */
export type EndReason = 'checkmate' | 'stalemate' | 'insufficient' | 'repetition' | 'fifty';

export interface Outcome {
  /** The winner's colour, or null for a draw. */
  readonly winner: Color | null;
  readonly reason: EndReason;
}
