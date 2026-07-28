/**
 * Pure level-progress and personal-best transitions (kept out of React for
 * unit testing). The personal ranking is local-only — no server, no upload.
 */
import { MAX_LEVEL, type GameSession } from '../game';
import { TOP_SCORES_LIMIT, type Progress, type TopScoreEntry } from '../storage/schemas';

export interface ClearOutcome {
  progress: Progress;
  /** True when this clear set (or first set) the best score for its board. */
  isNewBest: boolean;
  /** The best score for this level/date after the update. */
  bestScore: number;
}

/** Registers a cleared game: unlocks the next level and updates bests. */
export function applyClearToProgress(
  progress: Progress,
  session: GameSession,
  now: number,
): ClearOutcome {
  const score = session.score.total;
  const next = structuredClone(progress);

  let ref: string;
  let isNewBest: boolean;
  let bestScore: number;

  if (session.mode === 'level' && session.level !== null) {
    ref = String(session.level);
    next.highestUnlocked = Math.min(
      MAX_LEVEL,
      Math.max(next.highestUnlocked, session.level + 1),
    );
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

/** Sum of all level best scores — the quiet "total" shown in Statistics. */
export function totalBestScore(progress: Progress): number {
  return Object.values(progress.bestScores).reduce((sum, score) => sum + score, 0);
}
