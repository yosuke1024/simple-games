/**
 * How a game ends (docs/CHESS_RULES.md §3): checkmate, stalemate, the four
 * insufficient-material shapes, threefold repetition and the fifty-move rule,
 * judged in that order after every move. All draws are automatic — there is
 * no claim to make (§11).
 */
import { inCheck, type Position } from './engine';
import {
  BISHOP,
  BLACK,
  BOARD_SIZE,
  EMPTY,
  FIFTY_MOVE_PLIES,
  KING,
  KNIGHT,
  REPETITION_DRAW_COUNT,
  WHITE,
  isLightSquare,
  kindOf,
  type Outcome,
} from './types';

/**
 * The four shapes §3.3 draws on, and only those: K v K, K+B v K, K+N v K,
 * and kings with any bishops that all stand on one colour of square. FIDE's
 * wider "dead position" is not judged (§11).
 */
export function isInsufficientMaterial(position: Position): boolean {
  let knights = 0;
  let bishops = 0;
  let lightBishops = 0;
  for (let square = 0; square < BOARD_SIZE; square++) {
    const piece = position.board[square]!;
    if (piece === EMPTY) continue;
    const kind = kindOf(piece);
    if (kind === KING) continue;
    if (kind === KNIGHT) knights += 1;
    else if (kind === BISHOP) {
      bishops += 1;
      if (isLightSquare(square)) lightBishops += 1;
    } else return false; // a pawn, rook or queen can still mate
  }
  if (knights === 0) return lightBishops === 0 || lightBishops === bishops;
  return knights === 1 && bishops === 0;
}

/**
 * One position in a game's history, as the repetition rule compares it: the
 * key narrows, the signature decides (§3.4).
 */
export interface HistoryEntry {
  readonly hashHi: number;
  readonly hashLo: number;
  readonly signature: string;
}

/**
 * How many times the last entry's position has occurred, itself included.
 * Only the last `window` + 1 entries are looked at — positions before the
 * last pawn move or capture cannot come back (§3.4). Entries whose keys match
 * but whose signatures differ are a key collision and are not counted.
 */
export function countRepetitions(history: readonly HistoryEntry[], window: number): number {
  const last = history.length - 1;
  if (last < 0) return 0;
  const current = history[last]!;
  let count = 1;
  const stop = Math.max(0, last - window);
  for (let index = last - 1; index >= stop; index--) {
    const entry = history[index]!;
    if (entry.hashHi !== current.hashHi || entry.hashLo !== current.hashLo) continue;
    if (entry.signature === current.signature) count += 1;
  }
  return count;
}

/**
 * Whether the game is over after a move, given the position it left, whether
 * the side to move has any legal move, and how many times the position has
 * occurred (§3). The order is the rule: a mate on the hundredth quiet ply is
 * a mate.
 */
export function outcomeAfterMove(
  position: Position,
  hasMove: boolean,
  repetitions: number,
): Outcome | null {
  if (!hasMove) {
    if (inCheck(position)) {
      return { winner: position.side === WHITE ? BLACK : WHITE, reason: 'checkmate' };
    }
    return { winner: null, reason: 'stalemate' };
  }
  if (isInsufficientMaterial(position)) return { winner: null, reason: 'insufficient' };
  if (repetitions >= REPETITION_DRAW_COUNT) return { winner: null, reason: 'repetition' };
  if (position.halfmoveClock >= FIFTY_MOVE_PLIES) return { winner: null, reason: 'fifty' };
  return null;
}
