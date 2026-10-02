/**
 * The records a released build actually wrote, read by today's validators
 * (graduation 2026-10-02, docs/RELEASE_CHECKLIST.md §0, docs/CROWN_GRID_RULES.md §11).
 *
 * Crown Grid reached players as a web-beta title before it joined the app, and
 * `app/gameKeys.test.ts` only pins the key *names*. From graduation on, the
 * shape of what is stored under them is a compatibility contract: the day a
 * schema here goes to v2, the only thing standing between a player and a
 * silently discarded board is a validator, and a validator is only proven by
 * data it did not generate itself. Building the payload from `defaultValue()`
 * or from `toPersisted(createSession())` would prove nothing — it would follow
 * the schema wherever the schema went.
 *
 * Provenance: captured, not generated. The published web build (pixapps-landing
 * 7e536db, built from simple-games 74b4e58) was played in headless Chromium
 * with every external request blocked, and the five strings below are what
 * Capacitor Preferences held afterwards, copied verbatim. Everything went
 * through the game's own UI — taps on the board, one drag stroke of ×, the Hint
 * and Back buttons, Quick Rules to the end — so the records are the game's, not
 * a fixture's. The play: Quick Rules finished (flags), Easy and Medium solved,
 * today's daily solved (stats, `dailyTimes`), Hard picked last (prefs), then a
 * second run of the daily and a Hard board each left mid-game through Back
 * (the two saved-game slots). Nothing here is hand-built.
 *
 * Against 74b4e58 (the build that wrote them), as of 2026-10-02
 * (`git rev-parse <rev>:apps/simple-games/src/games/crown-grid/<path>`):
 *   - storage/schemas.ts, storage/keys.ts and the whole game/ tree: identical
 *     blobs. The persisted shape and the board generator are the ones that
 *     wrote these strings.
 *   - storage/gamePersistence.ts: differs, by one change that is behaviour,
 *     not schema — 8a3a967 (2026-10-02, "the daily is today's one board").
 *     `loadSavedGames` now drops a daily slot whose date is not `today`. The
 *     daily slot below is therefore loaded with the date it was captured on
 *     passed in explicitly, and one test pins the new drop.
 *
 * The published build also had a Past Dailies screen, since removed; that is
 * UI, and every `dailyTimes` entry it could have written is read the same way.
 *
 * Do not regenerate these strings to make a change go green: a payload that has
 * to be rewritten is a payload existing players cannot load either. From now on
 * these records change only by migration (a `SchemaDef` version bump).
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  CROSS,
  CROWN,
  createDailySession,
  createDifficultySession,
  crownIndices,
  doMarkCross,
  doTap,
  encodeMarks,
  encodeRegions,
  encodeSolution,
} from '../game';
import { loadSavedGames, saveGame } from './gamePersistence';
import { CG_STORAGE_KEYS, flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

/** The local date the daily slot below was captured on. */
const CAPTURED_DAY = '2026-10-02';

/**
 * Capacitor Preferences, as it stood after: Quick Rules finished, an Easy and a
 * Medium board solved, today's daily solved, a second run of it suspended, and a
 * Hard board suspended with Hard the last difficulty picked.
 */
