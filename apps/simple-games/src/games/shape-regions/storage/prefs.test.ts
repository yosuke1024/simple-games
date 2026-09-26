/**
 * The one record Shape Regions keeps across boards: the difficulty the home
 * screen leads with (§11). A record without the field is an older one, not a
 * broken one.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { SR_STORAGE_KEYS, flagsSchema, prefsSchema, statsSchema } from './schemas';

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
    const kv = createMemoryKV({ [SR_STORAGE_KEYS.flags]: 'not json at all' });
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'medium' }, kv);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('medium');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
  });
});

describe('storage keys', () => {
  it('all sit under the sr. prefix, apart from every other game', () => {
    for (const key of Object.values(SR_STORAGE_KEYS)) expect(key.startsWith('sr.')).toBe(true);
    expect(new Set(Object.values(SR_STORAGE_KEYS)).size).toBe(
      Object.values(SR_STORAGE_KEYS).length,
    );
  });
});

describe('statistics (§10)', () => {
  it('drops an unreadable day without losing the others', async () => {
    const kv = createMemoryKV({
      [SR_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        easy: { played: 3, solved: 2, totalPlaySeconds: 90, bestSeconds: 30 },
        medium: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        hard: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        dailyTimes: { '2026-08-03': 42, 'not-a-date': 10, '2026-08-04': 'soon' },
      }),
    });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.easy.played).toBe(3);
    expect(stats.dailyTimes).toEqual({ '2026-08-03': 42 });
    expect(Object.keys(stats)).not.toContain('streak');
  });
});
