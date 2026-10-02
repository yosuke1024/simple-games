/**
 * The records the published web build actually wrote, read by today's
 * validators (issue #170, docs/RELEASE_CHECKLIST.md §0, docs/NUMBER_PATH_RULES.md §9).
 *
 * Number Path graduated from the web-only beta into the app on 2026-10-02.
 * Until then its schema was free to change (the home carried a notice saying
 * so); from now on a player's board, bests and daily days are a compatibility
 * contract, and the only thing standing between them and a silently discarded
 * save is a validator. A validator is only proven by data it did not generate
 * itself, so building these payloads from `defaultValue()` or from the game's
 * own `toPersisted` would prove nothing — it would follow the schema wherever
 * the schema went.
 *
 * Provenance: CAPTURED, not hand-built. The strings below are what Capacitor
 * Preferences held after a script played the PUBLISHED web build (pixapps-landing
 * 7e536db, built from simple-games 74b4e58) in headless Chromium through the
 * game's own UI — clicks on Hint and on the cell it marks, no storage writes,
 * no calls into game internals — copied verbatim. What was played, on the
 * local date 2026-10-02: the tutorial, one Easy board solved (0:25), the daily
 * solved (0:31) and then retried and left after a few steps, a Medium board
 * chosen and left after a few steps. That writes all five keys the game owns.
 * (`medium.played` is 3: the daily and its retry count as Medium starts.)
 *
 * Provenance of the code that wrote them, by `git rev-parse <rev>:<path>`
 * (74b4e58 against the tree these tests run on):
 *   storage/schemas.ts           identical
 *   storage/keys.ts              identical
 *   game/ (the whole tree)       identical
 *   storage/gamePersistence.ts   DIFFERS — the 2026-10-02 "daily is today's one
 *       board" change: loadSavedGames now drops a daily slot whose date is not
 *       today. That is load behaviour, not schema; the stored shape is the same.
 * So what the published build wrote is what these strings are, and the one
 * difference in the load path is pinned below rather than left to the clock.
 *
 * Time bomb avoided: the daily slot is dated 2026-10-02, so every load passes
 * that date as `today` explicitly. Nothing here reads the device clock.
 *
 * Do not regenerate these to make a change go green. A payload that has to be
 * rewritten is a payload existing players cannot load either; from now on these
 * records change only by migration (a `SchemaDef` version bump).
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { createDailySession, createDifficultySession } from '../game';
import { loadSavedGames, saveGame, soleSuspendedMode } from './gamePersistence';
import {
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  NP_STORAGE_KEYS,
  prefsSchema,
  statsSchema,
} from './schemas';

/** The day the daily slot below was played; every load names it as "today". */
const CAPTURED_DAY = '2026-10-02';

