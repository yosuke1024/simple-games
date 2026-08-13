/**
 * BubblePopSession — the level-flow state machine on top of engine.ts's pure
 * board mechanics: aim → fire → resolve, the shot count that drives the
 * ceiling's descent, retry, and the free current/next swap.
 *
 * Retry is identity, not a new roll (§7, same rule as every level game in
 * this collection): the same (seed, level) always deals the same board, so
 * `retrySession` just rebuilds from scratch. There is no mid-level save and
 * nothing here reads the clock or Math.random — the shot index is the only
 * thing standing in for "how far into this attempt are we", and it comes
 * from the caller's own history, not from time.
 */
import {
  crossesLossLine,
  isBoardCleared,
  nextCeilingOffset,
  placeAndResolve,
  simulateShot,
} from './engine';
import { buildBoard, remainingColors, supplyColorFor } from './generator';
import { levelSpec } from './levels';
import type { Board, BubbleColor, RunStatus, ShotResult } from './types';

export interface BubblePopSession {
  readonly seed: string;
  readonly level: number;
  readonly board: Board;
  /** How many rows the ceiling has dropped so far (§3). */
  readonly ceilingOffset: number;
  /** Shots left before the next ceiling drop — the dot row the UI renders. */
  readonly shotsUntilDescent: number;
  /** The supply stream's position (generator.ts's `supplyColorFor`). */
  readonly shotIndex: number;
  readonly current: BubbleColor;
  readonly next: BubbleColor;
  readonly status: RunStatus;
}

/** A fresh (or restarted) level session — deterministic per (seed, level). */
export function createSession(seed: string, level: number): BubblePopSession {
  const board = buildBoard(seed, level);
  const startingSupply = remainingColors(board);
  return {
    seed,
    level,
    board,
    ceilingOffset: 0,
    shotsUntilDescent: levelSpec(level).descentEvery,
    shotIndex: 2,
    current: supplyColorFor(seed, level, 0, startingSupply),
    next: supplyColorFor(seed, level, 1, startingSupply),
    status: 'playing',
  };
}

/** The same board again (§7) — identity is the only truth, so nothing to keep. */
export function retrySession(session: BubblePopSession): BubblePopSession {
  return createSession(session.seed, session.level);
}

/**
 * The trajectory guide (§8): the exact same simulation the real shot uses,
 * called on the exact same board reference `fireShot` reads from this
 * session — the sharing this game's rules are built around.
 */
export function aimGuide(session: BubblePopSession, angle: number): ShotResult {
  return simulateShot(session.board, session.ceilingOffset, angle);
}

/**
 * Fires the current bubble (§2): simulate, place, pop, drop, advance the
 * descent counter (dropping the ceiling if it hits zero), then check loss
 * and win before drawing the next supplied color. A shot while not
 * `'playing'` is a no-op — the level is over, and there is nothing left to
 * resolve.
 */
export function fireShot(session: BubblePopSession, angle: number): BubblePopSession {
  if (session.status !== 'playing') return session;

  const shot = simulateShot(session.board, session.ceilingOffset, angle);
  const outcome = placeAndResolve(session.board, shot.landingCell, session.current);

  let ceilingOffset = session.ceilingOffset;
  let shotsUntilDescent = session.shotsUntilDescent - 1;
  if (shotsUntilDescent <= 0) {
    ceilingOffset = nextCeilingOffset(ceilingOffset);
    shotsUntilDescent = levelSpec(session.level).descentEvery;
  }

  if (crossesLossLine(outcome.board, ceilingOffset)) {
    return { ...session, board: outcome.board, ceilingOffset, shotsUntilDescent, status: 'failed' };
  }
  if (isBoardCleared(outcome.board)) {
    return { ...session, board: outcome.board, ceilingOffset, shotsUntilDescent, status: 'cleared' };
  }

  const remaining = remainingColors(outcome.board);
  return {
    ...session,
    board: outcome.board,
    ceilingOffset,
    shotsUntilDescent,
    shotIndex: session.shotIndex + 1,
    current: session.next,
    next: supplyColorFor(session.seed, session.level, session.shotIndex, remaining),
    status: 'playing',
  };
}

/** Current ↔ next, free and unlimited (§8) — a no-op once the level has ended. */
export function swapNext(session: BubblePopSession): BubblePopSession {
  if (session.status !== 'playing') return session;
  return { ...session, current: session.next, next: session.current };
}
