/**
 * The suspended run, as the smallest record that brings it back exactly, and
 * the checks a record must pass to be brought back (docs/SNAKE_RULES.md §11):
 * conditions every position of real play meets — exact for a run that has
 * eaten nothing or whose whole history is still on its body, necessary only
 * for the rest, as §11 lists.
 *
 * What is kept: seed, speed, the body, the food, the score, the move count,
 * the running seconds, and — only when a paused run has one — the heading
 * chosen for its first move after Resume (§5). What is not, because it is
 * fixed by what is kept or by the rules: the heading (neck → head), the food
 * draw count (score + 1, §8), the rest of the queue (a running run's turns in
 * flight are dropped exactly as Pause drops them, §6), and the status (a
 * restored run is always paused, §6).
 *
 * The body is two base-36 characters per cell, head first: '2g2f2e' is the
 * opening snake. Fixed width, so a cell can never be read across a boundary,
 * and every character is checked rather than left to parseInt's leniency.
 *
 * Decoding fails closed and never throws, whatever it is handed: anything
 * that does not add up is null, and the caller lands the player on the
 * game's home rather than quietly dealing a new run (§11).
 */
import { directionBetween, headingOf, isValidBody } from './engine';
import { drawFood } from './food';
import { canReachTail, replayMatches } from './history';
import {
  CELL_COUNT,
  INITIAL_BODY,
  INITIAL_LENGTH,
  isCell,
  isDirection,
  isReverse,
  isSpeed,
  type Direction,
  type Speed,
} from './types';
import { isSuspendable, pendingHeading, type SnakeSession } from './session';

/** The pure half of the saved record; storage adds the schema version and `savedAt`. */
export interface SnakeSnapshot {
  readonly seed: string;
  readonly speed: Speed;
  /** Two base-36 characters per cell, head first. */
  readonly body: string;
  readonly food: number;
  readonly score: number;
  readonly ticks: number;
  /** Whole seconds (§10). */
  readonly elapsedSeconds: number;
  /**
   * The heading a paused run will take on its first move after Resume (§5),
   * present only when one was chosen. Absent is "none", so a record written
   * without it reads exactly as before.
   */
  readonly next?: Direction;
}

/** The longest seed a record may carry — the same bound `asString` puts on every string. */
export const MAX_SEED_LENGTH = 200;

const CELL_TOKEN = /^[0-9a-z]{2}$/;

export function encodeBody(body: readonly number[]): string {
  return body.map((cell) => cell.toString(36).padStart(2, '0')).join('');
}

/** The cells of an encoded body, or null when the text is not one (§11). */
export function decodeBody(text: unknown): number[] | null {
  if (typeof text !== 'string' || text.length === 0 || text.length % 2 !== 0) return null;
  if (text.length > CELL_COUNT * 2) return null;
  const body: number[] = [];
  for (let i = 0; i < text.length; i += 2) {
    const token = text.slice(i, i + 2);
    if (!CELL_TOKEN.test(token)) return null;
    const cell = parseInt(token, 36);
    if (!isCell(cell)) return null;
    body.push(cell);
  }
  return body;
}

/**
 * The record for a run worth coming back to, or null for one that is not: a
 * board never started has nothing to resume, and a finished run is over —
 * the next one is free and starts fresh (§11).
 *
 * The running seconds are floored: the record holds whole seconds, and a
 * fraction from the clock must cost a second of statistics, never the run.
 */
export function toSnapshot(session: SnakeSession): SnakeSnapshot | null {
  if (!isSuspendable(session)) return null;
  const next = pendingHeading(session);
  return {
    seed: session.seed,
    speed: session.speed,
    body: encodeBody(session.body),
    food: session.food,
    score: session.score,
    ticks: session.ticks,
    elapsedSeconds: Math.floor(session.elapsedSeconds),
    ...(next === null ? {} : { next }),
  };
}

/**
 * The largest move count and running time a record may carry — the bound the
 * storage schema puts on them too (2048 uses the same `1e9` for its seconds).
 * A billion moves is three years of non-stop play at Fast, so no run reaches
 * it; below it, a count plus one is still exact.
 */
export const MAX_RECORD_COUNT = 1_000_000_000;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= MAX_RECORD_COUNT;

/**
 * Brings a saved run back, paused, or returns null when the record breaks one
 * of the conditions below (§11). They are rules of §3/§5/§8 read backwards.
 * Every position play reaches meets all of them (tested exhaustively for the
 * first moves and by sampling long runs, §16). For a record with nothing
 * eaten, or with its whole history on its body, they are also enough: every
 * other such record is refused. For the rest — most saves of a long run —
 * they are necessary only, and §11 says what is left unchecked.
 *
 * - the record is an object, and its counts are whole, non-negative and no
 *   larger than `MAX_RECORD_COUNT`;
 * - the body is a path on the board: every cell on it, none twice, each one
 *   step from the last, never wrapping a row;
 * - it is at least the opening length and is not the whole board (a full
 *   board is a finished run);
 * - its length is the opening length plus the score — every point is one
 *   cell, and nothing else ever grows the snake;
 * - the food is on the board and not under the snake;
 * - every point took at least one move (score ≤ ticks);
 * - with nothing eaten, the food is still the run's first draw — the one made
 *   for the opening body, which nothing but eating replaces (§8);
 * - the moves the body implies are legal (history.ts): replayed exactly from
 *   the opening when the body holds them all; otherwise the lost part must
 *   have been a walk that never turned straight back and, with nothing eaten,
 *   never stepped on the food;
 * - a heading chosen while paused (`next`, §5) is a direction other than the
 *   current heading and its reverse — the only choices `turn` keeps.
 *
 * Never throws, whatever it is handed.
 */
export function restoreSession(snapshot: unknown): SnakeSession | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  const {
    seed,
    speed,
    body: encoded,
    food,
    score,
    ticks,
    elapsedSeconds,
    next,
  } = snapshot as Partial<Record<keyof SnakeSnapshot, unknown>>;
  if (typeof seed !== 'string' || seed.length === 0 || seed.length > MAX_SEED_LENGTH) return null;
  if (!isSpeed(speed)) return null;
  if (!isCount(score) || !isCount(ticks) || !isCount(elapsedSeconds)) return null;

  const body = decodeBody(encoded);
  if (body === null || !isValidBody(body)) return null;
  if (body.length < INITIAL_LENGTH || body.length >= CELL_COUNT) return null;
  if (body.length !== INITIAL_LENGTH + score) return null;

  if (!isCell(food) || body.includes(food)) return null;

  // Every point took a move of its own, so a body can never outgrow its moves.
  if (score > ticks) return null;
  // Nothing eaten, nothing redrawn: the food is where the opening put it.
  if (score === 0 && food !== drawFood(seed, 0, INITIAL_BODY)) return null;

  if (ticks <= body.length) {
    if (!replayMatches(seed, body, score, food, ticks)) return null;
  } else {
    const tail = body[body.length - 1]!;
    const leaving = directionBetween(tail, body[body.length - 2]!);
    if (leaving === null) return null;
    const movesToTail = ticks - (body.length - 1);
    if (!canReachTail(tail, leaving, movesToTail, score === 0 ? food : -1)) return null;
  }

  const direction = headingOf(body);
  if (direction === null) return null;

  if (next !== undefined) {
    if (!isDirection(next) || next === direction || isReverse(direction, next)) return null;
  }

  return {
    seed,
    speed,
    status: 'paused',
    body,
    direction,
    queue: next === undefined ? [] : [next],
    food,
    foodDraws: score + 1,
    score,
    ticks,
    crash: null,
    elapsedSeconds,
  };
}
