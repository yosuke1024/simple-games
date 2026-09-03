import { describe, expect, it } from 'vitest';
import {
  addDays,
  createDailySession,
  createFreeSession,
  createLevelSession,
  type GameSession,
} from '../game';
import { progressSchema } from '../storage/schemas';
import {
  applyClearToProgress,
  availableDailyDates,
  canPlayDaily,
  previousBestFor,
  solvedLevelCount,
  totalBestScore,
} from './progressLogic';

const NOW = 1_800_000_000_000;

function clearedLevel(level: number, total: number): GameSession {
  const session = createLevelSession(level);
  return { ...session, status: 'cleared', score: { ...session.score, total, matchPoints: total } };
}

function clearedDaily(date: string, total: number): GameSession {
  const session = createDailySession(date);
  return { ...session, status: 'cleared', score: { ...session.score, total, matchPoints: total } };
}

describe('applyClearToProgress', () => {
  it('unlocks the next level and records the first best', () => {
    const { progress, isNewBest, bestScore } = applyClearToProgress(
      progressSchema.defaultValue(),
      clearedLevel(1, 200),
      NOW,
    );
    expect(progress.highestUnlocked).toBe(2);
    expect(progress.bestScores['1']).toBe(200);
    expect(isNewBest).toBe(true);
    expect(bestScore).toBe(200);
    expect(progress.topScores).toHaveLength(1);
  });

  it('keeps the best score when a replay scores lower', () => {
    const first = applyClearToProgress(progressSchema.defaultValue(), clearedLevel(1, 200), NOW);
    const outcome = applyClearToProgress(first.progress, clearedLevel(1, 150), NOW + 1);
    expect(outcome.isNewBest).toBe(false);
    expect(outcome.progress.bestScores['1']).toBe(200);
    expect(outcome.progress.topScores[0]!.score).toBe(200);
    expect(outcome.progress.topScores).toHaveLength(1); // deduped per level
  });

  it('updates the best when a replay scores higher', () => {
    const first = applyClearToProgress(progressSchema.defaultValue(), clearedLevel(1, 200), NOW);
    const outcome = applyClearToProgress(first.progress, clearedLevel(1, 300), NOW + 1);
    expect(outcome.isNewBest).toBe(true);
    expect(outcome.progress.bestScores['1']).toBe(300);
  });

  it('never lowers highestUnlocked when replaying an old level', () => {
    const { progress } = applyClearToProgress(
      { ...progressSchema.defaultValue(), highestUnlocked: 50 },
      clearedLevel(3, 100),
      NOW,
    );
    expect(progress.highestUnlocked).toBe(50);
  });

  it('caps unlocking at the last level', () => {
    const { progress } = applyClearToProgress(
      { ...progressSchema.defaultValue(), highestUnlocked: 100 },
      clearedLevel(100, 100),
      NOW,
    );
    expect(progress.highestUnlocked).toBe(100);
  });

  it('keeps only the top 10 entries, best first', () => {
    let progress = progressSchema.defaultValue();
    for (let level = 1; level <= 12; level++) {
      progress = applyClearToProgress(
        progress,
        clearedLevel(level, level * 10),
        NOW + level,
      ).progress;
    }
    expect(progress.topScores).toHaveLength(10);
    expect(progress.topScores[0]!.score).toBe(120);
    expect(progress.topScores[9]!.score).toBe(30);
  });

  it('tracks daily bests in the ranking too', () => {
    const { progress, isNewBest } = applyClearToProgress(
      progressSchema.defaultValue(),
      clearedDaily('2026-07-27', 250),
      NOW,
    );
    expect(isNewBest).toBe(true);
    expect(progress.topScores[0]).toMatchObject({ mode: 'daily', ref: '2026-07-27', score: 250 });
    expect(progress.bestDaily['2026-07-27']).toBe(250);
    expect(progress.highestUnlocked).toBe(1); // dailies do not unlock levels
    expect(progress.bestScores).toEqual({});
  });

  it('judges daily replays against the per-date best, even when evicted from the top 10', () => {
    // Fill the top-10 with high level scores so the daily entry gets evicted.
    let progress = progressSchema.defaultValue();
    for (let level = 1; level <= 10; level++) {
      progress = applyClearToProgress(
        progress,
        clearedLevel(level, 1000 + level),
        NOW + level,
      ).progress;
    }
    const first = applyClearToProgress(progress, clearedDaily('2026-07-27', 200), NOW + 20);
    expect(first.isNewBest).toBe(true);
    expect(first.progress.topScores.some((e) => e.mode === 'daily')).toBe(false); // evicted
    // A worse same-day replay must NOT read as a new best.
    const replay = applyClearToProgress(first.progress, clearedDaily('2026-07-27', 150), NOW + 30);
    expect(replay.isNewBest).toBe(false);
    expect(replay.bestScore).toBe(200);
    // A better replay does.
    const better = applyClearToProgress(replay.progress, clearedDaily('2026-07-27', 260), NOW + 40);
    expect(better.isNewBest).toBe(true);
    expect(better.progress.bestDaily['2026-07-27']).toBe(260);
  });
});

