/**
 * The records a published build actually wrote, read by today's validators
 * (graduation 2026-10-02, docs/RELEASE_CHECKLIST.md §0, docs/DOMINOES_RULES.md §9).
 *
 * Dominoes left the web beta for the app on 2026-10-02 and its save schema is
 * frozen from here: `dm.flags`, `dm.stats` and `dm.saveGame` are all v1, and
 * from now on they change only by migration (`SchemaDef` version), never by
 * reinterpretation. A validator is only proven by data it did not generate
 * itself — building a payload from `defaultValue()` or `toPersisted()` would
 * follow the schema wherever the schema went — so the strings below are what
 * Capacitor Preferences held after real play, copied verbatim.
 *
 * Provenance: captured by driving the PUBLISHED web build (pixapps-landing
 * 7e536db, built from simple-games 74b4e58, served from its own public/ with
 * every external request blocked) in headless Chromium and clicking through
 * the game's own UI — the tutorial, then four games started, three played to
 * the end (one win, two losses), the fourth left mid-way with the Home button.
 * Nothing was written to storage by hand and no game internals were called.
 * There is no preferences record: this game has none (keys.ts). The shell's
 * own `sg.*` records are not this game's and are not included. All three
 * records are captured, none hand-built.
 *
 * Provenance of the code, `git rev-parse 74b4e58:<path> HEAD:<path>` at
 * graduation: `storage/schemas.ts`, `storage/keys.ts`,
 * `storage/gamePersistence.ts`, the whole `game/` tree and the whole
 * `storage/` tree are all IDENTICAL to what 74b4e58 built. (The 2026-10-02
 * "daily is today's one board" change touched other titles' persistence; this
 * game has no daily and was not touched.) So what the published build wrote
 * is what these strings are, read by the code that wrote them.
 *
 * Do not regenerate them to make a change go green: a payload that has to be
 * rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { CPU, encodeLine, encodeTiles, PLAYER, play } from '../game';
import { loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { DM_STORAGE_KEYS, flagsSchema, gameSchema, statsSchema } from './schemas';

/** Capacitor Preferences, as it stood after four games in the browser. */
const RELEASED: Record<string, string> = {
  [DM_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [DM_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"played":4,"wins":1,"losses":2,"draws":0,"totalPlaySeconds":30}',
  [DM_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"seed":"dominoes-muqq65x6-6vyp",' +
    '"line":[[5,6],[6,6],[6,4],[4,3],[3,1],[1,2],[2,2]],' +
    '"playerHand":[[0,0],[3,5],[4,4],[5,5]],"cpuHand":[[0,2],[0,4],[1,1]],' +
    '"boneyard":[[4,5],[0,3],[1,4],[1,6],[0,1],[0,6],[2,6],[3,6],[2,5],[2,3],[0,5],[3,3],[1,5],[2,4]],' +
    '"toMove":1,"passes":0,"moveCount":7,"elapsedSeconds":3,"savedAt":1790931161843}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      played: 4,
      wins: 1,
      losses: 2,
      draws: 0,
      totalPlaySeconds: 30,
    });
  });

  it('reads the saved-game record field by field', async () => {
    expect(await loadRecord(gameSchema, released())).toEqual({
      schemaVersion: 1,
      seed: 'dominoes-muqq65x6-6vyp',
      line: [
        [5, 6],
        [6, 6],
        [6, 4],
        [4, 3],
        [3, 1],
        [1, 2],
        [2, 2],
      ],
      playerHand: [
        [0, 0],
        [3, 5],
        [4, 4],
        [5, 5],
      ],
      cpuHand: [
        [0, 2],
        [0, 4],
        [1, 1],
      ],
      boneyard: [
        [4, 5],
        [0, 3],
        [1, 4],
        [1, 6],
        [0, 1],
        [0, 6],
        [2, 6],
        [3, 6],
        [2, 5],
        [2, 3],
        [0, 5],
        [3, 3],
        [1, 5],
        [2, 4],
      ],
      toMove: PLAYER,
      passes: 0,
      moveCount: 7,
      elapsedSeconds: 3,
      savedAt: 1790931161843,
    });
  });

  it('restores the suspended game down to the line, the hands and the boneyard order', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();
    // Line, left end to right end, each tile as it lies: 5–6 · 6–6 · 6–4 · 4–3 · 3–1 · 1–2 · 2–2.
    expect(session!.line.map((placed) => [placed.left, placed.right])).toEqual([
      [5, 6],
      [6, 6],
      [6, 4],
      [4, 3],
      [3, 1],
      [1, 2],
      [2, 2],
    ]);
    expect(session!.seed).toBe('dominoes-muqq65x6-6vyp');
    expect(session!.playerHand).toEqual([
      [0, 0],
      [3, 5],
      [4, 4],
      [5, 5],
    ]);
    expect(session!.cpuHand).toEqual([
      [0, 2],
      [0, 4],
      [1, 1],
    ]);
    // The boneyard keeps its drawing order: the next tile drawn is the one
    // that would have been drawn had the game never been put down (§9).
    expect(session!.boneyard).toHaveLength(14);
    expect(session!.boneyard[0]).toEqual([4, 5]);
    expect(session!.boneyard[13]).toEqual([2, 4]);
    expect(session!.toMove).toBe(PLAYER);
    expect(session!.passes).toBe(0);
    expect(session!.moveCount).toBe(7);
    // The minutes on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(session!.elapsedSeconds).toBe(3);
    expect(session!.status).toBe('playing');
    expect(session!.ending).toBeNull();
    // Derived, not stored: the opening comes back from the seed's deal (§2).
    expect(session!.opening.by).toBe(CPU);
    expect(session!.opening.tile).toEqual([6, 6]);
    expect(session!.playerPips).toBe(0 + 8 + 8 + 10);
    expect(session!.cpuPips).toBe(2 + 4 + 2);
  });

  it('is written back byte for byte by today’s code', async () => {
    // The strongest statement that the shape has not drifted: the record the
    // published build wrote is exactly what this code would write for the
    // position it describes.
    const session = await loadSavedGame(released());
    expect(JSON.stringify(toPersisted(session!, 1790931161843))).toBe(
      RELEASED[DM_STORAGE_KEYS.game],
    );
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [DM_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [DM_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no game to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [DM_STORAGE_KEYS.game]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a saved game whose position its seed did not deal', async () => {
    // Same record, different seed: the boneyard is no longer what that seed's
    // deal leaves, so this is not a game play could have produced (§9) and it
    // is dropped rather than resumed as some other game.
    const kv = createMemoryKV({
      [DM_STORAGE_KEYS.game]: RELEASED[DM_STORAGE_KEYS.game]!.replace(
        'dominoes-muqq65x6-6vyp',
        'dominoes-muqq65x6-zzzz',
      ),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('a suspended game comes back the way it was left', () => {
  it('survives the round trip through storage after one more move', async () => {
    const restored = await loadSavedGame(released());
    // The player holds 3–5 and the left end shows 5, so it fits there.
    const moved = play(restored!, PLAYER, [3, 5], 'left');
    expect(moved).not.toBeNull();
    expect(moved!.moveCount).toBe(8);
    expect(moved!.toMove).toBe(CPU);

    const kv = createMemoryKV({ ...RELEASED });
    await saveGame(moved!, kv);
    const again = await loadSavedGame(kv);

    expect(again).not.toBeNull();
    expect(encodeLine(again!.line)).toEqual(encodeLine(moved!.line));
    expect(encodeTiles(again!.playerHand)).toEqual(encodeTiles(moved!.playerHand));
    expect(encodeTiles(again!.cpuHand)).toEqual(encodeTiles(moved!.cpuHand));
    expect(again!.boneyard).toEqual(moved!.boneyard);
    expect(again!.toMove).toBe(CPU);
    expect(again!.moveCount).toBe(8);
    expect(again!.elapsedSeconds).toBe(3);
    expect(again!.status).toBe('playing');
  });

  it('keeps the statistics a released build wrote when today’s code saves them again', async () => {
    const kv = createMemoryKV({ ...RELEASED });
    const stats = await loadRecord(statsSchema, kv);
    await saveRecord(statsSchema, { ...stats, played: stats.played + 1, wins: stats.wins + 1 }, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      played: 5,
      wins: 2,
      losses: 2,
      draws: 0,
      totalPlaySeconds: 30,
    });
  });
});
