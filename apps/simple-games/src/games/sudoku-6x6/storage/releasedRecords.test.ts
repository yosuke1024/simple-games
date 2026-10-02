/**
 * The records a released build actually wrote, read by today's validators
 * (docs/RELEASE_CHECKLIST.md §0, docs/SUDOKU_6X6_RULES.md §11).
 *
 * Sudoku 6×6 graduated from the web beta into the app on 2026-10-02, and
 * graduation freezes its save schema: from now on these records change only
 * by migration. `slots.test.ts` and `game/compatibility.test.ts` cannot stand
 * in for this file. The first builds payloads with today's code, so it moves
 * with the schema; the second guards the boards a seed deals, not whether a
 * stored save survives. A validator is only proven by data it did not
 * generate itself.
 *
 * Provenance: captured, not generated. The strings below are what Capacitor
 * Preferences held after playing the PUBLISHED web build (pixapps-landing
 * 7e536db, built from simple-games 74b4e58) in headless Chromium, copied
 * verbatim. Every move went through the game's own controls (cells, number
 * pad, Notes, Hint, Home, Past Dailies, the settings screen); nothing was
 * written to storage by the script and no game internals were called. Two
 * sessions: the first gave flags, prefs, stats and both slots; the second,
 * with fresh storage, gave the past-day daily (2026-09-30) in the daily slot.
 * Every key in storage/keys.ts is covered and no record is hand-built.
 *
 * Provenance of the code, `git rev-parse 74b4e58:<path> HEAD:<path>`
 * (2026-10-02):
 *   - storage/schemas.ts      identical (54c84c6)
 *   - storage/keys.ts         identical (735e2f4)
 *   - game/ (whole tree)      identical (f9e767f)
 *   - storage/gamePersistence.ts DIFFERS (810f563 -> b79914c): the 2026-10-02
 *     "the daily is today's one board" change. A daily slot whose date is not
 *     today is dropped on load. That is behaviour, not schema; the published
 *     loader had no date check (read from the diff, not exercised in the
 *     browser) — see "a daily from another day" below.
 * So the schema these strings were written under is the schema they are read
 * by, and the one behavioural difference is pinned explicitly.
 *
 * The daily is dated 2026-10-02, the day it was captured, so the loads below
 * pass that date to `loadSavedGames` instead of reading the device clock:
 * this file must not go red tomorrow.
 *
 * Do not regenerate these strings to make a change go green: a payload that
 * has to be rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import {
  encodeBoards,
  mistakenCells,
  createDifficultySession,
  placeDigit,
  type Digit,
  type Sudoku6x6Session,
} from '../game';
import { loadSavedGames, saveGame } from './gamePersistence';
import {
  S6_STORAGE_KEYS,
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  prefsSchema,
  statsSchema,
} from './schemas';

/** The day the daily below was captured. */
const CAPTURED_ON = '2026-10-02';

