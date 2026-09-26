/**
 * Pure statistics transitions (kept out of React for testing). A record per
 * difficulty and no streak: the record is what you have done, not how many
 * days in a row you did it (docs/HIT_AND_BLOW_RULES.md §7).
 *
 * Only a game that was actually solved books a result. A game replaced by a
 * new one counted as played when it started, and counting it as anything
 * more would make the statistics a scold (§7).
 */
import type { Difficulty } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (a new secret, not a resume). */
export function applyGameStart(stats: Stats, difficulty: Difficulty): Stats {
  const next = clone(stats);
  next[difficulty].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next.totalPlaySeconds += seconds;
  return next;
}

export interface SolveOutcome {
  readonly stats: Stats;
  /** The fewest guesses before this game, or null when there was none. */
  readonly previousBest: number | null;
  /** True when this game beat what the player had before. */
  readonly isNewBest: boolean;
  /** The fewest guesses after this game. */
  readonly best: number;
}

/**
 * Books a solve (§7): the count, the fewest guesses, and the guesses toward
 * the average. Play time is deliberately not touched — it accumulates
 * through `applyPlayTime` as the clock runs.
 */
export function applySolved(stats: Stats, difficulty: Difficulty, guesses: number): SolveOutcome {
  const next = clone(stats);
  const record = next[difficulty];
  const previousBest = record.bestGuesses;
  record.solved += 1;
  record.totalGuesses += guesses;
  const isNewBest = previousBest === null || guesses < previousBest;
  if (isNewBest) record.bestGuesses = guesses;
  return { stats: next, previousBest, isNewBest, best: record.bestGuesses ?? guesses };
}

/** The average guesses per solve, or null before the first solve (§7). */
export function averageGuesses(stats: Stats, difficulty: Difficulty): number | null {
  const record = stats[difficulty];
  return record.solved > 0 ? record.totalGuesses / record.solved : null;
}
