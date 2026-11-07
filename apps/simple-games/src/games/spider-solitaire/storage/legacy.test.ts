import { describe, expect, it } from 'vitest';
import { loadValidators } from '@/backup/owners';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord } from '@/storage/repo';
import { createFreeSession } from '../game';
import { loadSavedGames, saveGame, toPersisted } from './gamePersistence';
import { SS_STORAGE_KEYS } from './keys';
import { gameSchema, legacyGameSchema, statsSchema } from './schemas';

/** A whole original pack, in the original format; independent of the new deal. */
const classic = {
  schemaVersion: 1,
  mode: 'free',
  seed: 'ss-free-archived',
  suitCount: 4,
  dailyDate: null,
  stock: Array.from({ length: 50 }, (_, i) => i + 54),
  tableau: Array.from({ length: 10 }, (_, i) => ({
    down: i === 9 ? Array.from({ length: 44 }, (_, j) => j + 10) : [],
    up: [i],
  })),
  completed: [],
  moveCount: 12,
  hintCount: 2,
  elapsedSeconds: 89,
  savedAt: 123,
};

describe('104-card archives', () => {
  it('keeps legacy boards valid for backup, but never resumes them as Spiderette', async () => {
    const raw = JSON.stringify(classic);
    const oldStats = { ...statsSchema.defaultValue(), totalPlaySeconds: 1234 };
    const kv = createMemoryKV({
      [SS_STORAGE_KEYS.legacyGame]: raw,
      [SS_STORAGE_KEYS.legacyStats]: JSON.stringify(oldStats),
    });
    expect(legacyGameSchema.validate(classic)).toEqual(classic);
    expect(gameSchema.validate(classic)).toBeNull();
    expect(await loadSavedGames(kv)).toEqual({ free: null, daily: null });
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(0);
    const newSession = createFreeSession(1);
    await saveGame(newSession, kv);
    expect((await loadSavedGames(kv)).free?.board).toEqual(newSession.board);
    expect(await kv.get(SS_STORAGE_KEYS.legacyGame)).toBe(raw);
    expect(await kv.get(SS_STORAGE_KEYS.legacyStats)).toBe(JSON.stringify(oldStats));
  });

  it('registers every old and new key with its own backup validator', async () => {
    const owners = await loadValidators(Object.values(SS_STORAGE_KEYS));
    expect(owners.size).toBe(Object.values(SS_STORAGE_KEYS).length);
    expect(owners.get(SS_STORAGE_KEYS.legacyGame)!.validate(classic)).toEqual(classic);
    const daily = { ...classic, mode: 'daily', dailyDate: '2026-11-06' };
    expect(owners.get(SS_STORAGE_KEYS.legacyDailyGame)!.validate(daily)).toEqual(daily);
    expect(owners.get(SS_STORAGE_KEYS.legacyDailyGame)!.validate(classic)).toBeNull();
    const current = toPersisted(createFreeSession(1), 123);
    expect(owners.get(SS_STORAGE_KEYS.game)!.validate(current)).toEqual(current);
    expect(owners.get(SS_STORAGE_KEYS.legacyGame)!.validate(current)).toBeNull();
    expect(
      legacyGameSchema.validate({ ...classic, stock: [...classic.stock.slice(1), 55] }),
    ).toBeNull();
  });
});
