/**
 * Pure statistics transitions (kept out of React for testing). A record per
 * opponent strength and no streak: the record is what you have done, not how
 * many days in a row you did it.
 *
 * Only a match that actually ended books a result. A match replaced by a new
 * one counted as played when it started, and counting it as lost as well would
 * make the statistics a scold.
 *
 * **There is no draw to book, unlike Hearts' twin.** A Ludo match ends the
 * instant one seat gets its fourth pawn home (docs/LUDO_RULES.md §2.8), so
 * there is exactly one winner and no second seat can be level with them — a
 * tie is unreachable rather than merely rare. What Ludo does have, and Hearts
 * does not, is an ending with no result at all: the roll cap (§2.7) stops a
 * match with nobody home, and that is neither a win nor a loss nor a draw.
 * `applyMatchEnd` books nothing for it on purpose — it was counted as played
 * when it started, which is the whole of what the rules ask for (§9), and
 * inventing a column for it would make `wins + losses + noContests = played`
 * look like an invariant when abandoned matches break it anyway.
 */
import type { Difficulty, MatchStatus } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Registers a started match. A **new** match only — resuming a suspended one
 * is not starting it, and the match it resumes was counted when it was dealt.
 */
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

/**
 * Books a finished match's result. A match still in progress books nothing,
 * and neither does one that reached the roll cap: `noContest` is an ending
 * without a result (§2.7), already counted in `played` when the match started.
 */
export function applyMatchEnd(stats: Stats, difficulty: Difficulty, status: MatchStatus): Stats {
  if (status !== 'won' && status !== 'lost') return stats;
  const next = clone(stats);
  if (status === 'won') next[difficulty].wins += 1;
  else next[difficulty].losses += 1;
  return next;
}
