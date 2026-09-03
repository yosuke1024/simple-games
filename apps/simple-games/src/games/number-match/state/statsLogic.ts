/**
 * Pure statistics transitions (kept out of React for unit testing).
 * Streak counters were removed with stats v3 — the daily record that remains
 * is progress.bestDaily, a calendar of days, not a chain to maintain.
 */
import type { GameMode, GameSession } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats, mode: GameMode): Stats {
  const next = clone(stats);
  next[mode].played += 1;
  return next;
}

/** Registers a finished game (cleared or game over). */
export function applyGameEnd(stats: Stats, session: GameSession): Stats {
  const next = clone(stats);
  const mode = next[session.mode];
  mode.totalPlaySeconds += session.elapsedSeconds;

  if (session.status === 'gameOver') {
    mode.gameOver += 1;
    return next;
  }
  if (session.status !== 'cleared') return next;

  mode.cleared += 1;
  if (mode.bestClearSeconds === null || session.elapsedSeconds < mode.bestClearSeconds) {
    mode.bestClearSeconds = session.elapsedSeconds;
  }
  return next;
}
