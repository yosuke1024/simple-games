/**
 * Storage validators never throw and never hand a caller a half-valid record:
 * corrupt data yields the schema default instead (§12). These tests feed them
 * the shapes a real device produces — an interrupted write, an older build's
 * record, a value out of range — because a game that cannot be opened after a
 * bad write is worse than a game that lost a best time.
 */
import { describe, expect, it } from 'vitest';
import { flagsSchema, progressSchema, statsSchema } from './schemas';

describe('flags', () => {
  it('accepts a well-formed record', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('rejects junk rather than guessing', () => {
    expect(flagsSchema.validate(null)).toBeNull();
    expect(flagsSchema.validate('nope')).toBeNull();
    expect(flagsSchema.validate([])).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 2, tutorialCompleted: true })).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
  });
});

describe('statistics', () => {
  const bucket = {
    played: 5,
    cleared: 2,
    totalPlaySeconds: 60,
    bestSeconds: 12,
    firstTryClears: 1,
  };

  it('round-trips a full record', () => {
    const record = { schemaVersion: 1, size3: bucket, size4: bucket, size5: bucket };
    expect(statsSchema.validate(record)).toEqual(record);
  });

  it('accepts a size that has never been played', () => {
    const empty = {
      played: 0,
      cleared: 0,
      totalPlaySeconds: 0,
      bestSeconds: null,
      firstTryClears: 0,
    };
    const record = { schemaVersion: 1, size3: empty, size4: empty, size5: empty };
    expect(statsSchema.validate(record)?.size3.bestSeconds).toBeNull();
  });

  it('rejects a record missing a size bucket', () => {
    expect(statsSchema.validate({ schemaVersion: 1, size3: bucket, size4: bucket })).toBeNull();
  });

  it('rejects impossible numbers', () => {
    const bad = (patch: Record<string, unknown>) =>
      statsSchema.validate({
        schemaVersion: 1,
        size3: { ...bucket, ...patch },
        size4: bucket,
        size5: bucket,
      });
    expect(bad({ played: -1 })).toBeNull();
    expect(bad({ played: 1.5 })).toBeNull();
    expect(bad({ firstTryClears: 'some' })).toBeNull();
    expect(bad({ bestSeconds: 'fast' })).toBeNull();
  });

  it('defaults to an untouched record', () => {
    const value = statsSchema.defaultValue();
    expect(value.size3.played).toBe(0);
    expect(value.size5.bestSeconds).toBeNull();
    expect(value.size4.firstTryClears).toBe(0);
  });
});

describe('progress', () => {
  it('round-trips a full record', () => {
    const record = {
      schemaVersion: 1,
      highestUnlocked: 12,
      bestSeconds: { '1': 9, '11': 40 },
      dailySeconds: { '2026-08-07': 33 },
    };
    expect(progressSchema.validate(record)).toEqual(record);
  });

  it('drops malformed entries instead of losing the whole record', () => {
    // One bad key must not cost a player their history.
    const value = progressSchema.validate({
      schemaVersion: 1,
      highestUnlocked: 5,
      bestSeconds: { '1': 9, '0': 4, '101': 4, abc: 7, '2': -1, '3': 12 },
      dailySeconds: { '2026-08-07': 33, 'not-a-date': 5, '2026-08-08': 'slow' },
    });
    expect(value?.bestSeconds).toEqual({ '1': 9, '3': 12 });
    expect(value?.dailySeconds).toEqual({ '2026-08-07': 33 });
    expect(value?.highestUnlocked).toBe(5);
  });

  it('keeps the better time when a level key appears twice', () => {
    // "042" and "42" are the same level; the record is the faster one.
    const value = progressSchema.validate({
      schemaVersion: 1,
      highestUnlocked: 50,
      bestSeconds: { '42': 30, '042': 18 },
      dailySeconds: {},
    });
    expect(value?.bestSeconds).toEqual({ '42': 18 });
  });

  it('rejects an out-of-range frontier rather than clamping it silently', () => {
    expect(
      progressSchema.validate({
        schemaVersion: 1,
        highestUnlocked: 999,
        bestSeconds: {},
        dailySeconds: {},
      }),
    ).toBeNull();
    expect(
      progressSchema.validate({
        schemaVersion: 1,
        highestUnlocked: 0,
        bestSeconds: {},
        dailySeconds: {},
      }),
    ).toBeNull();
  });

  it('starts a fresh install at level 1 with nothing recorded', () => {
    expect(progressSchema.defaultValue()).toEqual({
      schemaVersion: 1,
      highestUnlocked: 1,
      bestSeconds: {},
      dailySeconds: {},
    });
  });
});
