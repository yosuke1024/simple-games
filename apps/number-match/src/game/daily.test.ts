import { describe, expect, it } from 'vitest';
import { dailySeed, dayDifference, localDateString } from './daily';

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

describe('dayDifference', () => {
  it('computes calendar day differences', () => {
    expect(dayDifference('2026-01-01', '2026-01-02')).toBe(1);
    expect(dayDifference('2026-01-01', '2026-01-01')).toBe(0);
    expect(dayDifference('2026-01-02', '2026-01-01')).toBe(-1);
    expect(dayDifference('2026-01-31', '2026-02-01')).toBe(1);
    expect(dayDifference('2025-12-31', '2026-01-01')).toBe(1);
  });
});
