/**
 * The records a released build actually wrote, read by today's validators
 * (graduation 2026-10-02, docs/RELEASE_CHECKLIST.md §0, docs/SHAPE_REGIONS_RULES.md §11).
 *
 * Shape Regions spent its early life as a web-first title, where its saves
 * were allowed to change. This file is where that stops: from the day it
 * joins the app, these records change only by migration (`SchemaDef`
 * version), never by reinterpretation. A validator is only proven by data it
 * did not generate itself — building a payload from `defaultValue()` would
 * follow the schema wherever the schema went.
 *
 * Provenance: played in the PUBLISHED web build (the files pixapps-landing
 * served at /simple-games/play/, landing 7e536db, built from simple-games
 * 74b4e58) in headless Chromium with every external request blocked. The game
 * was driven through its own UI — the tutorial buttons, the Hint button, pointer
 * strokes from a clue across its shape's cells, Back / Home / Retry — and the
 * five strings below are what Capacitor Preferences held afterwards, copied
 * verbatim. Nothing here was written to storage by hand or built from a
 * schema. The play, in order: the tutorial (which opens an Easy board), that
 * Easy board solved without hints, a Medium board solved with hints, the
 * 2026-10-02 daily solved with hints, Retry on the daily and two shapes placed
 * before leaving (the suspended daily), then a Hard board with three shapes
 * placed and one more hint before leaving (the suspended difficulty game; Hard
 * is also what the last choice on the home screen left in `sr.prefs`). The
 * statistics are the sum of those games: the daily counts under Medium, and its
 * Retry counted as a second Medium board played.
 *
 * What differs from that build, per `git rev-parse 74b4e58:<path> HEAD:<path>`:
 * - storage/schemas.ts and storage/keys.ts are IDENTICAL (blobs b969593 and
 *   20769e9), and so is the whole game/ tree (tree b454740).
 * - storage/gamePersistence.ts DIFFERS, by behaviour and not by schema:
 *   `loadSavedGames` now drops a daily slot whose date is not today (2026-10-02,
 *   "the daily is today's one board"). The captured daily is dated 2026-10-02,
 *   so every load below passes that date explicitly instead of reading the
 *   clock, and one test pins the drop.
 *
 * Do not regenerate these strings to make a change go green: a payload that
 * has to be rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  createDailySession,
  createDifficultySession,
  doHintUse,
  doStroke,
  encodeRegions,
  neighbors,
  UNASSIGNED,
} from '../game';
import { loadSavedGames, saveGame } from './gamePersistence';
import {
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  prefsSchema,
  SR_STORAGE_KEYS,
  statsSchema,
} from './schemas';

/** The local date the captured daily was played on; the `today` every load below is given. */
const CAPTURED_DAY = '2026-10-02';

