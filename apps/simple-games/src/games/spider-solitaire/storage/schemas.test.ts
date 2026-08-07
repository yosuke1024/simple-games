/**
 * What the persisted records accept and what they refuse. Validators never
 * throw: anything they cannot vouch for comes back as the safe default, so a
 * corrupt file costs a player their record, never their app (§10).
 */
import { describe, expect, it } from 'vitest';
import { statsSchema } from './schemas';

describe('statsSchema (§9)', () => {
  const base = { schemaVersion: 1, perSuit: {}, totalPlaySeconds: 0 };

  it('keeps a day’s record separately for each difficulty', () => {
    const stats = statsSchema.validate({
      ...base,
      dailyResults: {
        '2026-08-07': { '1': { moves: 100, seconds: 600 }, '4': { moves: 150, seconds: 900 } },
      },
    });
    expect(stats?.dailyResults['2026-08-07']).toEqual({
      '1': { moves: 100, seconds: 600 },
      '4': { moves: 150, seconds: 900 },
    });
  });

  it('drops entries it cannot read, and the day with them if nothing is left', () => {
    const stats = statsSchema.validate({
      ...base,
      dailyResults: {
        '2026-08-07': { '1': { moves: 100, seconds: 600 }, '4': { moves: 'many' } },
        'not-a-date': { '1': { moves: 10, seconds: 10 } },
        '2026-08-06': { '3': { moves: 10, seconds: 10 } },
        '2026-08-05': {},
        '2026-08-04': 7,
      },
    });
    // A day left with nothing readable is not a day that was won, so it must
    // not survive as an empty shell and inflate the daily count (§6).
    expect(Object.keys(stats?.dailyResults ?? {})).toEqual(['2026-08-07']);
    expect(stats?.dailyResults['2026-08-07']).toEqual({ '1': { moves: 100, seconds: 600 } });
  });

  it('falls back to no dailies rather than failing the whole record', () => {
    expect(statsSchema.validate({ ...base, dailyResults: 'gone' })?.dailyResults).toEqual({});
    expect(statsSchema.validate({ ...base })?.dailyResults).toEqual({});
    expect(statsSchema.validate({ ...base, totalPlaySeconds: -1 })).toBeNull();
    expect(statsSchema.validate({ ...base, schemaVersion: 2 })).toBeNull();
    expect(statsSchema.validate(null)).toBeNull();
  });
});
