/**
 * Pure statistics transitions (kept out of React for testing). Per board:
 * games begun, the fewest pegs left, perfect clears; overall: play time. No
 * streak — the record is what you have done, not how many days in a row you
 * did it (docs/PEG_SOLITAIRE_RULES.md §10).
 *
 * A game abandoned for another is not a loss: it counted as played when it
 * began, and only a game that actually ran out of jumps books a result.
 */
import type { BoardKind, Outcome } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a game begun on `kind`: a new board, a retry — never a resume. */
export function applyGameStart(stats: Stats, kind: BoardKind): Stats {
  const next = clone(stats);
  next[kind].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (!(seconds > 0)) return stats;
  const next = clone(stats);
  next.totalPlaySeconds += Math.floor(seconds);
  return next;
}

export interface GameEndBooking {
  readonly stats: Stats;
  /** The fewest left before this finish, or null when there was none. */
  readonly previousBest: number | null;
  /** True when this finish left fewer pegs than any finish before it. */
  readonly improved: boolean;
  /**
   * True when this finish is the game's first perfect clear — the one that
   * counts, in `perfect` and as a won game for the review question (§10).
   */
  readonly firstClear: boolean;
}

/**
 * Books a finished game (§10): `best = min(best, remaining)`, and a perfect
 * clear counts once per game. Any finish can be undone and the game finished
 * again (§6); each finish books `best` again — the min cannot count anything
 * twice, and a better finish after an Undo is a better finish — but `perfect`
 * grows only when `clearedBefore` is false: a clear undone and made again is
 * the same game's one clear. `played` is the start's to count, never a
 * finish's.
 */
export function applyGameEnd(
  stats: Stats,
  kind: BoardKind,
  outcome: Outcome,
  clearedBefore: boolean,
): GameEndBooking {
  const next = clone(stats);
  const previousBest = stats[kind].best;
  const improved = previousBest !== null && outcome.remaining < previousBest;
  if (previousBest === null || outcome.remaining < previousBest) {
    next[kind].best = outcome.remaining;
  }
  const firstClear = outcome.kind === 'perfect' && !clearedBefore;
  if (firstClear) next[kind].perfect += 1;
  return { stats: next, previousBest, improved, firstClear };
}