/** Capacitor Preferences, as it stood after the games described above. */
const RELEASED: Record<string, string> = {
  [SR_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [SR_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"hard"}',
  [SR_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":11' +
    ',"bestSeconds":11},"medium":{"played":3,"solved":2,"totalPlaySeconds":41' +
    ',"bestSeconds":17},"hard":{"played":1,"solved":0,"totalPlaySeconds":9' +
    ',"bestSeconds":null},"dailyTimes":{"2026-10-02":18}}',
  [SR_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"mode":"difficulty","seed":"shape-regions-hard-muqptm2n-3f4h7"' +
    ',"difficulty":"hard","dailyDate":null,"width":7,"height":7,"clues":[{"index":8' +
    ',"size":6,"shape":null},{"index":24,"size":6,"shape":null},{"index":3,"size":null' +
    ',"shape":"corner"},{"index":27,"size":6,"shape":null},{"index":28,"size":4' +
    ',"shape":"line"},{"index":10,"size":2,"shape":null},{"index":47,"size":null' +
    ',"shape":"line"},{"index":31,"size":4,"shape":null},{"index":32,"size":2' +
    ',"shape":null},{"index":35,"size":4,"shape":"corner"},{"index":48,"size":2' +
    ',"shape":null},{"index":44,"size":2,"shape":null}]' +
    ',"solution":"aabccddeabfcgdeabfcgdeabbcgdeabhigdjjjhigkjllhhgk"' +
    ',"assignment":"...c...ea.f...e......e..b..de..hi..jjj....jll..gk","hintCount":3' +
    ',"elapsedSeconds":9,"savedAt":1790930582781}',
  [SR_STORAGE_KEYS.dailyGame]:
    '{"schemaVersion":1,"mode":"daily","seed":"shape-regions-daily-2026-10-02"' +
    ',"difficulty":"medium","dailyDate":"2026-10-02","width":6,"height":6' +
    ',"clues":[{"index":0,"size":null,"shape":"tee"},{"index":3,"size":5,"shape":null}' +
    ',{"index":17,"size":null,"shape":"tee"},{"index":7,"size":5,"shape":"corner"}' +
    ',{"index":16,"size":3,"shape":null},{"index":30,"size":4,"shape":"corner"}' +
    ',{"index":21,"size":3,"shape":"corner"},{"index":29,"size":3,"shape":null}' +
    ',{"index":32,"size":2,"shape":"line"}]' +
    ',"solution":"abbbbcaddbccaadeecafdgecafdgghffiihh"' +
    ',"assignment":"a..b...d........ec.f.g...f...hffii..","hintCount":2' +
    ',"elapsedSeconds":6,"savedAt":1790930571521}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the last difficulty chosen', async () => {
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 1,
      difficulty: 'hard',
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 11, bestSeconds: 11 },
      medium: { played: 3, solved: 2, totalPlaySeconds: 41, bestSeconds: 17 },
      hard: { played: 1, solved: 0, totalPlaySeconds: 9, bestSeconds: null },
      dailyTimes: { '2026-10-02': 18 },
    });
  });

  it('restores the suspended difficulty game down to the cell', async () => {
    const { difficulty } = await loadSavedGames(released(), CAPTURED_DAY);
    expect(difficulty).not.toBeNull();
    const session = difficulty!;
    expect(session.mode).toBe('difficulty');
    expect(session.difficulty).toBe('hard');
    expect(session.dailyDate).toBeNull();
    expect(session.seed).toBe('shape-regions-hard-muqptm2n-3f4h7');
    expect(session.width).toBe(7);
    expect(session.height).toBe(7);
    expect(session.clues).toHaveLength(12);
    expect(session.clues[0]).toEqual({ index: 8, size: 6, shape: null });
    expect(session.clues[2]).toEqual({ index: 3, size: null, shape: 'corner' });
    expect(session.clues[3]).toEqual({ index: 27, size: 6, shape: null });
    expect(session.clues[4]).toEqual({ index: 28, size: 4, shape: 'line' });
    expect(session.clues[9]).toEqual({ index: 35, size: 4, shape: 'corner' });
    // The answer travels with the save, so the board is the player's puzzle.
    expect(encodeRegions(session.solution)).toBe(
      'aabccddeabfcgdeabfcgdeabbcgdeabhigdjjjhigkjllhhgk',
    );
    expect(encodeRegions(session.assignment)).toBe(
      '...c...ea.f...e......e..b..de..hi..jjj....jll..gk',
    );
    expect(session.assignment.filter((region) => region === UNASSIGNED)).toHaveLength(30);
    expect(session.hintCount).toBe(3);
    // The seconds on the board are part of it: dropping them quietly reports
    // someone else's play time (issue #109).
    expect(session.elapsedSeconds).toBe(9);
    expect(session.status).toBe('playing');
    // The undo history is deliberately not persisted (§11).
    expect(session.history).toEqual([]);
  });

  it('restores the suspended daily down to the cell', async () => {
    const { daily } = await loadSavedGames(released(), CAPTURED_DAY);
    expect(daily).not.toBeNull();
    const session = daily!;
    expect(session.mode).toBe('daily');
    expect(session.difficulty).toBe('medium');
    expect(session.dailyDate).toBe('2026-10-02');
    expect(session.seed).toBe('shape-regions-daily-2026-10-02');
    expect(session.width).toBe(6);
    expect(session.height).toBe(6);
    expect(session.clues).toHaveLength(9);
    expect(session.clues[0]).toEqual({ index: 0, size: null, shape: 'tee' });
    expect(session.clues[1]).toEqual({ index: 3, size: 5, shape: null });
    expect(session.clues[3]).toEqual({ index: 7, size: 5, shape: 'corner' });
    expect(session.clues[8]).toEqual({ index: 32, size: 2, shape: 'line' });
    expect(encodeRegions(session.solution)).toBe('abbbbcaddbccaadeecafdgecafdgghffiihh');
    expect(encodeRegions(session.assignment)).toBe('a..b...d........ec.f.g...f...hffii..');
    expect(session.hintCount).toBe(2);
    expect(session.elapsedSeconds).toBe(6);
    expect(session.status).toBe('playing');
    expect(session.history).toEqual([]);
  });

  it('keeps the two slots apart: the key says which game a record is', async () => {
    const swapped = createMemoryKV({
      [SR_STORAGE_KEYS.game]: RELEASED[SR_STORAGE_KEYS.dailyGame]!,
      [SR_STORAGE_KEYS.dailyGame]: RELEASED[SR_STORAGE_KEYS.game]!,
    });
    expect(await loadRecord(gameSchema, swapped)).toBeNull();
    expect(await loadRecord(dailyGameSchema, swapped)).toBeNull();
  });
});

