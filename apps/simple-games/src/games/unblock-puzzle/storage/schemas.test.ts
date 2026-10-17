/**
 * The records Unblock Puzzle keeps besides its saved games
 * (docs/UNBLOCK_PUZZLE_RULES.md §12): flags, the one preference, and the
 * statistics. Each is versioned, each validator fails closed to the default,
 * and none of them ever throws.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import {
  MAX_DAILY_ENTRIES,
  UB_STORAGE_KEYS,
  emptyDifficultyStats,
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Stats,
} from './schemas';

const stats = (patch: Partial<Stats> = {}): Stats => ({
  schemaVersion: 1,
  easy: {
    ...emptyDifficultyStats(),
    played: 3,
    solved: 2,
    optimal: 1,
    totalPlaySeconds: 90,
    bestSeconds: 30,
  },
  medium: emptyDifficultyStats(),
  hard: emptyDifficultyStats(),
  dailyMoves: { '2026-10-16': 12 },
  ...patch,
});

describe('storage keys', () => {
  it('are the five the rules document names, all under ub., apart from every other game', () => {
    expect(Object.values(UB_STORAGE_KEYS)).toEqual([
      'ub.saveGame',
      'ub.saveDaily',
      'ub.stats',
      'ub.flags',
      'ub.prefs',
    ]);
    for (const key of Object.values(UB_STORAGE_KEYS)) expect(key.startsWith('ub.')).toBe(true);
    // Never the Sliding Puzzle's (`sp.`): the two games share a shelf, not a record (§16).
    for (const key of Object.values(UB_STORAGE_KEYS)) expect(key.startsWith('sp.')).toBe(false);
  });
});

describe('flags', () => {
  it('start with Quick Rules unseen, and keep only a real boolean', () => {
    expect(flagsSchema.defaultValue()).toEqual({ schemaVersion: 1, tutorialCompleted: false });
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 2, tutorialCompleted: true })).toBeNull();
  });
});

describe('prefs (§9)', () => {
  it('start on easy and keep the difficulty last chosen', () => {
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'hard' })?.difficulty).toBe('hard');
  });

  it('refuse a difficulty that is not one, or another version', () => {
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'extreme' })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1 })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 2, difficulty: 'hard' })).toBeNull();
  });

  it('round-trip through the store, and fall back on nonsense without touching the others', async () => {
    const kv = createMemoryKV({ [UB_STORAGE_KEYS.flags]: 'not json at all' });
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'medium' }, kv);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('medium');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
  });
});

describe('statistics (§10)', () => {
  it('round-trip through the store', async () => {
    const kv = createMemoryKV();
    await saveRecord(statsSchema, stats(), kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats());
  });

  it('start empty, with no streak anywhere', () => {
    const empty = statsSchema.defaultValue();
    expect(empty.easy).toEqual(emptyDifficultyStats());
    expect(empty.dailyMoves).toEqual({});
    expect(JSON.stringify(empty)).not.toMatch(/streak/i);
  });

  it('drop an unreadable day without losing the others', () => {
    const read = statsSchema.validate({
      ...stats(),
      dailyMoves: { '2026-10-15': 11, 'not-a-date': 10, '2026-10-16': 'soon', '2026-10-17': 0 },
    });
    expect(read?.easy.played).toBe(3);
    expect(read?.dailyMoves).toEqual({ '2026-10-15': 11 });
  });

  it('keep at most the bounded number of days', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < MAX_DAILY_ENTRIES + 50; i++) {
      const day = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
      many[day] = 12;
    }
    const read = statsSchema.validate({ ...stats(), dailyMoves: many });
    expect(Object.keys(read?.dailyMoves ?? {})).toHaveLength(MAX_DAILY_ENTRIES);
  });

  it('fail closed on a broken row: the record falls back to the default', async () => {
    const broken = [
      { ...stats(), schemaVersion: 2 },
      { ...stats(), easy: { ...stats().easy, played: -1 } },
      { ...stats(), medium: { ...emptyDifficultyStats(), optimal: 'all' } },
      { ...stats(), hard: { ...emptyDifficultyStats(), bestSeconds: 1.5 } },
      { ...stats(), hard: null },
      { ...stats(), easy: { ...stats().easy, totalPlaySeconds: Number.NaN } },
    ];
    for (const value of broken) expect(statsSchema.validate(value)).toBeNull();
    const kv = createMemoryKV({ [UB_STORAGE_KEYS.stats]: '{"schemaVersion":1,"easy":' });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });
});
