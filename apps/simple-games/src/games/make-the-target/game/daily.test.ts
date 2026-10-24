/**
 * The daily's dates and seeds (docs/MAKE_THE_TARGET_RULES.md §8).
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY, dailySeed, isLocalDateString, localDateString } from './daily';

describe('the daily (§8)', () => {
  it('is Medium every day, seeded by the local date', () => {
    expect(DAILY_DIFFICULTY).toBe('medium');
    expect(dailySeed('2026-10-21')).toBe('make-the-target-daily-2026-10-21');
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('knows a real calendar day', () => {
    expect(isLocalDateString('2028-02-29')).toBe(true);
    for (const bad of ['2027-02-29', '2026-13-01', '2026-1-01', '26-01-01', '', null, 20261021]) {
      expect(isLocalDateString(bad), String(bad)).toBe(false);
    }
  });

  it('steps whole days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-02-30', 1)).toBeNull();
    expect(addDays('2026-10-21', 0.5)).toBeNull();
  });
});
