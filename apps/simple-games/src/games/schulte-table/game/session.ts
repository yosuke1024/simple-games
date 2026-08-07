/**
 * SchulteSession — a pure, immutable snapshot of one round in progress:
 * the board, how far along the order the player is, and the counters. The
 * React layer only dispatches into these functions; all rules live here.
 *
 * There is no undo history, because there is no undo (§9): a tap is the claim
 * "I found it", and nothing about the board is hidden for an undo to restore.
 * There is no saved game either (§11) — a round is tens of seconds of held
 * attention, and attention does not survive being suspended.
 *
 * There is no clock on screen (§4); elapsed seconds are carried here for the
 * result screen and the statistics only.
 */
import { generateBoard } from './board';
import { DAILY_ORDER, DAILY_SIZE, dailySeed } from './daily';
import { clampLevel, levelSeed, orderForLevel, sizeForLevel } from './levels';
import { rankOf, targetAt } from './order';
import {
  cellCount,
  type GameMode,
  type GameStatus,
  type Order,
  type Size,
  type Values,
} from './types';

export interface SchulteSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  readonly order: Order;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for daily. */
  readonly level: number | null;
  /** N² numbers row-major — the board, which never changes during a round. */
  readonly values: Values;
  /** How far along the order the player is: 0 to N². */
  readonly tappedCount: number;
  /** Taps on the wrong live cell (§4). Counted, never punished. */
  readonly missCount: number;
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
}

function baseSession(
  mode: GameMode,
  seed: string,
  size: Size,
  order: Order,
  dailyDate: string | null,
  level: number | null,
): SchulteSession {
  return {
    mode,
    seed,
    size,
    order,
    dailyDate,
    level,
    values: generateBoard(seed, size),
    tappedCount: 0,
    missCount: 0,
    status: 'playing',
    elapsedSeconds: 0,
  };
}

/**
 * A fresh (or retried) level round — deterministic per level.
 *
 * The level is clamped here as well as inside the derivations, so the number
 * the session carries can never disagree with the board it was handed.
 */
export function createLevelSession(level: number): SchulteSession {
  const target = clampLevel(level);
  return baseSession(
    'level',
    levelSeed(target),
    sizeForLevel(target),
    orderForLevel(target),
    null,
    target,
  );
}

/** A fresh (or retried) daily round for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string): SchulteSession {
  return baseSession('daily', dailySeed(dateString), DAILY_SIZE, DAILY_ORDER, dateString, null);
}

/** Rebuilds the same board from scratch (Retry — the same board, §9). */
export function restartSession(session: SchulteSession): SchulteSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/** The number the player must tap next, or null once the round is finished. */
export function nextTarget(session: SchulteSession): number | null {
  if (session.status !== 'playing') return null;
  return targetAt(session.order, cellCount(session.size), session.tappedCount);
}

/** Whether the cell at `index` has already been tapped (§3: it stays visible). */
export function isTapped(session: SchulteSession, index: number): boolean {
  const value = session.values[index];
  if (value === undefined) return false;
  return rankOf(session.order, cellCount(session.size), value) < session.tappedCount;
}

export interface TapOutcome {
  readonly session: SchulteSession;
  /** True when the tap was the number the order was waiting for. */
  readonly hit: boolean;
}

/**
 * Taps a cell.
 *
 * Returns null when the tap does nothing at all: an already-tapped cell, an
 * index off the board, or a finished round. That is not the same as a miss —
 * tapping a cell you have already cleared is not getting the number wrong, so
 * it is not counted (§3).
 *
 * A miss returns a session too, because the miss counter moved; the caller can
 * tell the two apart by `hit`, and the UI stays silent either way (§3: an
 * illegal tap makes no sound, or players stop looking before they tap).
 */
export function tapCell(session: SchulteSession, index: number): TapOutcome | null {
  if (session.status !== 'playing') return null;
  const value = session.values[index];
  if (value === undefined) return null;

  const count = cellCount(session.size);
  if (rankOf(session.order, count, value) < session.tappedCount) return null;

  if (value !== targetAt(session.order, count, session.tappedCount)) {
    return { session: { ...session, missCount: session.missCount + 1 }, hit: false };
  }

  const tappedCount = session.tappedCount + 1;
  return {
    session: {
      ...session,
      tappedCount,
      status: tappedCount === count ? 'cleared' : 'playing',
    },
    hit: true,
  };
}
