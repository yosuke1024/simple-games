/**
 * docs/ECHO_PADS_RULES.md §2, §7, §9: unlocks, the attempt counter (kept,
 * unlike Number Recall §8), the daily's first clear, and the stats rows.
 */
import { describe, expect, it } from 'vitest';
import {
  addRowSeconds,
  beginDailyRun,
  beginLevelRun,
  countRunEnd,
  countRunStart,
  emptyProgress,
  emptyStats,
  isUnlocked,
  recordDailyClear,
  recordLevelClear,
  statsRowFor,
  statsRowForLevel,
} from './progress';
import { createDailySession, createLevelSession, endPlayback, play, press } from './session';

describe('unlocks (§2)', () => {
  it('opens levels 1 and 12 and nothing else at first', () => {
    const p = emptyProgress();
    const open = Array.from({ length: 22 }, (_, i) => i + 1).filter((l) => isUnlocked(p, l));
    expect(open).toEqual([1, 12]);
    expect(isUnlocked(p, 0)).toBe(false);
    expect(isUnlocked(p, 23)).toBe(false);
  });

  it('opens the next level of the same tier on a clear, and only that one', () => {
    let p = recordLevelClear(emptyProgress(), 1);
    expect(isUnlocked(p, 2)).toBe(true);
    expect(isUnlocked(p, 3)).toBe(false);
    p = recordLevelClear(p, 11); // clearing the top of a tier opens nothing new
    expect(isUnlocked(p, 12)).toBe(true);
    expect(isUnlocked(p, 13)).toBe(false);
    expect(recordLevelClear(p, 1)).toBe(p);
  });

  it('refuses to begin a locked level', () => {
    expect(beginLevelRun(emptyProgress(), 2)).toBeNull();
    expect(beginLevelRun(emptyProgress(), 23)).toBeNull();
  });
});

describe('the attempt counter (§3, §9)', () => {
  it('gives a failed run’s retry the next attempt, and with it a new seed', () => {
    const first = beginLevelRun(emptyProgress(), 1)!;
    expect(first.attempt).toBe(0);
    let s = createLevelSession(1, first.attempt)!;
    s = endPlayback(play(s, 'normal')!)!;
    s = press(s, (s.sequence[0]! + 1) % 4)!;
    expect(s.status).toBe('failed');
    const retry = beginLevelRun(first.progress, 1)!;
    expect(retry.attempt).toBe(1);
    const next = createLevelSession(1, retry.attempt)!;
    expect(next.seed).not.toBe(s.seed);
    // A new seed is not a promise of a new sequence: level 1 has few, and the
    // retry drew the one just heard 4 times in attempts 0..499 (§9; sequence.test.ts
    // lists every such pair). This retry is not one of them.
    expect(next.sequence).not.toEqual(s.sequence);
  });

  it('uses the attempt up when the run starts, so reopening cannot give r0 back', () => {
    let p = emptyProgress();
    const attempts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const run = beginLevelRun(p, 12)!;
      attempts.push(run.attempt);
      p = run.progress;
    }
    expect(attempts).toEqual([0, 1, 2, 3, 4]);
    expect(p.nextAttempt[11]).toBe(5);
    expect(p.nextAttempt.filter((n) => n !== 0)).toEqual([5]);
  });

  it('counts the daily per day and starts a new day from 0', () => {
    let p = emptyProgress();
    const a = beginDailyRun(p, '2026-10-22');
    p = a.progress;
    const b = beginDailyRun(p, '2026-10-22');
    p = b.progress;
    const c = beginDailyRun(p, '2026-10-23');
    expect([a.attempt, b.attempt, c.attempt]).toEqual([0, 1, 0]);
    expect(c.progress.daily).toEqual({ date: '2026-10-23', nextAttempt: 1 });
    expect(createDailySession('2026-10-22', a.attempt)!.sequence).not.toEqual(
      createDailySession('2026-10-22', b.attempt)!.sequence,
    );
  });
});

describe('statistics (§9)', () => {
  it('keeps three rows, the daily apart from 6 pads', () => {
    expect(statsRowFor('level', 4)).toBe('pads4');
    expect(statsRowFor('level', 6)).toBe('pads6');
    expect(statsRowFor('daily', 6)).toBe('daily');
    expect(statsRowForLevel(11)).toBe('pads4');
    expect(statsRowForLevel(12)).toBe('pads6');
    expect(statsRowForLevel(0)).toBeNull();
  });

  it('counts starts, clears, failures and seconds', () => {
    let st = emptyStats();
    st = countRunStart(st, 'pads4');
    st = countRunStart(st, 'pads4');
    st = countRunEnd(st, 'pads4', 'failed');
    st = countRunEnd(st, 'pads4', 'cleared');
    st = addRowSeconds(st, 'pads4', 30);
    st = addRowSeconds(st, 'pads4', -5);
    st = addRowSeconds(st, 'pads4', Number.NaN);
    expect(st.rows.pads4).toEqual({ played: 2, cleared: 1, failed: 1, seconds: 30 });
    expect(st.rows.pads6).toEqual({ played: 0, cleared: 0, failed: 0, seconds: 0 });
  });

  it('records a daily on its first clear only', () => {
    let st = recordDailyClear(emptyStats(), '2026-10-23');
    st = recordDailyClear(st, '2026-10-22');
    const again = recordDailyClear(st, '2026-10-22');
    expect(again).toBe(st);
    expect(st.dailyDates).toEqual(['2026-10-22', '2026-10-23']);
  });
});