/** Capacitor Preferences, as it stood after the session described above. */
const RELEASED: Record<string, string> = {
  [NP_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [NP_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"medium"}',
  [NP_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":25,"bestSeconds":25},' +
    '"medium":{"played":3,"solved":1,"totalPlaySeconds":45,"bestSeconds":31},' +
    '"hard":{"played":0,"solved":0,"totalPlaySeconds":0,"bestSeconds":null},' +
    '"dailyTimes":{"2026-10-02":31}}',
  [NP_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"mode":"difficulty","seed":"number-path-medium-muqpwavq-6afvt",' +
    '"difficulty":"medium","dailyDate":null,"width":6,"height":6,' +
    '"numbers":[[0,1],[8,2],[24,3],[22,4],[15,5]],' +
    '"walls":["h15","h19","v0","v15","v18","v28"],' +
    '"solution":[0,6,7,1,2,8,14,20,19,13,12,18,24,30,31,25,26,32,33,27,21,22,28,34,35,29,23,17,16,10,11,5,4,3,9,15],' +
    '"path":[0,6,7,1,2,8,14,20],"hintCount":7,"elapsedSeconds":8,"savedAt":1790930707129}',
  [NP_STORAGE_KEYS.dailyGame]:
    '{"schemaVersion":1,"mode":"daily","seed":"number-path-daily-2026-10-02",' +
    '"difficulty":"medium","dailyDate":"2026-10-02","width":6,"height":6,' +
    '"numbers":[[2,1],[21,2],[14,3],[27,4],[6,5]],"walls":["v10","v18","v27"],' +
    '"solution":[2,3,4,5,11,17,23,29,35,34,28,22,21,15,16,10,9,8,14,20,19,25,26,27,33,32,31,30,24,18,12,13,7,1,0,6],' +
    '"path":[2,3,4,5,11,17,23],"hintCount":6,"elapsedSeconds":6,"savedAt":1790930697421}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the remembered difficulty, not the default', async () => {
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 1,
      difficulty: 'medium',
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 25, bestSeconds: 25 },
      medium: { played: 3, solved: 1, totalPlaySeconds: 45, bestSeconds: 31 },
      hard: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
      dailyTimes: { '2026-10-02': 31 },
    });
  });

  it('restores the suspended difficulty board down to the path', async () => {
    const { difficulty } = await loadSavedGames(released(), CAPTURED_DAY);
    expect(difficulty).not.toBeNull();
    expect(difficulty!.mode).toBe('difficulty');
    expect(difficulty!.seed).toBe('number-path-medium-muqpwavq-6afvt');
    expect(difficulty!.difficulty).toBe('medium');
    expect(difficulty!.dailyDate).toBeNull();
    expect(difficulty!.board.width).toBe(6);
    expect(difficulty!.board.height).toBe(6);
    // The clues: 1 at cell 0, 2 at 8, 3 at 24, 4 at 22, 5 at 15 — nothing else.
    expect(difficulty!.board.last).toBe(5);
    expect(difficulty!.board.cellOf.slice(1)).toEqual([0, 8, 24, 22, 15]);
    expect(difficulty!.board.numbers.filter((n) => n !== 0)).toHaveLength(5);
    expect([...difficulty!.board.walls]).toEqual(['h15', 'h19', 'v0', 'v15', 'v18', 'v28']);
    expect(difficulty!.solution).toEqual([
      0, 6, 7, 1, 2, 8, 14, 20, 19, 13, 12, 18, 24, 30, 31, 25, 26, 32, 33, 27, 21, 22, 28, 34, 35,
      29, 23, 17, 16, 10, 11, 5, 4, 3, 9, 15,
    ]);
    expect(difficulty!.path).toEqual([0, 6, 7, 1, 2, 8, 14, 20]);
    expect(difficulty!.hintCount).toBe(7);
    // The seconds on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(difficulty!.elapsedSeconds).toBe(8);
    expect(difficulty!.status).toBe('playing');
  });

  it('restores the suspended daily down to the path', async () => {
    const { daily } = await loadSavedGames(released(), CAPTURED_DAY);
    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.seed).toBe('number-path-daily-2026-10-02');
    expect(daily!.difficulty).toBe('medium');
    expect(daily!.dailyDate).toBe('2026-10-02');
    expect(daily!.board.width).toBe(6);
    expect(daily!.board.height).toBe(6);
    expect(daily!.board.last).toBe(5);
    expect(daily!.board.cellOf.slice(1)).toEqual([2, 21, 14, 27, 6]);
    expect([...daily!.board.walls]).toEqual(['v10', 'v18', 'v27']);
    expect(daily!.solution).toEqual([
      2, 3, 4, 5, 11, 17, 23, 29, 35, 34, 28, 22, 21, 15, 16, 10, 9, 8, 14, 20, 19, 25, 26, 27, 33,
      32, 31, 30, 24, 18, 12, 13, 7, 1, 0, 6,
    ]);
    expect(daily!.path).toEqual([2, 3, 4, 5, 11, 17, 23]);
    expect(daily!.hintCount).toBe(6);
    expect(daily!.elapsedSeconds).toBe(6);
    expect(daily!.status).toBe('playing');
  });

  it('keeps both slots at once, and neither is "the" suspended game', async () => {
    const saved = await loadSavedGames(released(), CAPTURED_DAY);
    expect(saved.difficulty).not.toBeNull();
    expect(saved.daily).not.toBeNull();
    // Two suspended boards are a guess for a shortcut, so it opens the home (#113).
    expect(soleSuspendedMode(saved)).toBeNull();
  });

  it('brings the boards back without the strokes that drew them', async () => {
    // The undo history is deliberately not persisted (§5, §9): a resumed game
    // starts from the position, not part-way through a path to it.
    const { difficulty, daily } = await loadSavedGames(released(), CAPTURED_DAY);
    expect(difficulty!.history).toEqual([]);
    expect(daily!.history).toEqual([]);
  });

  it('still builds the very boards these seeds named', async () => {
    // The seed travels with the save, and Retry rebuilds the board from it
    // (§7): if the generator drifted, "same board" would quietly be another one.
    const daily = createDailySession(CAPTURED_DAY);
    const saved = await loadSavedGames(released(), CAPTURED_DAY);
    expect(daily.solution).toEqual(saved.daily!.solution);
    expect([...daily.board.walls]).toEqual([...saved.daily!.board.walls]);
    expect(daily.board.numbers).toEqual(saved.daily!.board.numbers);

    const medium = createDifficultySession('medium', 'number-path-medium-muqpwavq-6afvt');
    expect(medium.solution).toEqual(saved.difficulty!.solution);
    expect([...medium.board.walls]).toEqual([...saved.difficulty!.board.walls]);
    expect(medium.board.numbers).toEqual(saved.difficulty!.board.numbers);
  });
});