/** Capacitor Preferences, as it stood at the end of the first session. */
const RELEASED: Record<string, string> = {
  [S6_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [S6_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"medium","highlightMistakes":false}',
  [S6_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":7,' +
    '"bestSeconds":7},"medium":{"played":4,"solved":2,"totalPlaySeconds":24,' +
    '"bestSeconds":7},"hard":{"played":1,"solved":1,"totalPlaySeconds":9,' +
    '"bestSeconds":9},"dailyTimes":{"2026-10-02":8,"2026-10-01":7}}',
  [S6_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"mode":"difficulty","seed":"sudoku-6x6-medium-muqqflu5-8a5g1",' +
    '"difficulty":"medium","dailyDate":null,' +
    '"givens":".....53.14.....2.62.6.....45.31.....",' +
    '"solution":"462135351462513246246351624513135624",' +
    '"entries":"46214...............................","notes":[0,0,0,0,0,0,0,18,0,0,0,0,' +
    '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"mistakeCount":1,"hintCount":0,' +
    '"elapsedSeconds":5,"savedAt":1790931604211}',
  [S6_STORAGE_KEYS.dailyGame]:
    '{"schemaVersion":1,"mode":"daily","seed":"sudoku-6x6-daily-2026-10-02",' +
    '"difficulty":"medium","dailyDate":"2026-10-02",' +
    '"givens":".6..1...5..6.52......56.1..2...2..4.",' +
    '"solution":"264315315426652134431562146253523641",' +
    '"entries":"2.43................................","notes":[0,0,0,0,0,0,18,0,0,0,0,0,' +
    '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"mistakeCount":0,"hintCount":1,' +
    '"elapsedSeconds":4,"savedAt":1790931609892}',
};

/**
 * Second session: the daily slot after leaving a past day's daily (opened from
 * Past Dailies, which the published build offered) part-way.
 */
const RELEASED_PAST_DAILY =
  '{"schemaVersion":1,"mode":"daily","seed":"sudoku-6x6-daily-2026-09-30",' +
  '"difficulty":"medium","dailyDate":"2026-09-30",' +
  '"givens":"..134.3...1......32......6...2.324..",' +
  '"solution":"621345345216456123213654164532532461",' +
  '"entries":"62...5.5............................","notes":[0,0,0,0,0,0,0,0,18,0,0,0,' +
  '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"mistakeCount":1,"hintCount":1,' +
  '"elapsedSeconds":6,"savedAt":1790931718959}';

const released = () => createMemoryKV({ ...RELEASED });

/** What the board strings of a restored session say, in the saved form. */
const boardsOf = (session: Sudoku6x6Session) => encodeBoards(session.board, session.solution);

const NO_NOTES = Array.from({ length: 36 }, () => 0);

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the preferences, the setting turned off and the difficulty last picked', async () => {
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 1,
      difficulty: 'medium',
      highlightMistakes: false,
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 7, bestSeconds: 7 },
      medium: { played: 4, solved: 2, totalPlaySeconds: 24, bestSeconds: 7 },
      hard: { played: 1, solved: 1, totalPlaySeconds: 9, bestSeconds: 9 },
      dailyTimes: { '2026-10-02': 8, '2026-10-01': 7 },
    });
  });

  it('restores the suspended difficulty game down to the cell', async () => {
    const { difficulty } = await loadSavedGames(released(), CAPTURED_ON);
    expect(difficulty).not.toBeNull();
    const session = difficulty!;
    expect(boardsOf(session)).toEqual({
      givens: '.....53.14.....2.62.6.....45.31.....',
      solution: '462135351462513246246351624513135624',
      entries: '46214...............................',
      notes: Array.from({ length: 36 }, (_, i) => (i === 7 ? 0b10010 : 0)),
    });
    expect(session.mode).toBe('difficulty');
    expect(session.difficulty).toBe('medium');
    expect(session.dailyDate).toBeNull();
    expect(session.seed).toBe('sudoku-6x6-medium-muqqflu5-8a5g1');
    expect(session.mistakeCount).toBe(1);
    expect(session.hintCount).toBe(0);
    // The seconds on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time.
    expect(session.elapsedSeconds).toBe(5);
    expect(session.status).toBe('playing');
    // The fifth entry (a 4 where the answer has a 3) was left on the board.
    expect([...mistakenCells(session.board, session.solution)]).toEqual([4]);
  });

  it("restores today's suspended daily down to the cell", async () => {
    const { daily } = await loadSavedGames(released(), CAPTURED_ON);
    expect(daily).not.toBeNull();
    const session = daily!;
    expect(boardsOf(session)).toEqual({
      givens: '.6..1...5..6.52......56.1..2...2..4.',
      solution: '264315315426652134431562146253523641',
      entries: '2.43................................',
      notes: Array.from({ length: 36 }, (_, i) => (i === 6 ? 0b10010 : 0)),
    });
    expect(session.mode).toBe('daily');
    expect(session.difficulty).toBe('medium');
    expect(session.dailyDate).toBe('2026-10-02');
    expect(session.seed).toBe('sudoku-6x6-daily-2026-10-02');
    expect(session.mistakeCount).toBe(0);
    expect(session.hintCount).toBe(1);
    expect(session.elapsedSeconds).toBe(4);
    expect(session.status).toBe('playing');
  });

  it('brings the boards back without the moves that made them', async () => {
    // The undo history is deliberately not persisted (§11): a resumed game
    // starts from the position, not part-way through a path to it.
    const saved = await loadSavedGames(released(), CAPTURED_ON);
    expect(saved.difficulty!.history).toEqual([]);
    expect(saved.daily!.history).toEqual([]);
  });

  it('reads each slot through its own schema too', async () => {
    const kv = released();
    expect(await loadRecord(gameSchema, kv)).toMatchObject({
      mode: 'difficulty',
      dailyDate: null,
      savedAt: 1790931604211,
    });
    expect(await loadRecord(dailyGameSchema, kv)).toMatchObject({
      mode: 'daily',
      dailyDate: '2026-10-02',
      savedAt: 1790931609892,
    });
  });
});