describe("the daily is today's one board", () => {
  it('drops a suspended daily left from an earlier day, record and all', async () => {
    const kv = released();
    const saved = await loadSavedGames(kv, '2026-10-03');
    expect(saved.daily).toBeNull();
    expect(await kv.get(SR_STORAGE_KEYS.dailyGame)).toBeNull();
    // The difficulty game is another slot and another matter: untouched.
    expect(saved.difficulty?.seed).toBe('shape-regions-hard-muqptm2n-3f4h7');
    expect(await kv.get(SR_STORAGE_KEYS.game)).toBe(RELEASED[SR_STORAGE_KEYS.game]);
  });

  it('keeps it on the day it was played', async () => {
    const kv = released();
    expect((await loadSavedGames(kv, CAPTURED_DAY)).daily?.dailyDate).toBe(CAPTURED_DAY);
    expect(await kv.get(SR_STORAGE_KEYS.dailyGame)).toBe(RELEASED[SR_STORAGE_KEYS.dailyGame]);
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [SR_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preferences default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [SR_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [SR_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no game to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({
      [SR_STORAGE_KEYS.game]: raw,
      [SR_STORAGE_KEYS.dailyGame]: raw,
    });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
    expect(await loadSavedGames(kv, CAPTURED_DAY)).toEqual({ difficulty: null, daily: null });
  });

  it('discards a board that does not decode rather than repairing it', async () => {
    // A shorter board string is not a smaller board — it is a record from
    // something that is not this game (§11).
    const kv = createMemoryKV({
      [SR_STORAGE_KEYS.game]: RELEASED[SR_STORAGE_KEYS.game]!.replace(
        '"assignment":"...c...ea.f...e......e..b..de..hi..jjj....jll..gk"',
        '"assignment":"...c"',
      ),
    });
    expect((await loadSavedGames(kv, CAPTURED_DAY)).difficulty).toBeNull();
  });
});

describe('a suspended game comes back the way it was left', () => {
  it('survives the round trip through storage, both slots', async () => {
    const base = createDifficultySession('easy', 'shape-regions-round-trip');
    const clue = base.clues[0]!;
    const ownCell = neighbors(clue.index, base.width, base.height).find(
      (cell) => base.solution[cell] === base.solution[clue.index],
    )!;
    const played = doHintUse(doStroke(base, base.solution[clue.index]!, [ownCell])!);
    const daily = createDailySession('2026-10-04');

    const kv = createMemoryKV();
    await saveGame({ ...played, elapsedSeconds: 41 }, kv);
    await saveGame(daily, kv);
    const restored = await loadSavedGames(kv, '2026-10-04');

    expect(restored.difficulty).not.toBeNull();
    expect(restored.difficulty!.seed).toBe('shape-regions-round-trip');
    expect(restored.difficulty!.difficulty).toBe('easy');
    expect(encodeRegions(restored.difficulty!.assignment)).toBe(encodeRegions(played.assignment));
    expect(encodeRegions(restored.difficulty!.solution)).toBe(encodeRegions(played.solution));
    expect(restored.difficulty!.clues).toEqual(played.clues);
    expect(restored.difficulty!.hintCount).toBe(1);
    expect(restored.difficulty!.elapsedSeconds).toBe(41);
    expect(restored.difficulty!.status).toBe('playing');

    expect(restored.daily).not.toBeNull();
    expect(restored.daily!.seed).toBe('shape-regions-daily-2026-10-04');
    expect(restored.daily!.dailyDate).toBe('2026-10-04');
    expect(encodeRegions(restored.daily!.assignment)).toBe(encodeRegions(daily.assignment));
  });
});
