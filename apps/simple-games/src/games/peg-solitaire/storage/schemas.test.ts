/**
 * Every record this game keeps, read back through its schema
 * (docs/PEG_SOLITAIRE_RULES.md §11): what play writes comes back unchanged,
 * and anything else — truncated JSON, wrong types, a board play could not
 * have produced, a finished game, a problem never dealt — fails closed to the
 * default, never throws, and touches no other key.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord } from '@/storage/repo';
import {
  ENGLISH_SOLUTION,
  parseEnglishJumps,
  TRIANGLE_APEX_PREFIX,
  TRIANGLE_APEX_STUCK,
} from '../game/fixtures';
import {
  flagsSchema,
  gameSchema,
  PG_STORAGE_KEYS,
  prefsSchema,
  statsSchema,
  type PersistedGame,
  type Stats,
} from './schemas';

const stored = (key: string, value: unknown) => createMemoryKV({ [key]: JSON.stringify(value) });
const raw = (key: string, text: string) => createMemoryKV({ [key]: text });

const SOLUTION = parseEnglishJumps(ENGLISH_SOLUTION);

/** A real save: the cross's standard problem, three jumps in. */
const ENGLISH_SAVE: PersistedGame = {
  schemaVersion: 1,
  board: 'english',
  start: 16,
  target: 16,
  jumps: SOLUTION.slice(0, 3),
  elapsedSeconds: 61,
  savedAt: 1792200000000,
};

const TRIANGLE_SAVE: PersistedGame = {
  schemaVersion: 1,
  board: 'triangle',
  start: 0,
  target: 0,
  jumps: TRIANGLE_APEX_PREFIX.map(([from, to]) => [from, to]),
  elapsedSeconds: 0,
  savedAt: 0,
};

const loadGame = (value: unknown) => loadRecord(gameSchema, stored(PG_STORAGE_KEYS.game, value));

describe('the keys (§11)', () => {
  it('are the four this game owns, in registry order, all under pg.', () => {
    expect(Object.values(PG_STORAGE_KEYS)).toEqual([
      'pg.saveGame',
      'pg.stats',
      'pg.flags',
      'pg.prefs',
    ]);
    expect([gameSchema, statsSchema, flagsSchema, prefsSchema].map((s) => s.key)).toEqual([
      'pg.saveGame',
      'pg.stats',
      'pg.flags',
      'pg.prefs',
    ]);
  });
});

