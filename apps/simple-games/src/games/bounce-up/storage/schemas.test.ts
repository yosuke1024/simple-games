/**
 * The three records (docs/BOUNCE_UP_RULES.md §5): what is written comes back
 * whole through the real save / load path (④), and what play could not have
 * produced — another version, a wrong type, a negative or fractional count, a
 * width that does not exist, a best above its own total, points with no run
 * counted — is refused whole, so `loadRecord` falls back to the default (⑤).
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord, saveRecord } from '@/storage/repo';
import {
  BO_STORAGE_KEYS,
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Prefs,
  type Stats,
} from './schemas';

const goodStats: Stats = {
  schemaVersion: 1,
  played: 12,
  best: { normal: 431, wide: 980 },
  total: { normal: 2200, wide: 1500 },
  totalPlaySeconds: 754,
};

describe('round trip (④)', () => {
  it('saves and loads every record unchanged', async () => {
    const kv = createMemoryKV();
    await saveRecord(statsSchema, goodStats, kv);
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    const prefs: Prefs = { schemaVersion: 1, width: 'wide' };
    await saveRecord(prefsSchema, prefs, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(goodStats);
    expect(await loadRecord(flagsSchema, kv)).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefs);
  });

  it('starts from the defaults: nothing played, Normal, Quick Rules unseen', async () => {
    const kv = createMemoryKV();
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      played: 0,
      best: { normal: 0, wide: 0 },
      total: { normal: 0, wide: 0 },
      totalPlaySeconds: 0,
    });
    expect(await loadRecord(prefsSchema, kv)).toEqual({ schemaVersion: 1, width: 'normal' });
    expect(await loadRecord(flagsSchema, kv)).toEqual({
      schemaVersion: 1,
      tutorialCompleted: false,
    });
  });

  it('declares exactly the three keys of §5, under the bo. prefix', () => {
    expect(Object.values(BO_STORAGE_KEYS)).toEqual(['bo.stats', 'bo.flags', 'bo.prefs']);
    expect([statsSchema.key, flagsSchema.key, prefsSchema.key]).toEqual([
      'bo.stats',
      'bo.flags',
      'bo.prefs',
    ]);
  });
});

describe('fail-closed (⑤)', () => {
  const badStats: Array<[string, unknown]> = [
    ['not an object', 'stats'],
    ['an array', [goodStats]],
    ['another version', { ...goodStats, schemaVersion: 2 }],
    ['no version', { ...goodStats, schemaVersion: undefined }],
    ['a negative count', { ...goodStats, played: -1 }],
    ['a fractional count', { ...goodStats, played: 1.5 }],
    ['a string count', { ...goodStats, totalPlaySeconds: '754' }],
    ['a missing width', { ...goodStats, best: { normal: 1 } }],
    ['a best that is not a number', { ...goodStats, best: { normal: 'x', wide: 0 } }],
    ['best as a number, not per width', { ...goodStats, best: 431 }],
    ['an infinite total', { ...goodStats, total: { normal: Infinity, wide: 0 } }],
    ['a best above its own total', { ...goodStats, best: { normal: 2201, wide: 980 } }],
    [
      'points with no run counted',
      { ...goodStats, played: 0, best: { normal: 0, wide: 0 }, total: { normal: 0, wide: 5 } },
    ],
  ];

  it.each(badStats)('refuses statistics with %s', (_label, raw) => {
    expect(statsSchema.validate(raw)).toBeNull();
  });

  it('accepts the record play produces, and a run counted with no points yet', () => {
    expect(statsSchema.validate(goodStats)).toEqual(goodStats);
    expect(
      statsSchema.validate({
        ...goodStats,
        played: 1,
        best: { normal: 0, wide: 0 },
        total: { normal: 0, wide: 0 },
      }),
    ).not.toBeNull();
  });

  it.each([
    ['an unknown width', { schemaVersion: 1, width: 'huge' }],
    ['no width', { schemaVersion: 1 }],
    ['another version', { schemaVersion: 2, width: 'wide' }],
    ['a width of the wrong case', { schemaVersion: 1, width: 'Wide' }],
  ])('refuses preferences with %s', (_label, raw) => {
    expect(prefsSchema.validate(raw)).toBeNull();
  });

  it('refuses flags that are not booleans', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 2, tutorialCompleted: true })).toBeNull();
  });

  it('falls back to the default record — whole — through the load path', async () => {
    const kv = createMemoryKV({
      [BO_STORAGE_KEYS.stats]: JSON.stringify({ ...goodStats, best: { normal: 9999, wide: 0 } }),
      [BO_STORAGE_KEYS.prefs]: '{not json',
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });
});