describe('a free board (§11 フリープレイ)', () => {
  it('touches neither the level climb nor the daily calendar nor the ranking', () => {
    const before = applyClearToProgress(
      progressSchema.defaultValue(),
      clearedLevel(1, 200),
      NOW,
    ).progress;
    const free = createFreeSession('hard');
    const outcome = applyClearToProgress(
      before,
      { ...free, status: 'cleared', score: { ...free.score, total: 9999, matchPoints: 9999 } },
      NOW + 1,
    );
    expect(outcome.progress).toEqual(before);
    expect(outcome.isNewBest).toBe(false);
    expect(outcome.bestScore).toBe(9999);
  });
});

describe('previousBestFor', () => {
  it('is the record before the run, and null when there is none yet', () => {
    const fresh = progressSchema.defaultValue();
    expect(previousBestFor(fresh, clearedLevel(1, 200))).toBeNull();
    const { progress } = applyClearToProgress(fresh, clearedLevel(1, 200), NOW);
    // Read before the clear books it: still the old record, whatever this run scored.
    expect(previousBestFor(progress, clearedLevel(1, 350))).toBe(200);
    expect(previousBestFor(progress, clearedLevel(2, 100))).toBeNull();
  });

  it('reads a daily against its own date, and a free board against nothing', () => {
    const { progress } = applyClearToProgress(
      progressSchema.defaultValue(),
      clearedDaily('2026-07-27', 250),
      NOW,
    );
    expect(previousBestFor(progress, clearedDaily('2026-07-27', 100))).toBe(250);
    expect(previousBestFor(progress, clearedDaily('2026-07-26', 100))).toBeNull();
    expect(previousBestFor(progress, createFreeSession('easy'))).toBeNull();
  });
});

describe('solvedLevelCount', () => {
  it('counts the levels with a recorded best, replays included once', () => {
    let progress = progressSchema.defaultValue();
    expect(solvedLevelCount(progress)).toBe(0);
    progress = applyClearToProgress(progress, clearedLevel(1, 100), NOW).progress;
    progress = applyClearToProgress(progress, clearedLevel(2, 150), NOW).progress;
    progress = applyClearToProgress(progress, clearedLevel(1, 120), NOW).progress;
    expect(solvedLevelCount(progress)).toBe(2);
  });
});

describe('totalBestScore', () => {
  it('sums the level bests', () => {
    let progress = progressSchema.defaultValue();
    progress = applyClearToProgress(progress, clearedLevel(1, 100), NOW).progress;
    progress = applyClearToProgress(progress, clearedLevel(2, 150), NOW).progress;
    progress = applyClearToProgress(progress, clearedLevel(1, 120), NOW).progress;
    expect(totalBestScore(progress)).toBe(270);
  });
});

describe('daily backlog', () => {
  const TODAY = '2026-07-28';
  const withCleared = (...dates: string[]) => ({
    ...progressSchema.defaultValue(),
    bestDaily: Object.fromEntries(dates.map((d) => [d, 100])),
  });

  it('always allows today', () => {
    expect(canPlayDaily(progressSchema.defaultValue(), TODAY, TODAY)).toBe(true);
  });

  it('locks yesterday until today is cleared', () => {
    expect(canPlayDaily(progressSchema.defaultValue(), '2026-07-27', TODAY)).toBe(false);
    expect(canPlayDaily(withCleared(TODAY), '2026-07-27', TODAY)).toBe(true);
  });

  it('unlocks the backlog one step at a time', () => {
    const p = withCleared(TODAY, '2026-07-27');
    expect(canPlayDaily(p, '2026-07-26', TODAY)).toBe(true);
    expect(canPlayDaily(p, '2026-07-25', TODAY)).toBe(false);
  });

  it('never allows a future date', () => {
    expect(canPlayDaily(withCleared(TODAY), '2026-07-29', TODAY)).toBe(false);
  });

  it('lists the open dates newest first', () => {
    expect(availableDailyDates(progressSchema.defaultValue(), TODAY)).toEqual([TODAY]);
    expect(availableDailyDates(withCleared(TODAY), TODAY)).toEqual([TODAY, '2026-07-27']);
    expect(availableDailyDates(withCleared(TODAY, '2026-07-27'), TODAY)).toEqual([
      TODAY,
      '2026-07-27',
      '2026-07-26',
    ]);
  });

  it('stops at the listing limit even on a long streak', () => {
    const many = Array.from({ length: 60 }, (_, i) => addDays(TODAY, -i));
    expect(availableDailyDates(withCleared(...many), TODAY, 30)).toHaveLength(30);
  });

  it('agrees with canPlayDaily for every listed date', () => {
    const p = withCleared(TODAY, '2026-07-27', '2026-07-26');
    for (const date of availableDailyDates(p, TODAY)) {
      expect(canPlayDaily(p, date, TODAY)).toBe(true);
    }
  });
});