describe('pg.saveGame (§11)', () => {
  it('round-trips a game in progress on either board, history and clock included', async () => {
    expect(await loadGame(ENGLISH_SAVE)).toEqual(ENGLISH_SAVE);
    expect(await loadGame(TRIANGLE_SAVE)).toEqual(TRIANGLE_SAVE);
    // The opening itself is a game in progress: no jumps yet.
    const opening = { ...ENGLISH_SAVE, jumps: [], elapsedSeconds: 0 };
    expect(await loadGame(opening)).toEqual(opening);
  });

  it('keeps `cleared: true` on a game whose perfect clear was undone, and drops `false` (§10)', async () => {
    // The triangle save is the clear's last jump taken back.
    const undoneClear: PersistedGame = { ...TRIANGLE_SAVE, cleared: true };
    expect(await loadGame(undoneClear)).toEqual(undoneClear);
    // Undone all the way to the opening, it is still the game that was cleared.
    const opening: PersistedGame = { ...TRIANGLE_SAVE, jumps: [], cleared: true };
    expect(await loadGame(opening)).toEqual(opening);
    // `false` is what an absent field means; it reads back as absent.
    const loaded = await loadGame({ ...ENGLISH_SAVE, cleared: false });
    expect(loaded).toEqual(ENGLISH_SAVE);
    expect(loaded).not.toHaveProperty('cleared');
  });

  it('reads nothing as nothing', async () => {
    expect(await loadRecord(gameSchema, createMemoryKV({}))).toBeNull();
  });

  it('discards truncated or unparsable JSON', async () => {
    const text = JSON.stringify(ENGLISH_SAVE);
    for (const broken of [text.slice(0, text.length - 5), '{', 'not json', '']) {
      expect(await loadRecord(gameSchema, raw(PG_STORAGE_KEYS.game, broken))).toBeNull();
    }
  });

  it('discards a record that is not one, or of another version', async () => {
    for (const value of [null, 7, 'english', [], [ENGLISH_SAVE]]) {
      expect(await loadGame(value)).toBeNull();
    }
    expect(await loadGame({ ...ENGLISH_SAVE, schemaVersion: 2 })).toBeNull();
    expect(await loadGame({ ...ENGLISH_SAVE, schemaVersion: '1' })).toBeNull();
  });

  it('discards wrong types field by field', async () => {
    const wrong: Partial<Record<keyof PersistedGame, unknown>>[] = [
      { board: 'square' },
      { board: 'toString' },
      { board: 1 },
      { start: '16' },
      { start: 16.5 },
      { target: null },
      { jumps: 'd2-d4' },
      { jumps: [[4, 16, 9]] },
      { jumps: [{ from: 4, to: 16 }] },
      { jumps: [[4, '16']] },
      { elapsedSeconds: -1 },
      { elapsedSeconds: 1.5 },
      { elapsedSeconds: '61' },
      { elapsedSeconds: 1e9 + 1 },
      { savedAt: -1 },
      { savedAt: 1e15 + 1 },
      { savedAt: '1792200000000' },
      { cleared: null },
      { cleared: 'true' },
      { cleared: 1 },
    ];
    for (const change of wrong) {
      expect(await loadGame({ ...ENGLISH_SAVE, ...change }), JSON.stringify(change)).toBeNull();
    }
    for (const field of ['board', 'start', 'target', 'jumps', 'elapsedSeconds', 'savedAt']) {
      const missing: Record<string, unknown> = { ...ENGLISH_SAVE };
      delete missing[field];
      expect(await loadGame(missing), `without ${field}`).toBeNull();
    }
  });

  it('discards a problem this game never deals', async () => {
    // Every other start or target on the cross, and a triangle pairing that
    // cannot be cleared (an inner hole back to itself, §8).
    expect(await loadGame({ ...ENGLISH_SAVE, start: 0, jumps: [] })).toBeNull();
    expect(await loadGame({ ...ENGLISH_SAVE, target: 0 })).toBeNull();
    expect(await loadGame({ ...TRIANGLE_SAVE, start: 4, target: 4, jumps: [] })).toBeNull();
    // Holes that do not exist on that board.
    expect(await loadGame({ ...TRIANGLE_SAVE, start: 16, target: 16, jumps: [] })).toBeNull();
  });

  it('discards a board play could not have produced', async () => {
    // A jump that is not legal where it was played: out of order, repeated,
    // diagonal on the cross, or off the triangle's lines.
    const [first, second, third] = SOLUTION;
    expect(await loadGame({ ...ENGLISH_SAVE, jumps: [second, first, third] })).toBeNull();
    expect(await loadGame({ ...ENGLISH_SAVE, jumps: [first, first] })).toBeNull();
    // b5 over c4 to d3 after d2-d4: three in a diagonal row, into an empty hole.
    expect(
      await loadGame({
        ...ENGLISH_SAVE,
        jumps: [
          [4, 16],
          [21, 9],
        ],
      }),
    ).toBeNull();
    // Triangle: holes 6 → 8 → 11 look evenly spaced but are not a line, and
    // neither is straight down the screen (1 → 5) — both into an empty hole.
    expect(
      await loadGame({ ...TRIANGLE_SAVE, start: 10, target: 10, jumps: [[5, 10]] }),
    ).toBeNull();
    expect(await loadGame({ ...TRIANGLE_SAVE, start: 4, target: 12, jumps: [[0, 4]] })).toBeNull();
    // More jumps than a game on that board can hold.
    const tooMany = Array.from({ length: 14 }, () => [3, 0]);
    expect(await loadGame({ ...TRIANGLE_SAVE, jumps: tooMany })).toBeNull();
  });

  it('discards a finished game: perfect, stuck, or one peg off the ring', async () => {
    expect(await loadGame({ ...ENGLISH_SAVE, jumps: SOLUTION })).toBeNull();
    expect(
      await loadGame({ ...TRIANGLE_SAVE, jumps: TRIANGLE_APEX_STUCK.map(([f, t]) => [f, t]) }),
    ).toBeNull();
    expect(
      await loadGame({ ...TRIANGLE_SAVE, jumps: [...TRIANGLE_SAVE.jumps, [1, 6]] }),
    ).toBeNull();
  });

  it('reads −0 as 0 and drops fields it does not know', async () => {
    // JSON cannot carry −0, so the validator is handed it directly.
    const validated = gameSchema.validate({ ...ENGLISH_SAVE, elapsedSeconds: -0 });
    expect(Object.is(validated?.elapsedSeconds, 0)).toBe(true);
    const loaded = await loadGame({ ...ENGLISH_SAVE, extra: 'x' });
    expect(loaded).toEqual(ENGLISH_SAVE);
    expect(loaded).not.toHaveProperty('extra');
  });
});

