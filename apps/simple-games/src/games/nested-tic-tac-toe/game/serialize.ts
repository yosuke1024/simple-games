/**
 * The saved match, `nt.saveGame` v1 (docs/NESTED_TIC_TAC_TOE_RULES.md §8.1,
 * §8.2): its shape, how a session becomes one, and how one is read back.
 *
 * The record is the move list, not a board string — without the last move
 * the send rule cannot be restored (§8.1). Reading fails closed: anything off
 * — an unknown version, a wrong type, a number out of range or not an
 * integer, an empty seed, 82 moves or more, a move that was not legal where
 * it was played (a filled cell, a closed board, a board it was not sent to),
 * a move after the match had finished, or a list whose replay ends finished —
 * and the whole record is discarded, so the player goes home rather than into
 * an invented match (§8.2).
 *
 * Kept here, beside the rules it replays against, so the storage layer's
 * schema only has to call `parseSavedGame` (the reference games keep their
 * board codecs in game/ the same way). Pure: no storage imports.
 */
import { positionFromMoves } from './engine';
import { restoreSession, type NestedSession } from './session';
import { CELL_COUNT, isDifficulty, ONGOING, type Difficulty } from './types';

export const SAVED_GAME_VERSION = 1;
export const SEED_MAX_LENGTH = 64;
export const ELAPSED_SECONDS_MAX = 1e9;
export const SAVED_AT_MAX = 1e15;

export interface SavedGame {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly playerGoesFirst: boolean;
  readonly moves: readonly number[];
  readonly elapsedSeconds: number;
  readonly savedAt: number;
}

const isIntIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A whole number in 0…max: floored, clamped, and 0 for anything not finite (NaN would store as null). */
const wholeIn = (value: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;

/**
 * The record a session saves as (§8.1), or null for a finished match — that
 * is never saved; the slot is cleared instead. `elapsedSeconds` and `savedAt`
 * are written as whole numbers inside the ranges `parseSavedGame` accepts, so
 * the writer never produces a record its own reader would discard.
 */
export function toSavedGame(session: NestedSession, savedAt: number): SavedGame | null {
  if (session.status !== 'playing') return null;
  return {
    schemaVersion: SAVED_GAME_VERSION,
    seed: session.seed,
    difficulty: session.difficulty,
    playerGoesFirst: session.playerGoesFirst,
    moves: [...session.moves],
    elapsedSeconds: wholeIn(session.elapsedSeconds, ELAPSED_SECONDS_MAX),
    savedAt: wholeIn(savedAt, SAVED_AT_MAX),
  };
}

/**
 * A move list's shape and legality (§8.2): an array of at most 81 integer
 * cells that replays legally from the empty board and ends unfinished. Null
 * otherwise.
 */
export function parseMoves(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length > CELL_COUNT) return null;
  const moves: number[] = [];
  for (const cell of raw) {
    if (!isIntIn(cell, 0, CELL_COUNT - 1)) return null;
    moves.push(cell);
  }
  const position = positionFromMoves(moves);
  if (position === null || position.result !== ONGOING) return null;
  return moves;
}

/** Validates an unknown value as a v1 saved match (§8.1, §8.2). Never throws. */
export function parseSavedGame(raw: unknown): SavedGame | null {
  if (!isRecord(raw) || raw.schemaVersion !== SAVED_GAME_VERSION) return null;
  const { seed, difficulty, playerGoesFirst, elapsedSeconds, savedAt } = raw;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > SEED_MAX_LENGTH) return null;
  if (!isDifficulty(difficulty)) return null;
  if (typeof playerGoesFirst !== 'boolean') return null;
  if (!isIntIn(elapsedSeconds, 0, ELAPSED_SECONDS_MAX)) return null;
  if (!isIntIn(savedAt, 0, SAVED_AT_MAX)) return null;
  const moves = parseMoves(raw.moves);
  if (moves === null) return null;
  return {
    schemaVersion: SAVED_GAME_VERSION,
    seed,
    difficulty,
    playerGoesFirst,
    moves,
    elapsedSeconds,
    savedAt,
  };
}

/** The session a validated record resumes as — Undo included, since the list is the history (§5, §8.3). */
export function sessionFromSavedGame(saved: SavedGame): NestedSession | null {
  return restoreSession(saved);
}
