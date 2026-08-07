/**
 * Storage validators never throw and never hand a caller a half-valid record:
 * corrupt data yields the schema default instead (§9). These tests feed them
 * the shapes a real device produces — an interrupted write, an older build's
 * record, a value out of range — because a game that cannot be opened after a
 * bad write is worse than a game that lost a best time.
 */
import { describe, expect, it } from 'vitest';
import { createLevelSession } from '../game';
import { loadSavedGames, saveGame, toPersisted } from './gamePersistence';
import { createMemoryKV } from '../../../storage/kv';
import {
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  progressSchema,
  QM_STORAGE_KEYS,
  STATS_BUCKETS,
  statsSchema,
} from './schemas';

describe('flags', () => {
  it('accepts a well-formed record and rejects junk', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(flagsSchema.validate(null)).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 2, tutorialCompleted: true })).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
  });
});

describe('statistics', () => {
  const bucket = {
    played: 3,
    cleared: 2,
    totalPlaySeconds: 120,
    bestSeconds: 41,
    totalMisses: 5,
  };
  const full = () => {
    const record: Record<string, unknown> = { schemaVersion: 1 };
    for (const name of STATS_BUCKETS) record[name] = { ...bucket };
    return record;
  };

  it('round-trips a full record, with a bucket for every band and the daily', () => {
    expect(statsSchema.validate(full())).toEqual(full());
    expect(STATS_BUCKETS).toEqual(['addSub', 'multiply', 'divide', 'missing', 'mixed', 'daily']);
  });

  it('rejects a record missing a bucket', () => {
    const record = full();
    delete record.divide;
    expect(statsSchema.validate(record)).toBeNull();
  });

  it('rejects impossible numbers', () => {
    const bad = (patch: Record<string, unknown>) => {
      const record = full();
      record.addSub = { ...bucket, ...patch };
      return statsSchema.validate(record);
    };
    expect(bad({ played: -1 })).toBeNull();
    expect(bad({ played: 1.5 })).toBeNull();
    expect(bad({ totalMisses: 'many' })).toBeNull();
    expect(bad({ bestSeconds: 'fast' })).toBeNull();
  });

  it('defaults to an untouched record', () => {
    const value = statsSchema.defaultValue();
    for (const name of STATS_BUCKETS) {
      expect(value[name].played).toBe(0);
      expect(value[name].bestSeconds).toBeNull();
    }
  });
});

describe('progress', () => {
  it('round-trips a full record', () => {
    const record = {
      schemaVersion: 1,
      highestUnlocked: 12,
      bestSeconds: { '1': 20, '11': 55 },
      dailySeconds: { '2026-08-07': 95 },
    };
    expect(progressSchema.validate(record)).toEqual(record);
  });

  it('drops malformed entries instead of losing the whole record', () => {
    const value = progressSchema.validate({
      schemaVersion: 1,
      highestUnlocked: 5,
      bestSeconds: { '1': 20, '0': 4, '101': 4, abc: 7, '2': -1, '3': 30 },
      dailySeconds: { '2026-08-07': 95, 'not-a-date': 5 },
    });
    expect(value?.bestSeconds).toEqual({ '1': 20, '3': 30 });
    expect(value?.dailySeconds).toEqual({ '2026-08-07': 95 });
  });

  it('rejects an out-of-range frontier rather than clamping it silently', () => {
    const record = { schemaVersion: 1, bestSeconds: {}, dailySeconds: {} };
    expect(progressSchema.validate({ ...record, highestUnlocked: 999 })).toBeNull();
    expect(progressSchema.validate({ ...record, highestUnlocked: 0 })).toBeNull();
  });
});

describe('a saved set (docs/QUICK_MATH_RULES.md §9)', () => {
  it('carries the seed and the index, and never the questions', () => {
    const session = createLevelSession(37);
    const persisted = toPersisted({ ...session, solvedCount: 4, missCount: 2 }, 1_700_000_000_000);

    expect(persisted).toEqual({
      schemaVersion: 1,
      mode: 'level',
      seed: 'qmath-level-37',
      dailyDate: null,
      level: 37,
      solvedCount: 4,
      missCount: 2,
      elapsedSeconds: 0,
      savedAt: 1_700_000_000_000,
    });
    // The questions are regenerated, so they must not be on disk at all.
    expect(JSON.stringify(persisted)).not.toContain('tokens');
  });

  it('comes back as the same set, on the same question', async () => {
    const kv = createMemoryKV();
    const session = { ...createLevelSession(37), solvedCount: 4, elapsedSeconds: 61 };
    await saveGame(session, kv);

    const loaded = await loadSavedGames(kv);
    expect(loaded.level?.level).toBe(37);
    expect(loaded.level?.solvedCount).toBe(4);
    expect(loaded.level?.elapsedSeconds).toBe(61);
    expect(loaded.level?.questions).toEqual(session.questions);
    expect(loaded.daily).toBeNull();
  });

  it('keeps the two modes in their own slots', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(3), kv);
    await saveGame({ ...createLevelSession(3), mode: 'daily', dailyDate: '2026-08-07' }, kv);

    const loaded = await loadSavedGames(kv);
    expect(loaded.level?.level).toBe(3);
    expect(loaded.daily?.dailyDate).toBe('2026-08-07');
  });

  it('refuses a record whose index is past the end of its set', async () => {
    // A save written by a build whose levels asked a different number of
    // questions. Dropping it costs one set; trusting it would put the game on
    // a question that does not exist.
    const kv = createMemoryKV({
      [QM_STORAGE_KEYS.game]: JSON.stringify({
        schemaVersion: 1,
        mode: 'level',
        seed: 'qmath-level-1',
        dailyDate: null,
        level: 1,
        solvedCount: 10,
        missCount: 0,
        elapsedSeconds: 5,
        savedAt: 1,
      }),
    });
    expect((await loadSavedGames(kv)).level).toBeNull();
  });

  it('rejects malformed records at the schema, before they reach the game', () => {
    const good = {
      schemaVersion: 1,
      mode: 'level',
      seed: 'qmath-level-1',
      dailyDate: null,
      level: 1,
      solvedCount: 3,
      missCount: 0,
      elapsedSeconds: 5,
      savedAt: 1,
    };
    expect(gameSchema.validate(good)).toEqual(good);
    expect(gameSchema.validate({ ...good, mode: 'endless' })).toBeNull();
    expect(gameSchema.validate({ ...good, seed: '' })).toBeNull();
    expect(gameSchema.validate({ ...good, level: 0 })).toBeNull();
    expect(gameSchema.validate({ ...good, solvedCount: -1 })).toBeNull();
    // A daily record has to name its date.
    expect(gameSchema.validate({ ...good, mode: 'daily', level: null })).toBeNull();
    expect(dailyGameSchema.defaultValue()).toBeNull();
  });
});