describe("the daily is today's one board", () => {
  it('drops a daily left from an earlier day, record and all', async () => {
    // The one load-path difference from the published build (see the header):
    // behaviour, not schema. With a later "today" the captured daily is gone.
    const kv = released();
    const saved = await loadSavedGames(kv, '2026-10-03');
    expect(saved.daily).toBeNull();
    expect(await kv.get(NP_STORAGE_KEYS.dailyGame)).toBeNull();
    // ...and it costs the difficulty slot, the stats and the flags nothing.
    expect(saved.difficulty).not.toBeNull();
    expect(await kv.get(NP_STORAGE_KEYS.game)).toBe(RELEASED[NP_STORAGE_KEYS.game]);
    expect((await loadRecord(statsSchema, kv)).dailyTimes).toEqual({ '2026-10-02': 31 });
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [NP_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preference default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [NP_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [NP_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no board to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({
      [NP_STORAGE_KEYS.game]: raw,
      [NP_STORAGE_KEYS.dailyGame]: raw,
    });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
    expect(await loadSavedGames(kv, CAPTURED_DAY)).toEqual({ difficulty: null, daily: null });
  });

  it("refuses a released record sitting in the other mode's slot", async () => {
    // The key says which mode a record is (§9): swapped, neither may resume.
    const kv = createMemoryKV({
      [NP_STORAGE_KEYS.game]: RELEASED[NP_STORAGE_KEYS.dailyGame]!,
      [NP_STORAGE_KEYS.dailyGame]: RELEASED[NP_STORAGE_KEYS.game]!,
    });
    expect(await loadSavedGames(kv, CAPTURED_DAY)).toEqual({ difficulty: null, daily: null });
  });

  it('discards a board whose path left the rules rather than repairing it', async () => {
    // Cell 0 is the 1; jumping straight to the far end of the road is not a step.
    const kv = createMemoryKV({
      [NP_STORAGE_KEYS.game]: RELEASED[NP_STORAGE_KEYS.game]!.replace(
        '"path":[0,6,7,1,2,8,14,20]',
        '"path":[0,15]',
      ),
    });
    expect(await loadSavedGames(kv, CAPTURED_DAY)).toEqual({ difficulty: null, daily: null });
  });
});

describe('a suspended board comes back the way it was left', () => {
  it("survives a second leg: load, save with today's code, load again", async () => {
    const first = await loadSavedGames(released(), CAPTURED_DAY);

    const kv = createMemoryKV();
    await saveGame(first.difficulty!, kv);
    await saveGame(first.daily!, kv);
    const second = await loadSavedGames(kv, CAPTURED_DAY);

    for (const mode of ['difficulty', 'daily'] as const) {
      const before = first[mode]!;
      const after = second[mode];
      expect(after).not.toBeNull();
      expect(after!.mode).toBe(before.mode);
      expect(after!.seed).toBe(before.seed);
      expect(after!.dailyDate).toBe(before.dailyDate);
      expect(after!.board.numbers).toEqual(before.board.numbers);
      expect([...after!.board.walls]).toEqual([...before.board.walls]);
      expect(after!.solution).toEqual(before.solution);
      expect(after!.path).toEqual(before.path);
      expect(after!.hintCount).toBe(before.hintCount);
      expect(after!.elapsedSeconds).toBe(before.elapsedSeconds);
      expect(after!.status).toBe('playing');
    }
  });

  it('writes the same shape the released build wrote', async () => {
    // Field for field: a key added or dropped here is a schema change, and a
    // schema change is a migration (§9).
    const first = await loadSavedGames(released(), CAPTURED_DAY);
    const kv = createMemoryKV();
    await saveGame(first.difficulty!, kv);
    const written = JSON.parse((await kv.get(NP_STORAGE_KEYS.game))!) as Record<string, unknown>;
    const { savedAt, ...rest } = written;
    const { savedAt: releasedSavedAt, ...releasedRest } = JSON.parse(
      RELEASED[NP_STORAGE_KEYS.game]!,
    ) as Record<string, unknown>;
    expect(typeof savedAt).toBe('number');
    expect(typeof releasedSavedAt).toBe('number');
    expect(rest).toEqual(releasedRest);
  });
});