const RELEASED: Record<string, string> = {
  [CG_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [CG_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"hard"}',
  [CG_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,' +
    '"easy":{"played":1,"solved":1,"totalPlaySeconds":8,"bestSeconds":8},' +
    '"medium":{"played":3,"solved":2,"totalPlaySeconds":21,"bestSeconds":6},' +
    '"hard":{"played":1,"solved":0,"totalPlaySeconds":11,"bestSeconds":null},' +
    '"dailyTimes":{"2026-10-02":6}}',
  [CG_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"mode":"difficulty","seed":"crown-grid-hard-muqpno0m-28tcp",' +
    '"difficulty":"hard","dailyDate":null,"size":9,' +
    '"regions":"aaaaaccccbddacccccbddecccgcddeecciggdffeeciggdffheeiigffhhhhiigffhhhhiggffhhhiiii",' +
    '"solution":"306142857",' +
    '"marks":"...q.....q..............q...q...........................................xxxx.....",' +
    '"hintCount":2,"elapsedSeconds":11,"savedAt":1790930306699}',
  [CG_STORAGE_KEYS.dailyGame]:
    '{"schemaVersion":1,"mode":"daily","seed":"crown-grid-daily-2026-10-02",' +
    '"difficulty":"medium","dailyDate":"2026-10-02","size":8,' +
    '"regions":"aaaaaaccaabbaaccabbbbcccdbbbbccfddeecccfddddcccfgggdccchggggcchh",' +
    '"solution":"42503716",' +
    '"marks":"....q.....q..........q..................................x.......",' +
    '"hintCount":1,"elapsedSeconds":8,"savedAt":1790930294530}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the difficulty last picked, which is not the default', async () => {
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 1,
      difficulty: 'hard',
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 8, bestSeconds: 8 },
      // The daily is a Medium board, so it counts here as well: the first
      // Medium solve, today's daily solve, and a second run of the daily.
      medium: { played: 3, solved: 2, totalPlaySeconds: 21, bestSeconds: 6 },
      hard: { played: 1, solved: 0, totalPlaySeconds: 11, bestSeconds: null },
      dailyTimes: { [CAPTURED_DAY]: 6 },
    });
  });

  it('restores the suspended difficulty game down to the cell', async () => {
    const { difficulty } = await loadSavedGames(released(), CAPTURED_DAY);
    expect(difficulty).not.toBeNull();
    expect(difficulty!.mode).toBe('difficulty');
    expect(difficulty!.difficulty).toBe('hard');
    expect(difficulty!.dailyDate).toBeNull();
    expect(difficulty!.size).toBe(9);
    expect(difficulty!.seed).toBe('crown-grid-hard-muqpno0m-28tcp');
    expect(encodeRegions(difficulty!.regions)).toBe(
      'aaaaaccccbddacccccbddecccgcddeecciggdffeeciggdffheeiigffhhhhiigffhhhhiggffhhhiiii',
    );
    expect(encodeSolution(difficulty!.solution)).toBe('306142857');
    // Four crowns on the first four rows, then a drag of × along the last row's
    // first four cells (the stroke, which also marked the cell it began on).
    expect(encodeMarks(difficulty!.marks)).toBe(
      '...q.....q..............q...q...........................................xxxx.....',
    );
    expect(crownIndices(difficulty!.marks)).toEqual([3, 9, 24, 28]);
    expect([72, 73, 74, 75].map((index) => difficulty!.marks[index])).toEqual([
      CROSS,
      CROSS,
      CROSS,
      CROSS,
    ]);
    // Hints are counted, never limited; the count is part of the result card.
    expect(difficulty!.hintCount).toBe(2);
    // The seconds on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(difficulty!.elapsedSeconds).toBe(11);
    expect(difficulty!.status).toBe('playing');
  });

  it('restores the suspended daily down to the cell, on the day it was captured', async () => {
    const { daily } = await loadSavedGames(released(), CAPTURED_DAY);
    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.difficulty).toBe('medium');
    expect(daily!.dailyDate).toBe(CAPTURED_DAY);
    expect(daily!.size).toBe(8);
    expect(daily!.seed).toBe('crown-grid-daily-2026-10-02');
    expect(encodeRegions(daily!.regions)).toBe(
      'aaaaaaccaabbaaccabbbbcccdbbbbccfddeecccfddddcccfgggdccchggggcchh',
    );
    expect(encodeSolution(daily!.solution)).toBe('42503716');
    // Three crowns on the first three rows and one stray × on the last.
    expect(encodeMarks(daily!.marks)).toBe(
      '....q.....q..........q..................................x.......',
    );
    expect(crownIndices(daily!.marks)).toEqual([4, 10, 21]);
    expect(daily!.marks[56]).toBe(CROSS);
    expect(daily!.hintCount).toBe(1);
    expect(daily!.elapsedSeconds).toBe(8);
    expect(daily!.status).toBe('playing');
  });

  it('keeps both slots independent: each key names its own mode', async () => {
    const saved = await loadSavedGames(released(), CAPTURED_DAY);
    expect(saved.difficulty!.seed).not.toBe(saved.daily!.seed);
    expect(saved.difficulty!.mode).toBe('difficulty');
    expect(saved.daily!.mode).toBe('daily');
  });

  it('reads the boards the same generator makes from the same seeds', async () => {
    // game/ is byte-identical to the build that wrote these records, so the
    // seed is the whole board: a restored slot and a freshly generated one
    // agree, which is what makes "same board again" and resume exact (§9).
    const saved = await loadSavedGames(released(), CAPTURED_DAY);
    const daily = createDailySession(CAPTURED_DAY);
    expect(encodeRegions(daily.regions)).toBe(encodeRegions(saved.daily!.regions));
    expect(encodeSolution(daily.solution)).toBe(encodeSolution(saved.daily!.solution));
    const hard = createDifficultySession('hard', saved.difficulty!.seed);
    expect(encodeRegions(hard.regions)).toBe(encodeRegions(saved.difficulty!.regions));
    expect(encodeSolution(hard.solution)).toBe(encodeSolution(saved.difficulty!.solution));
  });
});

