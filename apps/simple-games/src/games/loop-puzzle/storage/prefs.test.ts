/**
 * The records Loop Puzzle keeps besides its saved games (§10, §12): the
 * difficulty the home leads with, the Quick Rules flag, and the statistics.
 * A record without a field is an older one, not a broken one; one bad day in
 * the daily map costs only that day.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { flagsSchema, LP_STORAGE_KEYS, prefsSchema, statsSchema } from './schemas';

describe('prefs', () => {
  it('starts on easy', () => {
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
  });

  it('reads a record without the field as easy', () => {
    expect(prefsSchema.validate({ schemaVersion: 1 })).toEqual({
      schemaVersion: 1,
      difficulty: 'easy',
    });
  });

  it('keeps the difficulty that was chosen, and rejects one that is not a difficulty', () => {
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'hard' })?.difficulty).toBe('hard');
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'x' })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 2, difficulty: 'hard' })).toBeNull();
  });

  it('round-trips through the store and falls back on nonsense', async () => {
    const kv = createMemoryKV({ [LP_STORAGE_KEYS.flags]: 'not json at all' });
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'medium' }, kv);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('medium');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
  });
});

describe('flags', () => {
  it('round-trips, and refuses a flag that is not a boolean', async () => {
    const kv = createMemoryKV();
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
  });
});

describe('storage keys', () => {
  it('are exactly the five of §12, in the order of the keys leaf, all under lp.', () => {
    expect(Object.values(LP_STORAGE_KEYS)).toEqual([
      'lp.saveGame',
      'lp.saveDaily',
      'lp.stats',
      'lp.flags',
      'lp.prefs',
    ]);
    for (const key of Object.values(LP_STORAGE_KEYS)) expect(key.startsWith('lp.')).toBe(true);
  });
});

describe('statistics (§10)', () => {
  const bucket = { played: 3, solved: 2, totalPlaySeconds: 90, bestSeconds: 30 };
  const none = { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null };

  it('round-trips through the store', async () => {
    const kv = createMemoryKV();
    const stats = {
      schemaVersion: 1 as const,
      easy: bucket,
      medium: none,
      hard: none,
      dailyTimes: { '2026-10-17': 75 },
    };
    await saveRecord(statsSchema, stats, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);
  });

  it('drops an unreadable day without losing the others', async () => {
    const kv = createMemoryKV({
      [LP_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        easy: bucket,
        medium: none,
        hard: none,
        dailyTimes: {
          '2026-10-03': 42,
          'not-a-date': 10,
          '2026-10-04': 'soon',
          '2026-02-30': 50,
        },
      }),
    });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.easy.played).toBe(3);
    expect(stats.dailyTimes).toEqual({ '2026-10-03': 42 });
    expect(Object.keys(stats)).not.toContain('streak');
  });

  it('falls back to the default when a difficulty is broken', async () => {
    const kv = createMemoryKV({
      [LP_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        easy: { ...bucket, played: -1 },
        medium: none,
        hard: none,
        dailyTimes: {},
      }),
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });
});
