/**
 * The v1 → v2 progress migration (docs/SLIDING_PUZZLE_RULES.md §6, §10).
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
import { progressSchema, SP_STORAGE_KEYS } from './schemas';

const storedV1 = (record: Record<string, unknown>) =>
  createMemoryKV({
    [SP_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, ...record }),
  });

describe('progress v1 → v2', () => {
  it('resets level progress and keeps both daily records', async () => {
    const kv = storedV1({
      highestUnlocked: 412,
      bestMoves: { '1': 60, '411': 320 },
      bestSeconds: { '1': 240, '411': 900 },
      dailyMoves: { '2026-07-27': 90 },
      dailySeconds: { '2026-07-27': 300, '2026-07-28': 280 },
    });
    const progress = await loadRecord(progressSchema, kv);
    expect(progress.schemaVersion).toBe(2);
    expect(progress.highestUnlocked).toBe(1);
    expect(progress.bestMoves).toEqual({});
    expect(progress.bestSeconds).toEqual({});
    expect(progress.dailyMoves).toEqual({ '2026-07-27': 90 });
    expect(progress.dailySeconds).toEqual({ '2026-07-27': 300, '2026-07-28': 280 });
  });

  it('keeps the daily records even when the old level is far out of the new range', async () => {
    const kv = storedV1({
      highestUnlocked: 999,
      bestMoves: {},
      bestSeconds: {},
      dailyMoves: { '2026-07-27': 90 },
      dailySeconds: {},
    });
    expect((await loadRecord(progressSchema, kv)).dailyMoves).toEqual({ '2026-07-27': 90 });
  });

  it('still validates a v2 record normally', async () => {
    const kv = createMemoryKV({
      [SP_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 2,
        highestUnlocked: 40,
        bestMoves: { '12': 55 },
        bestSeconds: { '12': 200 },
        dailyMoves: {},
        dailySeconds: {},
      }),
    });
    const progress = await loadRecord(progressSchema, kv);
    expect(progress.highestUnlocked).toBe(40);
    expect(progress.bestMoves).toEqual({ '12': 55 });
  });

  it('falls back to defaults for a version it does not know', async () => {
    const kv = createMemoryKV({
      [SP_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 99 }),
    });
    expect(await loadRecord(progressSchema, kv)).toEqual(progressSchema.defaultValue());
  });
});
