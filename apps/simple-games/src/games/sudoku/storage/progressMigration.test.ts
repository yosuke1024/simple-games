/**
 * The v1 → v2 progress migration (docs/SUDOKU_RULES.md §9, §11).
 *
 * Cutting the ladder from 999 levels to 100 changed what a level number means
 * and every board behind it, so level progress is dropped rather than rescaled.
 * The daily calendar is a separate history that never depended on the level
 * list, and it has to survive the update intact — which is the part worth a
 * test, because the obvious way to write this migration loses it: a stored
 * `highestUnlocked` of 400 fails the new range check, and a validator that
 * returns null there throws the dailies away along with it.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { progressSchema, SD_STORAGE_KEYS } from './schemas';

const storedV1 = (record: Record<string, unknown>) =>
  createMemoryKV({
    [SD_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, ...record }),
  });

describe('progress v1 → v2', () => {
  it('resets level progress and keeps the daily times', async () => {
    const kv = storedV1({
      highestUnlocked: 412,
      bestTimes: { '1': 240, '411': 900 },
      dailyTimes: { '2026-07-27': 300, '2026-07-28': 280 },
    });
    const progress = await loadRecord(progressSchema, kv);
    expect(progress.schemaVersion).toBe(2);
    expect(progress.highestUnlocked).toBe(1);
    expect(progress.bestTimes).toEqual({});
    expect(progress.dailyTimes).toEqual({ '2026-07-27': 300, '2026-07-28': 280 });
  });

  it('keeps the daily times even when the old level is far out of the new range', async () => {
    const kv = storedV1({
      highestUnlocked: 999,
      bestTimes: {},
      dailyTimes: { '2026-07-27': 300 },
    });
    expect((await loadRecord(progressSchema, kv)).dailyTimes).toEqual({ '2026-07-27': 300 });
  });

  it('still validates a v2 record normally', async () => {
    const kv = createMemoryKV({
      [SD_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 2,
        highestUnlocked: 40,
        bestTimes: { '12': 200 },
        dailyTimes: { '2026-07-27': 300 },
      }),
    });
    const progress = await loadRecord(progressSchema, kv);
    expect(progress.highestUnlocked).toBe(40);
    expect(progress.bestTimes).toEqual({ '12': 200 });
  });

  it('falls back to defaults for a version it does not know', async () => {
    const kv = createMemoryKV({
      [SD_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 99 }),
    });
    expect(await loadRecord(progressSchema, kv)).toEqual(progressSchema.defaultValue());
  });
});
