/**
 * The records a released build actually wrote, read by today's validators
 * (docs/RELEASE_CHECKLIST.md §0, docs/BOX_REGIONS_RULES.md §11).
 *
 * Box Regions graduated from the web beta into the app on 2026-10-02 and has
 * never migrated a record, so every stored key is still v1 and nothing has
 * forced the question yet. That is exactly why this file exists: the day a
 * schema here goes to v2, the only thing standing between a player and a
 * silently discarded board is a validator, and a validator is only proven by
 * data it did not generate itself. Building the payload from `defaultValue()`
 * would prove nothing — it would follow the schema wherever the schema went.
 *
 * Provenance: played in the PUBLISHED web build (pixapps-landing 7e536db,
 * built from simple-games 74b4e58) in headless Chromium with every external
 * request blocked. Every board change was a real pointer stroke from corner
 * to corner (or a tap on a clue), and every other action a button click; the
 * records below are what Capacitor Preferences held afterwards, copied
 * verbatim. The session, in order: the tutorial; an Easy board solved with no
 * hints; a Medium board solved with the Hint button; today's daily (local
 * date 2026-10-02) solved with hints, then "Retry same board", two boxes drawn
 * and left through Back; a Hard board, three boxes drawn with three hints and
 * left through Back. Nothing here is hand-built, and the stats record is the
 * session's honest tally (the Medium row counts the Medium board and both
 * daily plays; the Hard row counts the suspended board).
 *
 * Which of this game's files the shipped build and today's tree share (verified
 * with `git rev-parse 74b4e58:<path> HEAD:<path>`):
 *   - storage/schemas.ts      identical
 *   - storage/keys.ts         identical
 *   - game/ (whole tree)      identical
 *   - storage/gamePersistence.ts  DIFFERS, by behaviour, not by schema: since
 *     2026-10-02 the daily slot holds today's board or nothing, and
 *     `loadSavedGames` drops a daily left over from another day (record and
 *     all). The daily below is therefore loaded with its own date passed as
 *     `today`, so this file does not go red tomorrow; one test pins the drop.
 *
 * Do not regenerate these strings to make a change go green. From now on
 * these records change only by migration (a `SchemaDef` version bump with a
 * validator that still reads them): a payload that has to be rewritten is a
 * payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  createDailySession,
  createDifficultySession,
  doDraw,
  encodeRegions,
  regionCells,
  UNASSIGNED,
} from '../game';
import { loadSavedGames, saveGame, soleSuspendedMode } from './gamePersistence';
import {
  BR_STORAGE_KEYS,
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  prefsSchema,
  statsSchema,
} from './schemas';

/** The local date the daily below was played on; the load functions take it as `today`. */
const DAILY_DATE = '2026-10-02';

/** Capacitor Preferences, as it stood after the session described above. */
const RELEASED: Record<string, string> = {
  [BR_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [BR_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"hard"}',
  [BR_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":11,"bestSeconds":11},' +
    '"medium":{"played":3,"solved":2,"totalPlaySeconds":43,"bestSeconds":16},' +
    '"hard":{"played":1,"solved":0,"totalPlaySeconds":9,"bestSeconds":null},' +
    '"dailyTimes":{"2026-10-02":16}}',
  // A Hard board, three boxes drawn.
  [BR_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"mode":"difficulty","seed":"box-regions-hard-muqq8wsh-sgjg",' +
    '"difficulty":"hard","dailyDate":null,"width":7,"height":7,"clues":[' +
    '{"index":1,"size":null,"kind":"free"},{"index":9,"size":6,"kind":"free"},' +
    '{"index":27,"size":null,"kind":"free"},{"index":7,"size":3,"kind":"free"},' +
    '{"index":8,"size":6,"kind":"free"},{"index":24,"size":null,"kind":"square"},' +
    '{"index":28,"size":2,"kind":"free"},{"index":38,"size":null,"kind":"free"},' +
    '{"index":39,"size":null,"kind":"square"},{"index":42,"size":1,"kind":"free"},' +
    '{"index":44,"size":null,"kind":"wide"},{"index":46,"size":null,"kind":"free"}],' +
    '"solution":"aabbbccdebbbccdefffccdefffccgefffccgehhiccjekklll",' +
    '"assignment":"..bbbccd.bbbccd....ccd....cc.....cc.....cc.......",' +
    '"hintCount":3,"elapsedSeconds":9,"savedAt":1790931295779}',
  // Today's daily (retried after a clear), two boxes drawn.
  [BR_STORAGE_KEYS.dailyGame]:
    '{"schemaVersion":1,"mode":"daily","seed":"box-regions-daily-2026-10-02",' +
    '"difficulty":"medium","dailyDate":"2026-10-02","width":6,"height":6,"clues":[' +
    '{"index":4,"size":null,"kind":"free"},{"index":8,"size":null,"kind":"free"},' +
    '{"index":35,"size":5,"kind":"free"},{"index":16,"size":null,"kind":"wide"},' +
    '{"index":24,"size":1,"kind":"square"},{"index":25,"size":null,"kind":"free"},' +
    '{"index":27,"size":4,"kind":"square"},{"index":28,"size":2,"kind":"tall"},' +
    '{"index":31,"size":2,"kind":"wide"}],' +
    '"solution":"aaaaaabbbbbcdddddcdddddcefgghciigghc",' +
    '"assignment":"aaaaaabbbbb.........................",' +
    '"hintCount":2,"elapsedSeconds":6,"savedAt":1790931285294}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the difficulty last chosen, not the default', async () => {
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 1,
      difficulty: 'hard',
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 11, bestSeconds: 11 },
      medium: { played: 3, solved: 2, totalPlaySeconds: 43, bestSeconds: 16 },
      hard: { played: 1, solved: 0, totalPlaySeconds: 9, bestSeconds: null },
      dailyTimes: { '2026-10-02': 16 },
    });
  });
});

