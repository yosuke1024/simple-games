import { describe, expect, it } from 'vitest';
import {
  addDays,
  dailyDecorations,
  DAILY_DECORATIONS_FROM,
  dailySeed,
  dayDifference,
  localDateString,
} from './daily';

describe('localDateString', () => {
  it('formats the local date as YYYY-MM-DD with zero padding', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('dailySeed', () => {
  it('derives a deterministic seed from the date string', () => {
    expect(dailySeed('2026-07-26')).toBe('daily-2026-07-26');
    expect(dailySeed('2026-07-26')).toBe(dailySeed('2026-07-26'));
  });
});

describe('addDays', () => {
  it('steps forward and back across month and year boundaries', () => {
    expect(addDays('2026-07-28', 1)).toBe('2026-07-29');
    expect(addDays('2026-07-28', -1)).toBe('2026-07-27');
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is the inverse of dayDifference', () => {
    expect(dayDifference('2026-07-28', addDays('2026-07-28', 5))).toBe(5);
  });
});

describe('dayDifference', () => {
  it('computes calendar day differences', () => {
    expect(dayDifference('2026-01-01', '2026-01-02')).toBe(1);
    expect(dayDifference('2026-01-01', '2026-01-01')).toBe(0);
    expect(dayDifference('2026-01-02', '2026-01-01')).toBe(-1);
    expect(dayDifference('2026-01-31', '2026-02-01')).toBe(1);
    expect(dayDifference('2025-12-31', '2026-01-01')).toBe(1);
  });
});

describe('dailyDecorations (§16)', () => {
  it('leaves every day before the cutoff undecorated', () => {
    // Past dailies stay replayable and their best scores are already saved
    // (§14), so those boards have to keep the shape players scored against.
    for (const date of ['2026-07-31', '2026-01-01', '2025-06-15', '']) {
      expect(dailyDecorations(date)).toEqual({ stoneCount: 0, wildCount: 0 });
    }
    expect(dailyDecorations(addDays(DAILY_DECORATIONS_FROM, -1))).toEqual({
      stoneCount: 0,
      wildCount: 0,
    });
  });

  it('is deterministic per date, and within 0-2 of each from the cutoff on', () => {
    let decorated = 0;
    for (let day = 0; day < 90; day++) {
      const date = addDays(DAILY_DECORATIONS_FROM, day);
      const counts = dailyDecorations(date);
      expect(counts).toEqual(dailyDecorations(date));
      expect(counts.stoneCount).toBeGreaterThanOrEqual(0);
      expect(counts.stoneCount).toBeLessThanOrEqual(2);
      expect(counts.wildCount).toBeGreaterThanOrEqual(0);
      expect(counts.wildCount).toBeLessThanOrEqual(2);
      if (counts.stoneCount > 0 || counts.wildCount > 0) decorated++;
    }
    // Days vary, so most of them carry something without every day being alike.
    expect(decorated).toBeGreaterThan(45);
  });
});
