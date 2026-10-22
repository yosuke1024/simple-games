/**
 * The records Pipe Link keeps across boards (docs/PIPE_LINK_RULES.md §7, §8):
 * flags, the remembered difficulty, the statistics — each fail-closed, none
 * able to take another game's key.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord, saveRecord } from '@/storage/repo';
import { PN_STORAGE_KEYS, flagsSchema, prefsSchema, statsSchema } from './schemas';

describe('storage keys', () => {
  it('all sit under the pn. prefix, and are the five §7 names', () => {
    expect(Object.values(PN_STORAGE_KEYS)).toEqual([
      'pn.saveGame',
      'pn.saveDaily',
      'pn.stats',
      'pn.flags',
      'pn.prefs',
    ]);
    for (const key of Object.values(PN_STORAGE_KEYS)) expect(key.startsWith('pn.')).toBe(true);
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
    const kv = createMemoryKV({ [PN_STORAGE_KEYS.flags]: '{"schemaVersion":1,' });
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
  });
});

describe('prefs (§7)', () => {
  it('remembers one thing — the difficulty — and starts at Easy', async () => {
    expect(prefsSchema.defaultValue()).toEqual({ schemaVersion: 1, difficulty: 'easy' });
    const kv = createMemoryKV();
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'hard' }, kv);
    expect(await loadRecord(prefsSchema, kv)).toEqual({ schemaVersion: 1, difficulty: 'hard' });
  });

  it('refuses a difficulty it does not have, and keeps nothing else', () => {
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'expert' })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1 })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'medium', wrap: true })).toEqual({
      schemaVersion: 1,
      difficulty: 'medium',
    });
  });
});

describe('statistics (§8)', () => {
  const good = {
    schemaVersion: 1,
    easy: { played: 3, solved: 2, totalPlaySeconds: 300, bestSeconds: 61 },
    medium: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
    hard: { played: 1, solved: 0, totalPlaySeconds: 40, bestSeconds: null },
    daily: { played: 2, totalPlaySeconds: 500 },
    dailyTimes: { '2026-10-21': 240 },
  };

  it('round-trips, with the daily kept apart from Medium', () => {
    expect(statsSchema.validate(good)).toEqual(good);
    expect(statsSchema.defaultValue().daily).toEqual({ played: 0, totalPlaySeconds: 0 });
  });

  it('refuses a bucket it cannot read', () => {
    expect(statsSchema.validate({ ...good, easy: { ...good.easy, played: -1 } })).toBeNull();
    expect(statsSchema.validate({ ...good, hard: { ...good.hard, bestSeconds: '9' } })).toBeNull();
    expect(statsSchema.validate({ ...good, daily: null })).toBeNull();
    expect(statsSchema.validate({ ...good, schemaVersion: 2 })).toBeNull();
  });

  it('drops one unreadable day and keeps the others', () => {
    const parsed = statsSchema.validate({
      ...good,
      dailyTimes: { '2026-10-21': 240, 'not-a-day': 5, '2026-10-22': -3, '2026-02-30': 9 },
    });
    expect(parsed?.dailyTimes).toEqual({ '2026-10-21': 240 });
  });

  it('keeps no turn count anywhere — turns are never recorded (§3)', () => {
    const parsed = statsSchema.validate({ ...good, easy: { ...good.easy, turns: 99 } });
    expect(parsed?.easy).toEqual(good.easy);
    expect(JSON.stringify(statsSchema.defaultValue())).not.toMatch(/turn|move|streak/i);
  });
});