describe('suspended boards come back the way they were left', () => {
  it('restores the Hard board down to the cell', async () => {
    const { difficulty } = await loadSavedGames(released(), DAILY_DATE);
    expect(difficulty).not.toBeNull();
    const session = difficulty!;
    expect(session.mode).toBe('difficulty');
    expect(session.seed).toBe('box-regions-hard-muqq8wsh-sgjg');
    expect(session.difficulty).toBe('hard');
    expect(session.dailyDate).toBeNull();
    expect([session.width, session.height]).toEqual([7, 7]);
    // The answer, one letter per cell:
    //   a a b b b c c
    //   d e b b b c c
    //   d e f f f c c
    //   d e f f f c c
    //   g e f f f c c
    //   g e h h i c c
    //   j e k k l l l
    expect(encodeRegions(session.solution)).toBe(
      'aabbbccdebbbccdefffccdefffccgefffccgehhiccjekklll',
    );
    // What the player had drawn: boxes b, c and d, nothing else.
    //   . . b b b c c
    //   d . b b b c c
    //   d . . . . c c
    //   d . . . . c c
    //   . . . . . c c
    //   . . . . . c c
    //   . . . . . . .
    expect(encodeRegions(session.assignment)).toBe(
      '..bbbccd.bbbccd....ccd....cc.....cc.....cc.......',
    );
    expect(regionCells(session.assignment, 1)).toEqual([2, 3, 4, 9, 10, 11]);
    expect(regionCells(session.assignment, 2)).toEqual([
      5, 6, 12, 13, 19, 20, 26, 27, 33, 34, 40, 41,
    ]);
    expect(regionCells(session.assignment, 3)).toEqual([7, 14, 21]);
    expect(session.assignment.filter((region) => region !== UNASSIGNED)).toHaveLength(21);
    expect(session.clues).toHaveLength(12);
    expect(session.clues[0]).toEqual({ index: 1, size: null, kind: 'free' });
    expect(session.clues[1]).toEqual({ index: 9, size: 6, kind: 'free' });
    expect(session.clues[5]).toEqual({ index: 24, size: null, kind: 'square' });
    expect(session.clues[9]).toEqual({ index: 42, size: 1, kind: 'free' });
    expect(session.clues[10]).toEqual({ index: 44, size: null, kind: 'wide' });
    expect(session.hintCount).toBe(3);
    // The minutes on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(session.elapsedSeconds).toBe(9);
    expect(session.status).toBe('playing');
  });

  it("restores today's daily down to the cell", async () => {
    const { daily } = await loadSavedGames(released(), DAILY_DATE);
    expect(daily).not.toBeNull();
    const session = daily!;
    expect(session.mode).toBe('daily');
    expect(session.seed).toBe('box-regions-daily-2026-10-02');
    expect(session.dailyDate).toBe(DAILY_DATE);
    // Every daily is medium (§9).
    expect(session.difficulty).toBe('medium');
    expect([session.width, session.height]).toEqual([6, 6]);
    //   a a a a a a
    //   b b b b b c
    //   d d d d d c
    //   d d d d d c
    //   e f g g h c
    //   i i g g h c
    expect(encodeRegions(session.solution)).toBe('aaaaaabbbbbcdddddcdddddcefgghciigghc');
    // Boxes a and b drawn; the rest of the board is still open.
    expect(encodeRegions(session.assignment)).toBe('aaaaaabbbbb.........................');
    expect(regionCells(session.assignment, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(regionCells(session.assignment, 1)).toEqual([6, 7, 8, 9, 10]);
    expect(session.clues).toHaveLength(9);
    expect(session.clues[2]).toEqual({ index: 35, size: 5, kind: 'free' });
    expect(session.clues[3]).toEqual({ index: 16, size: null, kind: 'wide' });
    expect(session.clues[4]).toEqual({ index: 24, size: 1, kind: 'square' });
    expect(session.clues[7]).toEqual({ index: 28, size: 2, kind: 'tall' });
    expect(session.hintCount).toBe(2);
    expect(session.elapsedSeconds).toBe(6);
    expect(session.status).toBe('playing');
  });

  it('brings each board back without the strokes that made it', async () => {
    // The undo history is deliberately not persisted (§6, §11): a resumed game
    // starts from the position, not part-way through a path to it.
    const { difficulty, daily } = await loadSavedGames(released(), DAILY_DATE);
    expect(difficulty!.history).toEqual([]);
    expect(daily!.history).toEqual([]);
  });

  it('knows two suspended games are not one the shortcut can pick (#113)', async () => {
    expect(soleSuspendedMode(await loadSavedGames(released(), DAILY_DATE))).toBeNull();
  });

  it("regenerates today's daily from its seed to the very board that was saved", async () => {
    // The seed is the board (§8): the published build's generator and today's
    // agree, so a Retry on a resumed daily deals the puzzle the player had.
    const { daily } = await loadSavedGames(released(), DAILY_DATE);
    const fresh = createDailySession(DAILY_DATE);
    expect(encodeRegions(fresh.solution)).toBe(encodeRegions(daily!.solution));
    expect(fresh.clues).toEqual(daily!.clues);
  });

  it("drops a daily that is not today's, record and all (2026-10-02)", async () => {
    // The daily slot holds today's board or nothing; the difficulty slot is
    // never touched by the date.
    const kv = released();
    const saved = await loadSavedGames(kv, '2026-10-03');
    expect(saved.daily).toBeNull();
    expect(saved.difficulty).not.toBeNull();
    expect(await kv.get(BR_STORAGE_KEYS.dailyGame)).toBeNull();
    expect(await kv.get(BR_STORAGE_KEYS.game)).toBe(RELEASED[BR_STORAGE_KEYS.game]);
    expect(soleSuspendedMode(saved)).toBe('difficulty');
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BR_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the prefs default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BR_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BR_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no board to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({
      [BR_STORAGE_KEYS.game]: raw,
      [BR_STORAGE_KEYS.dailyGame]: raw,
    });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
    expect(await loadSavedGames(kv, DAILY_DATE)).toEqual({ difficulty: null, daily: null });
  });

  it('discards a board that does not decode rather than repairing it', async () => {
    // A shorter assignment is not a smaller board — it is a record from
    // something that is not this game (§11).
    const kv = createMemoryKV({
      [BR_STORAGE_KEYS.game]: RELEASED[BR_STORAGE_KEYS.game]!.replace(
        '"..bbbccd.bbbccd....ccd....cc.....cc.....cc......."',
        '"..bbbccd.bbbccd"',
      ),
    });
    expect(await loadSavedGames(kv, DAILY_DATE)).toEqual({ difficulty: null, daily: null });
  });

  it('keeps the board slot apart from the daily slot', async () => {
    // A record is whatever its key says it is: the daily written under the
    // difficulty key is corrupt data, not an instruction to switch modes.
    const kv = createMemoryKV({ [BR_STORAGE_KEYS.game]: RELEASED[BR_STORAGE_KEYS.dailyGame]! });
    expect(await loadSavedGames(kv, DAILY_DATE)).toEqual({ difficulty: null, daily: null });
  });
});

describe("a suspended board saved by today's code comes back the way it was left", () => {
  it('survives the round trip through storage, difficulty slot', async () => {
    const start = createDifficultySession('medium', 'box-regions-round-trip');
    // The first box that is bigger than one cell, drawn corner to corner.
    const region = start.clues.findIndex((clue) => (clue.size ?? 2) > 1);
    const box = regionCells(start.solution, region);
    const played = doDraw(start, box[0]!, box[box.length - 1]!);
    expect(played).not.toBeNull();

    const kv = createMemoryKV();
    await saveGame(played!, kv);
    const restored = (await loadSavedGames(kv, DAILY_DATE)).difficulty;

    expect(restored).not.toBeNull();
    expect(encodeRegions(restored!.assignment)).toBe(encodeRegions(played!.assignment));
    expect(encodeRegions(restored!.solution)).toBe(encodeRegions(played!.solution));
    expect(restored!.seed).toBe('box-regions-round-trip');
    expect(restored!.clues).toEqual(played!.clues);
    expect(restored!.elapsedSeconds).toBe(played!.elapsedSeconds);
    expect(restored!.hintCount).toBe(played!.hintCount);
    expect(restored!.status).toBe('playing');
  });

  it('survives the round trip through storage, daily slot', async () => {
    const start = createDailySession(DAILY_DATE);
    const region = start.clues.findIndex((clue) => (clue.size ?? 2) > 1);
    const box = regionCells(start.solution, region);
    const played = doDraw(start, box[0]!, box[box.length - 1]!);
    expect(played).not.toBeNull();

    const kv = createMemoryKV();
    await saveGame(played!, kv);
    const restored = (await loadSavedGames(kv, DAILY_DATE)).daily;

    expect(restored).not.toBeNull();
    expect(restored!.dailyDate).toBe(DAILY_DATE);
    expect(encodeRegions(restored!.assignment)).toBe(encodeRegions(played!.assignment));
    expect(restored!.clues).toEqual(played!.clues);
  });
});
