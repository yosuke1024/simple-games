/**
 * The records beside the saved runs (docs/ECHO_PADS_RULES.md §9): progress,
 * statistics, the Pace. Fail-closed — a record play could not have written
 * reads as the default — except the list of completed dailies, where one bad
 * date is dropped rather than costing every other day (Tangram's rule).
 */
import { describe, expect, it } from 'vitest';
import { beginLevelRun, emptyProgress, LEVEL_COUNT, recordLevelClear } from '../game';
import { prefsSchema, progressSchema, statsSchema } from './schemas';

const progressOf = (p: ReturnType<typeof emptyProgress>) => ({ schemaVersion: 1, ...p });

describe('ep.progress', () => {
  it('reads back what play writes', () => {
    const begun = beginLevelRun(emptyProgress(), 1)!.progress;
    const cleared = recordLevelClear(begun, 1);
    const record = progressOf({ ...cleared, daily: { date: '2026-10-22', nextAttempt: 3 } });
    expect(progressSchema.validate(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });

  it('refuses the wrong number of levels, and values of the wrong kind', () => {
    const base = progressOf(emptyProgress());
    expect(progressSchema.validate({ ...base, cleared: base.cleared.slice(1) })).toBeNull();
    expect(progressSchema.validate({ ...base, nextAttempt: [...base.nextAttempt, 0] })).toBeNull();
    expect(
      progressSchema.validate({ ...base, nextAttempt: base.nextAttempt.map(() => -1) }),
    ).toBeNull();
    expect(
      progressSchema.validate({ ...base, daily: { date: '2026-02-30', nextAttempt: 0 } }),
    ).toBeNull();
    expect(progressSchema.validate({ ...base, schemaVersion: 2 })).toBeNull();
  });

  it('refuses a clear play could not have made', () => {
    const base = progressOf(emptyProgress());
    // Level 3 cleared while level 2 — the one that opens it — is not.
    const cleared = base.cleared.slice();
    cleared[2] = true;
    const attempts = base.nextAttempt.map(() => 1);
    expect(progressSchema.validate({ ...base, cleared, nextAttempt: attempts })).toBeNull();
    // Level 1 cleared without a run ever started there.
    const first = base.cleared.slice();
    first[0] = true;
    expect(progressSchema.validate({ ...base, cleared: first })).toBeNull();
  });

  it('defaults to every level uncleared, attempt 0, no daily', () => {
    const value = progressSchema.defaultValue();
    expect(value.cleared).toHaveLength(LEVEL_COUNT);
    expect(value.nextAttempt.every((n) => n === 0)).toBe(true);
    expect(value.daily).toBeNull();
  });
});

describe('ep.stats', () => {
  const row = { played: 3, cleared: 1, failed: 1, seconds: 40 };
  const record = {
    schemaVersion: 1,
    rows: { pads4: row, pads6: row, daily: row },
    dailyDates: ['2026-10-21', '2026-10-22'],
  };

  it('reads back what play writes', () => {
    expect(statsSchema.validate(record)).toEqual(record);
  });

  it('refuses more endings than starts, and a missing row', () => {
    expect(
      statsSchema.validate({ ...record, rows: { ...record.rows, daily: { ...row, failed: 3 } } }),
    ).toBeNull();
    expect(statsSchema.validate({ ...record, rows: { pads4: row, pads6: row } })).toBeNull();
  });

  it('drops an unreadable or repeated date and keeps the rest, sorted', () => {
    const parsed = statsSchema.validate({
      ...record,
      dailyDates: ['2026-10-22', 'yesterday', '2026-10-21', '2026-10-22', 7],
    });
    expect(parsed?.dailyDates).toEqual(['2026-10-21', '2026-10-22']);
  });
});

describe('ep.prefs', () => {
  it('holds the Pace and nothing else, Normal by default', () => {
    expect(prefsSchema.defaultValue()).toEqual({ schemaVersion: 1, pace: 'normal' });
    expect(prefsSchema.validate({ schemaVersion: 1, pace: 'quick' })).toEqual({
      schemaVersion: 1,
      pace: 'quick',
    });
    expect(prefsSchema.validate({ schemaVersion: 1, pace: 'turbo' })).toBeNull();
  });
});
