/**
 * The persistence round-trip (docs/RELEASE_CHECKLIST.md §0, and the reason
 * the board goldens are not enough): compatibility.test.ts pins generation
 * determinism, but says nothing about SAVED DATA surviving — the field
 * names, the pair encoding, the replay semantics. These payloads are actual
 * v1 records the game wrote, pasted as literals. If a change makes them stop
 * loading, every player's suspended game silently vanishes on update; this
 * test is what turns that into a red build instead. From here on, changes to
 * the schema are migrations against these fixtures, not edits to them.
 *
 * Loading goes through the public path — the store, the schema, the replay —
 * exactly the way a relaunch does.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { isStuck, remainingCount } from '../game';
import { loadSavedGames, toPersisted } from './gamePersistence';
import { dailyGameSchema, gameSchema, MJ_STORAGE_KEYS } from './schemas';

/**
 * A real `mj.saveGame` payload: level 3, four pairs removed, one hint used.
 * Written by v1 (2026-08-08). Do not regenerate to make a change pass.
 */
const LEVEL_PAYLOAD =
  '{"schemaVersion":1,"mode":"level","level":3,"dailyDate":null,' +
  '"removed":[[6,0,0,6,4,0],[4,0,0,0,2,0],[2,2,0,0,4,0],[0,8,0,2,4,1]],' +
  '"hintCount":1,"elapsedSeconds":187,"savedAt":1754640000000}';

/** A real `mj.saveDaily` payload: 2026-08-05, three pairs removed. */
const DAILY_PAYLOAD =
  '{"schemaVersion":1,"mode":"daily","level":null,"dailyDate":"2026-08-05",' +
  '"removed":[[6,0,0,8,0,0],[10,2,0,2,8,0],[8,2,0,12,20,0]],' +
  '"hintCount":0,"elapsedSeconds":64,"savedAt":1754640000000}';

const storeWith = (entries: Record<string, string>) => createMemoryKV(entries);

describe('v1 payloads keep loading (schema freeze)', () => {
  it('restores the level save: board, progress into it, and the counters', async () => {
    const { level } = await loadSavedGames(storeWith({ [MJ_STORAGE_KEYS.game]: LEVEL_PAYLOAD }));
    expect(level).not.toBeNull();
    expect(level!.mode).toBe('level');
    expect(level!.level).toBe(3);
    expect(level!.layout.id).toBe('sprout');
    expect(remainingCount(level!)).toBe(24 - 8);
    expect(level!.hintCount).toBe(1);
    expect(level!.elapsedSeconds).toBe(187);
    expect(level!.status).toBe('playing');
    expect(isStuck(level!)).toBe(false);
  });

  it('restores the daily save on the turtle', async () => {
    const { daily } = await loadSavedGames(
      storeWith({ [MJ_STORAGE_KEYS.dailyGame]: DAILY_PAYLOAD }),
    );
    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.dailyDate).toBe('2026-08-05');
    expect(daily!.layout.id).toBe('turtle');
    expect(remainingCount(daily!)).toBe(144 - 6);
    expect(daily!.elapsedSeconds).toBe(64);
  });

  it('round-trips: what the game writes today is byte-compatible', async () => {
    const { level } = await loadSavedGames(storeWith({ [MJ_STORAGE_KEYS.game]: LEVEL_PAYLOAD }));
    const rewritten = toPersisted(level!, 1754640000000);
    expect(rewritten).toEqual(JSON.parse(LEVEL_PAYLOAD));
  });
});

describe('fail-closed restore (§10)', () => {
  const levelWith = async (removed: unknown) => {
    const payload = JSON.stringify({ ...JSON.parse(LEVEL_PAYLOAD), removed });
    const { level } = await loadSavedGames(storeWith({ [MJ_STORAGE_KEYS.game]: payload }));
    return level;
  };

  it('discards a record whose pair was never free at its moment', async () => {
    // (2,4,1) is a raised tile pinning (2,4,0): taking the buried tile first
    // is a removal no play could produce. Shape-valid, replay-invalid.
    expect(await levelWith([[2, 4, 0, 4, 4, 0]])).toBeNull();
  });

  it('discards a pair whose faces do not match', async () => {
    // (0,0,0) and (6,8,0) are both free on the fresh sprout, but level 3
    // deals them different faces — a legal-looking step no play produced.
    expect(await levelWith([[0, 0, 0, 6, 8, 0]])).toBeNull();
  });

  it('discards coordinates outside the layout', async () => {
    expect(await levelWith([[58, 58, 7, 0, 0, 0]])).toBeNull();
  });

  it('discards the same tile removed twice', async () => {
    expect(
      await levelWith([
        [6, 0, 0, 6, 4, 0],
        [6, 0, 0, 6, 4, 0],
      ]),
    ).toBeNull();
  });

  it('rejects malformed pair entries at the schema', () => {
    const base = JSON.parse(LEVEL_PAYLOAD) as Record<string, unknown>;
    expect(gameSchema.validate({ ...base, removed: [[1, 2, 3]] })).toBeNull();
    expect(gameSchema.validate({ ...base, removed: [[0, 0, 0, 0, 0, -1]] })).toBeNull();
    expect(gameSchema.validate({ ...base, removed: 'nonsense' })).toBeNull();
    expect(
      gameSchema.validate({ ...base, removed: new Array(73).fill([0, 0, 0, 2, 0, 0]) }),
    ).toBeNull();
  });

  it('rejects an identity that does not cohere', () => {
    const base = JSON.parse(LEVEL_PAYLOAD) as Record<string, unknown>;
    expect(gameSchema.validate({ ...base, level: null })).toBeNull();
    expect(gameSchema.validate({ ...base, level: 101 })).toBeNull();
    expect(gameSchema.validate({ ...base, dailyDate: '2026-08-05' })).toBeNull();
    expect(
      dailyGameSchema.validate({ ...base, mode: 'daily', dailyDate: 'not-a-date', level: null }),
    ).toBeNull();
  });
});