describe("the daily is today's board or nothing", () => {
  it('drops a daily slot left over from another day, record and all', async () => {
    // Behaviour added after the build that wrote these records (8a3a967): the
    // slot is data from yesterday, not a game to reopen. The difficulty slot,
    // which has no date, is untouched.
    const kv = released();
    const saved = await loadSavedGames(kv, '2026-10-03');
    expect(saved.daily).toBeNull();
    expect(saved.difficulty).not.toBeNull();
    expect(await kv.get(CG_STORAGE_KEYS.dailyGame)).toBeNull();
    expect(await kv.get(CG_STORAGE_KEYS.game)).toBe(RELEASED[CG_STORAGE_KEYS.game]);
  });

  it('keeps it on the day it was written', async () => {
    const kv = released();
    expect((await loadSavedGames(kv, CAPTURED_DAY)).daily).not.toBeNull();
    expect(await kv.get(CG_STORAGE_KEYS.dailyGame)).toBe(RELEASED[CG_STORAGE_KEYS.dailyGame]);
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [CG_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preferences default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [CG_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [CG_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no game to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({
      [CG_STORAGE_KEYS.game]: raw,
      [CG_STORAGE_KEYS.dailyGame]: raw,
    });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGames(kv, CAPTURED_DAY)).toEqual({ difficulty: null, daily: null });
  });

  it('discards a board that does not decode rather than repairing it', async () => {
    // A region string one cell short is not a smaller board — it is a record
    // from something that is not this game (§11).
    const regions = 'aaaaaaccaabbaaccabbbbcccdbbbbccfddeecccfddddcccfgggdccchggggcchh'.slice(0, -1);
    const kv = createMemoryKV({
      [CG_STORAGE_KEYS.dailyGame]: RELEASED[CG_STORAGE_KEYS.dailyGame]!.replace(
        'aaaaaaccaabbaaccabbbbcccdbbbbccfddeecccfddddcccfgggdccchggggcchh',
        regions,
      ),
    });
    expect((await loadSavedGames(kv, CAPTURED_DAY)).daily).toBeNull();
  });

  it('does not take a record in the other mode key for a game in this one', async () => {
    // The key says which slot a record is; a daily record under the
    // difficulty key is corrupt data, not an instruction to switch modes (§11).
    const kv = createMemoryKV({ [CG_STORAGE_KEYS.game]: RELEASED[CG_STORAGE_KEYS.dailyGame]! });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect((await loadSavedGames(kv, CAPTURED_DAY)).difficulty).toBeNull();
  });
});

describe('a suspended game comes back the way it was left', () => {
  it('survives the round trip through storage, in both slots', async () => {
    // Today's code saves, today's code loads: the second leg that the captured
    // strings above cannot be (they were written by the older build).
    let medium = createDifficultySession('medium', 'crown-grid-medium-round-trip');
    // Cell 0 to a crown (two taps), cell 9 round the whole cycle back to empty
    // (three), cell 18 to a ×.
    for (const index of [0, 0, 9, 9, 9, 18]) {
      const next = doTap(medium, index);
      expect(next, `tap ${index} did nothing`).not.toBeNull();
      medium = next!;
    }
    const crossed = doMarkCross(medium, [30, 31, 32]);
    expect(crossed).not.toBeNull();
    medium = { ...crossed!, hintCount: 3, elapsedSeconds: 47 };

    let daily = createDailySession(CAPTURED_DAY);
    for (const index of [5, 5]) daily = doTap(daily, index)!;
    daily = { ...daily, hintCount: 1, elapsedSeconds: 12 };

    const kv = createMemoryKV();
    await saveGame(medium, kv);
    await saveGame(daily, kv);
    const restored = await loadSavedGames(kv, CAPTURED_DAY);

    expect(restored.difficulty).toEqual(medium);
    expect(restored.daily).toEqual(daily);
    // Spelled out, so a change to toEqual's idea of "same" cannot hide a loss.
    expect(encodeMarks(restored.difficulty!.marks)).toBe(encodeMarks(medium.marks));
    expect(restored.difficulty!.marks[0]).toBe(CROWN);
    expect(restored.difficulty!.marks[9]).toBe(0);
    expect(restored.difficulty!.marks[18]).toBe(CROSS);
    expect(restored.difficulty!.hintCount).toBe(3);
    expect(restored.difficulty!.elapsedSeconds).toBe(47);
    expect(restored.daily!.dailyDate).toBe(CAPTURED_DAY);
    expect(restored.daily!.marks[5]).toBe(CROWN);
  });
});
