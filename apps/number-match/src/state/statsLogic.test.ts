import { describe, expect, it } from 'vitest';
import { createSession, type GameSession } from '../game';
import { statsSchema } from '../storage/schemas';
import { applyGameEnd, applyGameStart, effectiveDailyStreak } from './statsLogic';

function endedSession(overrides: Partial<GameSession>): GameSession {
  return { ...createSession('classic', 'stats-seed'), ...overrides };
}

describe('applyGameStart', () => {
  it('increments played per mode without mutating the input', () => {
    const stats = statsSchema.defaultValue();
    const next = applyGameStart(stats, 'classic');
    expect(next.classic.played).toBe(1);
    expect(stats.classic.played).toBe(0);
  });
});

describe('applyGameEnd', () => {
  it('records a classic clear with best time', () => {
    const stats = statsSchema.defaultValue();
    const s1 = applyGameEnd(
      stats,
      endedSession({ status: 'cleared', elapsedSeconds: 120 }),
    );
    expect(s1.classic.cleared).toBe(1);
    expect(s1.classic.bestClearSeconds).toBe(120);
    expect(s1.classic.totalPlaySeconds).toBe(120);
    const s2 = applyGameEnd(s1, endedSession({ status: 'cleared', elapsedSeconds: 90 }));
    expect(s2.classic.bestClearSeconds).toBe(90);
    const s3 = applyGameEnd(s2, endedSession({ status: 'cleared', elapsedSeconds: 200 }));
    expect(s3.classic.bestClearSeconds).toBe(90);
  });

  it('records game overs without touching clears', () => {
    const stats = applyGameEnd(
      statsSchema.defaultValue(),
      endedSession({ status: 'gameOver', elapsedSeconds: 60 }),
    );
    expect(stats.classic.gameOver).toBe(1);
    expect(stats.classic.cleared).toBe(0);
    expect(stats.classic.totalPlaySeconds).toBe(60);
  });

  it('starts a daily streak at 1 and extends it on consecutive days', () => {
    const day1 = endedSession({
      mode: 'daily',
      dailyDate: '2026-07-25',
      status: 'cleared',
      elapsedSeconds: 100,
    });
    const day2 = endedSession({
      mode: 'daily',
      dailyDate: '2026-07-26',
      status: 'cleared',
      elapsedSeconds: 100,
    });
    let stats = applyGameEnd(statsSchema.defaultValue(), day1);
    expect(stats.daily.streak).toBe(1);
    stats = applyGameEnd(stats, day2);
    expect(stats.daily.streak).toBe(2);
    expect(stats.daily.bestStreak).toBe(2);
    expect(stats.daily.lastCompletedDate).toBe('2026-07-26');
  });

  it('does not double-count the same daily date', () => {
    const day = endedSession({
      mode: 'daily',
      dailyDate: '2026-07-26',
      status: 'cleared',
      elapsedSeconds: 100,
    });
    let stats = applyGameEnd(statsSchema.defaultValue(), day);
    stats = applyGameEnd(stats, day);
    expect(stats.daily.streak).toBe(1);
    expect(stats.daily.cleared).toBe(2); // replays still count as cleared games
  });

  it('resets the streak after a gap', () => {
    const day1 = endedSession({
      mode: 'daily',
      dailyDate: '2026-07-20',
      status: 'cleared',
      elapsedSeconds: 100,
    });
    const day2 = endedSession({
      mode: 'daily',
      dailyDate: '2026-07-26',
      status: 'cleared',
      elapsedSeconds: 100,
    });
    let stats = applyGameEnd(statsSchema.defaultValue(), day1);
    stats = applyGameEnd(stats, day2);
    expect(stats.daily.streak).toBe(1);
    expect(stats.daily.bestStreak).toBe(1);
  });
});

describe('effectiveDailyStreak', () => {
  it('shows the stored streak today and the day after, 0 later', () => {
    const stats = statsSchema.defaultValue();
    stats.daily.streak = 4;
    stats.daily.lastCompletedDate = '2026-07-26';
    expect(effectiveDailyStreak(stats, '2026-07-26')).toBe(4);
    expect(effectiveDailyStreak(stats, '2026-07-27')).toBe(4);
    expect(effectiveDailyStreak(stats, '2026-07-28')).toBe(0);
  });

  it('is 0 with no completion yet', () => {
    expect(effectiveDailyStreak(statsSchema.defaultValue(), '2026-07-26')).toBe(0);
  });
});