describe('pg.stats (§10, §11)', () => {
  const STATS: Stats = {
    schemaVersion: 1,
    english: { played: 12, best: 1, perfect: 2 },
    triangle: { played: 30, best: 3, perfect: 0 },
    totalPlaySeconds: 5400,
  };
  const loadStats = (value: unknown) =>
    loadRecord(statsSchema, stored(PG_STORAGE_KEYS.stats, value));

  it('round-trips, and starts from zero and no record', async () => {
    expect(await loadStats(STATS)).toEqual(STATS);
    expect(statsSchema.defaultValue()).toEqual({
      schemaVersion: 1,
      english: { played: 0, best: null, perfect: 0 },
      triangle: { played: 0, best: null, perfect: 0 },
      totalPlaySeconds: 0,
    });
  });

  it('falls back to the default for anything out of range or of the wrong type', async () => {
    const bad: unknown[] = [
      { ...STATS, schemaVersion: 2 },
      { ...STATS, totalPlaySeconds: -1 },
      { ...STATS, totalPlaySeconds: 1e12 + 1 },
      { ...STATS, english: { ...STATS.english, played: -1 } },
      { ...STATS, english: { ...STATS.english, played: 0.5 } },
      { ...STATS, english: { ...STATS.english, perfect: '2' } },
      // best: never 0 (a jump leaves its jumper), never more than holes − 2.
      { ...STATS, triangle: { ...STATS.triangle, best: 0 } },
      { ...STATS, triangle: { ...STATS.triangle, best: 14 } },
      { ...STATS, english: { ...STATS.english, best: 32, perfect: 0 } },
      { ...STATS, triangle: { played: 1, perfect: 0 } },
      { ...STATS, triangle: undefined },
      { ...STATS, english: [] },
    ];
    for (const value of bad) {
      expect(await loadStats(value), JSON.stringify(value)).toEqual(statsSchema.defaultValue());
    }
    expect(
      await loadRecord(statsSchema, raw(PG_STORAGE_KEYS.stats, '{"schemaVersion":1,"engl')),
    ).toEqual(statsSchema.defaultValue());
  });

  it('accepts the widest legal values on each board', async () => {
    const wide: Stats = {
      schemaVersion: 1,
      english: { played: 1e9, best: 31, perfect: 0 },
      triangle: { played: 0, best: 13, perfect: 0 },
      totalPlaySeconds: 1e12,
    };
    expect(await loadStats(wide)).toEqual(wide);
  });

  it('refuses a perfect clear without a one-peg record, the one cross-check play cannot break', async () => {
    expect(await loadStats({ ...STATS, triangle: { played: 4, best: 2, perfect: 1 } })).toEqual(
      statsSchema.defaultValue(),
    );
    expect(await loadStats({ ...STATS, triangle: { played: 4, best: null, perfect: 1 } })).toEqual(
      statsSchema.defaultValue(),
    );
  });

  it('does not hold `played` against the other fields (§11)', async () => {
    // pg.stats fell back to its default while a game was suspended; the game
    // was resumed (not counted as played) and cleared.
    const lagging: Stats = {
      ...STATS,
      english: { played: 0, best: 1, perfect: 1 },
      triangle: { played: 0, best: 4, perfect: 0 },
    };
    expect(await loadStats(lagging)).toEqual(lagging);
  });
});

describe('pg.flags', () => {
  it('round-trips and falls back to "not seen yet"', async () => {
    const seen = { schemaVersion: 1, tutorialCompleted: true };
    expect(await loadRecord(flagsSchema, stored(PG_STORAGE_KEYS.flags, seen))).toEqual(seen);
    for (const value of [{ schemaVersion: 1, tutorialCompleted: 'yes' }, { schemaVersion: 2 }, 3]) {
      expect(await loadRecord(flagsSchema, stored(PG_STORAGE_KEYS.flags, value))).toEqual({
        schemaVersion: 1,
        tutorialCompleted: false,
      });
    }
  });
});

describe('pg.prefs (§7, §11)', () => {
  const loadPrefs = (value: unknown) =>
    loadRecord(prefsSchema, stored(PG_STORAGE_KEYS.prefs, value));

  it('keeps the board chosen last, English to begin with', async () => {
    expect(prefsSchema.defaultValue()).toEqual({ schemaVersion: 1, board: 'english' });
    expect(await loadPrefs({ schemaVersion: 1, board: 'triangle' })).toEqual({
      schemaVersion: 1,
      board: 'triangle',
    });
  });

  it('reads any other board — even a name every object has — as English', async () => {
    for (const board of ['toString', 'constructor', '__proto__', 'square', '', 1, null]) {
      expect(await loadPrefs({ schemaVersion: 1, board }), String(board)).toEqual({
        schemaVersion: 1,
        board: 'english',
      });
    }
    expect(await loadRecord(prefsSchema, raw(PG_STORAGE_KEYS.prefs, '{"schema'))).toEqual({
      schemaVersion: 1,
      board: 'english',
    });
  });
});

describe('validators never throw (§11)', () => {
  it('answers null for every odd value it is handed', () => {
    const odd: unknown[] = [
      undefined,
      null,
      0,
      -0,
      NaN,
      '',
      [],
      {},
      { schemaVersion: 1 },
      { schemaVersion: 1, board: 'english', start: 16, target: 16, jumps: [[null, null]] },
      Object.create(null),
    ];
    for (const value of odd) {
      for (const schema of [gameSchema, statsSchema, flagsSchema, prefsSchema]) {
        expect(() => schema.validate(value)).not.toThrow();
      }
      expect(gameSchema.validate(value)).toBeNull();
    }
  });
});