describe('a daily from another day', () => {
  // The published build let a past day's daily be played from Past Dailies and
  // left in the slot; its loader had no date check. Today's code drops it
  // (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」). That is the one
  // behaviour that changed between the build these records came from and now,
  // so it is pinned rather than left to be rediscovered.
  const past = () =>
    createMemoryKV({ ...RELEASED, [S6_STORAGE_KEYS.dailyGame]: RELEASED_PAST_DAILY });

  it('is a record today still reads, on its own day', async () => {
    const { daily } = await loadSavedGames(past(), '2026-09-30');
    expect(daily).not.toBeNull();
    expect(daily!.dailyDate).toBe('2026-09-30');
    expect(daily!.seed).toBe('sudoku-6x6-daily-2026-09-30');
    expect(boardsOf(daily!).entries).toBe('62...5.5............................');
    expect(daily!.mistakeCount).toBe(1);
    expect(daily!.hintCount).toBe(1);
    expect(daily!.elapsedSeconds).toBe(6);
  });

  it('is dropped, record and all, once it is another day', async () => {
    const kv = past();
    const saved = await loadSavedGames(kv, CAPTURED_ON);
    expect(saved.daily).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
    // Only the daily slot goes: the difficulty game and the statistics stay.
    expect(saved.difficulty).not.toBeNull();
    expect((await loadRecord(statsSchema, kv)).dailyTimes).toEqual({
      '2026-10-02': 8,
      '2026-10-01': 7,
    });
  });

  it('drops the daily captured on 2026-10-02 once it is no longer that day', async () => {
    const kv = released();
    const saved = await loadSavedGames(kv, '2026-10-03');
    expect(saved.daily).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [S6_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preferences default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [S6_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [S6_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no board to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [S6_STORAGE_KEYS.game]: raw, [S6_STORAGE_KEYS.dailyGame]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
    expect(await loadSavedGames(kv, CAPTURED_ON)).toEqual({ difficulty: null, daily: null });
  });

  it('discards a board whose strings are the wrong length rather than repairing them', async () => {
    // Shorter is not a smaller board: it is a record from something that is
    // not this game (§11).
    const entries = '"entries":"46214...............................",';
    expect(RELEASED[S6_STORAGE_KEYS.game]).toContain(entries);
    const kv = createMemoryKV({
      [S6_STORAGE_KEYS.game]: RELEASED[S6_STORAGE_KEYS.game]!.replace(
        entries,
        '"entries":"46214",',
      ),
    });
    expect((await loadSavedGames(kv, CAPTURED_ON)).difficulty).toBeNull();
  });

  it('discards a board whose answer breaks the rules instead of resuming a wrong puzzle', async () => {
    const solution = '"solution":"462135351462513246246351624513135624",';
    expect(RELEASED[S6_STORAGE_KEYS.game]).toContain(solution);
    const kv = createMemoryKV({
      [S6_STORAGE_KEYS.game]: RELEASED[S6_STORAGE_KEYS.game]!.replace(
        solution,
        '"solution":"662135351462513246246351624513135624",',
      ),
    });
    expect((await loadSavedGames(kv, CAPTURED_ON)).difficulty).toBeNull();
  });

  it('reads a record by the slot it sits in, not by what it says it is', async () => {
    // A daily in the difficulty key (and the reverse) is corrupt data, not an
    // instruction to switch modes (§11).
    const kv = createMemoryKV({
      [S6_STORAGE_KEYS.game]: RELEASED[S6_STORAGE_KEYS.dailyGame]!,
      [S6_STORAGE_KEYS.dailyGame]: RELEASED[S6_STORAGE_KEYS.game]!,
    });
    expect(await loadSavedGames(kv, CAPTURED_ON)).toEqual({ difficulty: null, daily: null });
  });
});

describe('a suspended board comes back the way it was left', () => {
  it('survives the round trip through storage, the released games included', async () => {
    const first = await loadSavedGames(released(), CAPTURED_ON);
    const kv = createMemoryKV();
    await saveGame(first.difficulty!, kv);
    await saveGame(first.daily!, kv);

    const second = await loadSavedGames(kv, CAPTURED_ON);
    for (const mode of ['difficulty', 'daily'] as const) {
      const before = first[mode]!;
      const after = second[mode]!;
      expect(boardsOf(after)).toEqual(boardsOf(before));
      expect(after.seed).toBe(before.seed);
      expect(after.difficulty).toBe(before.difficulty);
      expect(after.dailyDate).toBe(before.dailyDate);
      expect(after.mistakeCount).toBe(before.mistakeCount);
      expect(after.hintCount).toBe(before.hintCount);
      expect(after.elapsedSeconds).toBe(before.elapsedSeconds);
    }
  });

  it('keeps a digit placed after the resume', async () => {
    const { difficulty } = await loadSavedGames(released(), CAPTURED_ON);
    const solution = difficulty!.solution;
    const { givens, entries } = boardsOf(difficulty!);
    // The first cell that is neither a clue nor already filled.
    const index = [...entries].findIndex((c, i) => c === '.' && givens[i] === '.');
    const next = placeDigit(difficulty!, index, solution[index] as Digit)!;
    expect(next).not.toBeNull();

    const kv = createMemoryKV();
    await saveGame(next, kv);
    const restored = (await loadSavedGames(kv, CAPTURED_ON)).difficulty!;
    expect(boardsOf(restored).entries[index]).toBe(String(solution[index]));
    expect(boardsOf(restored).entries.startsWith('46214')).toBe(true);
  });

  it('saves a fresh board in the shape the released build wrote', async () => {
    const kv = createMemoryKV();
    await saveGame(createDifficultySession('easy', 'sudoku-6x6-easy-round-trip'), kv);
    const restored = (await loadSavedGames(kv, CAPTURED_ON)).difficulty!;
    expect(restored.seed).toBe('sudoku-6x6-easy-round-trip');
    expect(boardsOf(restored).notes).toEqual(NO_NOTES);
    expect(boardsOf(restored).entries).toBe('.'.repeat(36));
    expect(restored.elapsedSeconds).toBe(0);
  });

  it('keeps the preferences and statistics it saves readable by the same schemas', async () => {
    const kv = released();
    const stats = await loadRecord(statsSchema, kv);
    const prefs = await loadRecord(prefsSchema, kv);
    const out = createMemoryKV();
    await saveRecord(statsSchema, stats, out);
    await saveRecord(prefsSchema, prefs, out);
    expect(await loadRecord(statsSchema, out)).toEqual(stats);
    expect(await loadRecord(prefsSchema, out)).toEqual(prefs);
  });
});
