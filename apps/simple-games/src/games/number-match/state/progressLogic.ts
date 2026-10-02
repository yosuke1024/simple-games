/**
 * Pure level-progress and personal-best transitions (kept out of React for
 * unit testing). The personal ranking is local-only — no server, no upload.
 */
import { MAX_LEVEL, type GameSession } from '../game';
import { TOP_SCORES_LIMIT, type Progress, type TopScoreEntry } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface ClearOutcome {
  progress: Progress;
  /** True when this clear set (or first set) the best score for its board. */
  isNewBest: boolean;
  /** The best score for this level/date after the update. */
  bestScore: number;
}

/**
 * Registers a cleared game: unlocks the next level and updates bests. A free
 * board (§11「フリープレイ」) has no level to unlock and no board to keep a
 * record for, so it leaves the climb and the calendar exactly as they were.
 */
export function applyClearToProgress(
  progress: Progress,
  session: GameSession,
  now: number,
): ClearOutcome {
  const score = session.score.total;
  if (session.mode === 'free') return { progress, isNewBest: false, bestScore: score };
  const next = clone(progress);

  let ref: string;
  let isNewBest: boolean;
  let bestScore: number;

  if (session.mode === 'level' && session.level !== null) {
    ref = String(session.level);
    next.highestUnlocked = Math.min(MAX_LEVEL, Math.max(next.highestUnlocked, session.level + 1));
    const previous = next.bestScores[ref];
    isNewBest = previous === undefined || score > previous;
    bestScore = Math.max(previous ?? 0, score);
    next.bestScores[ref] = bestScore;
  } else {
    // Dedicated per-date store: the top-10 list evicts entries, so it must
    // never be the source of truth for "did I beat today's best?".
    ref = session.dailyDate ?? '';
    const previous = next.bestDaily[ref];
    isNewBest = previous === undefined || score > previous;
    bestScore = Math.max(previous ?? 0, score);
    next.bestDaily[ref] = bestScore;
  }

  // Personal top-10: one entry per level/date (the best), sorted descending.
  const kept = next.topScores.find((e) => e.mode === session.mode && e.ref === ref);
  const entry: TopScoreEntry =
    kept && kept.score >= score ? kept : { mode: session.mode, ref, score, at: now };
  next.topScores = [
    ...next.topScores.filter((e) => !(e.mode === session.mode && e.ref === ref)),
    entry,
  ]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, TOP_SCORES_LIMIT);

  return { progress: next, isNewBest, bestScore };
}

/**
 * The record this run is measured against — the board's best before the run
 * is booked — or null when there is none yet (§12). Read before
 * `applyClearToProgress`, which is what moves the record. A free board has
 * no board to keep a record for, so nothing to be measured against (§11).
 */
export function previousBestFor(progress: Progress, session: GameSession): number | null {
  if (session.mode === 'level' && session.level !== null) {
    return progress.bestScores[String(session.level)] ?? null;
  }
  if (session.mode === 'daily' && session.dailyDate !== null) {
    return progress.bestDaily[session.dailyDate] ?? null;
  }
  return null;
}

/** How many of the hundred have a recorded best — the count under the Levels chip. */
export function solvedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestScores).length;
}

/** Sum of all level best scores — the quiet "total" shown in Statistics. */
export function totalBestScore(progress: Progress): number {
  return Object.values(progress.bestScores).reduce((sum, score) => sum + score, 0);
}
