/**
 * The saved game is its move list (docs/CHESS_RULES.md §7.1): one ASCII
 * string of UCI moves (`e2e4`, `e7e8q`) separated by single spaces, empty for
 * a game nobody has moved in yet.
 *
 * Reading it replays the list from the starting position with the same
 * engine and fails closed: a malformed token, a move the rules do not allow
 * there, a move after the game ended, more than `MAX_PLIES` moves, or any
 * spacing other than the one canonical form — and the save is discarded
 * rather than half-loaded (§7.1).
 *
 * The separator is not decoration. The bishop promotion letter `b` is also a
 * file letter, so without it "e7e8bb2b4" would only parse by looking ahead.
 */
import { createGame, findMove, playMove, type Game } from './record';
import {
  BISHOP,
  KNIGHT,
  MAX_PLIES,
  QUEEN,
  ROOK,
  moveFrom,
  movePromotion,
  moveTo,
  parseSquare,
  squareName,
  type Move,
} from './types';

const PROMOTION_LETTER: Record<number, string> = {
  [QUEEN]: 'q',
  [ROOK]: 'r',
  [BISHOP]: 'b',
  [KNIGHT]: 'n',
};
const PROMOTION_KIND: Record<string, number> = { q: QUEEN, r: ROOK, b: BISHOP, n: KNIGHT };

/** The longest text a valid save can be: every move five characters, single spaces. */
export const MAX_MOVE_LIST_LENGTH = MAX_PLIES * 6 - 1;

const TOKEN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** `e2e4`, or `e7e8q` for a promotion. */
export function moveToUci(move: Move): string {
  const promotion = movePromotion(move);
  return `${squareName(moveFrom(move))}${squareName(moveTo(move))}${
    promotion ? PROMOTION_LETTER[promotion] : ''
  }`;
}

export interface UciMove {
  readonly from: number;
  readonly to: number;
  /** The promotion kind, or 0. */
  readonly promotion: number;
}

/** Reads one token's shape; legality is the replay's job. */
export function parseUci(token: string): UciMove | null {
  if (!TOKEN.test(token)) return null;
  return {
    from: parseSquare(token.slice(0, 2)),
    to: parseSquare(token.slice(2, 4)),
    promotion: token.length === 5 ? PROMOTION_KIND[token[4]!]! : 0,
  };
}

export function encodeMoveList(moves: readonly Move[]): string {
  return moves.map(moveToUci).join(' ');
}

/** The two bounds a save is refused by before any move is replayed (§7.1). */
export interface MoveListBounds {
  readonly maxPlies: number;
  readonly maxLength: number;
}

const SAVE_BOUNDS: MoveListBounds = { maxPlies: MAX_PLIES, maxLength: MAX_MOVE_LIST_LENGTH };

/**
 * Replays a saved move list, or returns null when anything does not add up.
 * A game that ended on its last move is returned as such (with `outcome`
 * set); whether an ended game may be resumed is the caller's rule (§7.1).
 *
 * `bounds` is the save's (`MAX_PLIES`, `MAX_MOVE_LIST_LENGTH`) everywhere but
 * the tests: a legal game of 12,700 plies cannot be built in a test, so the
 * tests prove each refusal with smaller bounds.
 */
export function decodeMoveList(text: unknown, bounds: MoveListBounds = SAVE_BOUNDS): Game | null {
  if (typeof text !== 'string' || text.length > bounds.maxLength) return null;
  const game = createGame();
  if (text === '') return game;
  const tokens = text.split(' ');
  if (tokens.length > bounds.maxPlies) return null;
  for (const token of tokens) {
    // An empty token is a leading, trailing or doubled space; anything else
    // that is not a token (tabs, capitals, castling written as O-O) fails here.
    const parsed = parseUci(token);
    if (parsed === null || game.outcome !== null) return null;
    const move = findMove(game, parsed.from, parsed.to, parsed.promotion);
    if (move === null || !playMove(game, move)) return null;
  }
  return game;
}
