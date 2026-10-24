/**
 * The records Bridges keeps across boards (docs/BRIDGES_RULES.md §8, §10,
 * §11): flags, the remembered difficulty, the statistics — each fail-closed,
 * none able to take another game's key.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord, saveRecord } from '@/storage/repo';
import { BG_STORAGE_KEYS, flagsSchema, prefsSchema, statsSchema } from './schemas';

describe('storage keys', () => {
  it('all sit under the bg. prefix, and are the five §10 names', () => {
    expect(Object.values(BG_STORAGE_KEYS)).toEqual([
      'bg.saveGame',
      'bg.saveDaily',
      'bg.stats',
      'bg.flags',
      'bg.prefs',
    ]);
    for (const key of Object.values(BG_STORAGE_KEYS)) expect(key.startsWith('bg.')).toBe(true);
  });
});

describe('flags', () => {
  it('starts with Quick Rules not yet seen, and round-trips', async () => {
    expect(flagsSchema.defaultValue().tutorialCompleted).toBe(false);
    const kv = createMemoryKV();
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
  });

  it('falls back on anything it did not write', async () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 2, tutorialCompleted: true })).toBeNull();
    const kv = createMemoryKV({ [BG_STORAGE_KEYS.flags]: '{"schemaVersion":1,' });
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
  });
});

describe('prefs (§8)', () => {
  it('starts on easy, keeps a difficulty, and rejects one that is not', async () => {
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'hard' })?.difficulty).toBe('hard');
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'expert' })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1 })).toBeNull();
    const kv = createMemoryKV();
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'medium' }, kv);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('medium');
  });
});

describe('statistics (§11)', () => {
  const record = {
    schemaVersion: 1,
    easy: { played: 3, solved: 2, totalPlaySeconds: 90, bestSeconds: 30 },
    medium: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
    hard: { played: 1, solved: 0, totalPlaySeconds: 400, bestSeconds: null },
    daily: { played: 2, totalPlaySeconds: 200 },
    dailyTimes: { '2026-10-15': 42 },
  };

  it('round-trips, and keeps no streak', async () => {
    const kv = createMemoryKV({ [BG_STORAGE_KEYS.stats]: JSON.stringify(record) });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats).toEqual(record);
    expect(Object.keys(stats)).not.toContain('streak');
  });

  it('drops an unreadable day without losing the others', () => {
    const stats = statsSchema.validate({
      ...record,
      dailyTimes: { '2026-10-15': 42, 'not-a-date': 10, '2026-10-16': 'soon', '2026-10-17': -1 },
    });
    expect(stats?.dailyTimes).toEqual({ '2026-10-15': 42 });
  });

  it('refuses a record with a broken bucket, and the store falls back to zero', async () => {
    expect(statsSchema.validate({ ...record, daily: undefined })).toBeNull();
    expect(statsSchema.validate({ ...record, easy: { ...record.easy, played: -1 } })).toBeNull();
    expect(
      statsSchema.validate({ ...record, hard: { ...record.hard, bestSeconds: 'fast' } }),
    ).toBeNull();
    const kv = createMemoryKV({ [BG_STORAGE_KEYS.stats]: '{"schemaVersion":1}' });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });
});
