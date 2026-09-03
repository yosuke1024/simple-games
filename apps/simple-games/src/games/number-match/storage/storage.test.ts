import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { clearLocalData, loadRecord, saveRecord } from '../../../storage/repo';
import { createDailySession, createFreeSession, createLevelSession } from '../game';
import { clearSavedGame, loadSavedGames, saveGame } from './gamePersistence';
import {
  flagsSchema,
  gameSchema,
  NM_STORAGE_KEYS,
  prefsSchema,
  progressSchema,
  statsSchema,
} from './schemas';

describe('loadRecord (Number Match records)', () => {
  it('returns defaults for an unknown schemaVersion (every schema)', async () => {
    const schemas: import('../../../storage/schemas').SchemaDef<unknown>[] = [
      statsSchema,
      flagsSchema,
      progressSchema,
      prefsSchema,
    ];
    for (const schema of schemas) {
      const kv = createMemoryKV({ [schema.key]: JSON.stringify({ schemaVersion: 99 }) });
      expect(await loadRecord(schema, kv)).toEqual(schema.defaultValue());
    }
    // The saved game falls back to null → no resume, never a crash.
    const kv = createMemoryKV({ [NM_STORAGE_KEYS.game]: JSON.stringify({ schemaVersion: 99 }) });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
  });

  it('returns defaults for structurally invalid data', async () => {
    const kv = createMemoryKV({
      [NM_STORAGE_KEYS.stats]: JSON.stringify({ schemaVersion: 1, classic: { played: 'many' } }),
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it('round-trips valid records', async () => {
    const kv = createMemoryKV();
    const stats = statsSchema.defaultValue();
    stats.level.played = 3;
    stats.daily.cleared = 2;
    await saveRecord(statsSchema, stats, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);

    const flags = { ...flagsSchema.defaultValue(), tutorialCompleted: true };
    await saveRecord(flagsSchema, flags, kv);
    expect(await loadRecord(flagsSchema, kv)).toEqual(flags);
  });

  it('keeps a flags record written before the intro flags existed', () => {
    // A flag added later means "not seen yet", not a corrupt record — dropping
    // it would send a returning player back through the tutorial.
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
      wildIntroSeen: false,
      stoneIntroSeen: false,
    });
  });

  it('keeps a stats record written before the free bucket existed', () => {
    // Nothing had been counted there yet (§11): an empty bucket, not a
    // rejected record that would zero the level and daily counts too.
    const level = {
      played: 4,
      cleared: 2,
      gameOver: 1,
      totalPlaySeconds: 300,
      bestClearSeconds: 70,
    };
    const daily = {
      played: 3,
      cleared: 3,
      gameOver: 0,
      totalPlaySeconds: 250,
      bestClearSeconds: 60,
    };
    expect(statsSchema.validate({ schemaVersion: 3, level, daily })).toEqual({
      schemaVersion: 3,
      level,
      daily,
      free: { played: 0, cleared: 0, gameOver: 0, totalPlaySeconds: 0, bestClearSeconds: null },
    });
  });
});

describe('saved game persistence', () => {
  it('round-trips a playing session (without undo history)', async () => {
    const kv = createMemoryKV();
    const session = createLevelSession(3);
    await saveGame(session, kv);
    const loaded = (await loadSavedGames(kv)).level;
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe('level-3');
    expect(loaded!.level).toBe(3);
    expect(loaded!.board).toEqual(session.board);
    expect(loaded!.history).toEqual([]);
    expect(loaded!.status).toBe('playing');
  });

  it('returns null for corrupt board data', async () => {
    const kv = createMemoryKV();
    const session = createLevelSession(3);
    await saveGame(session, kv);
    const raw = JSON.parse((await kv.get(NM_STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.values = '99x99';
    raw.mask = '000';
    await kv.set(NM_STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).level).toBeNull();
  });

  it('requires dailyDate for daily games', async () => {
    const kv = createMemoryKV();
    const session = createLevelSession(3);
    await saveGame(session, kv);
    const raw = JSON.parse((await kv.get(NM_STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.mode = 'daily';
    raw.dailyDate = null;
    await kv.set(NM_STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).level).toBeNull();
  });

  it('does not resume a game that is no longer playable (terminal board)', async () => {
    const kv = createMemoryKV();
    const session = createLevelSession(3);
    // All cells cleared → status would be 'cleared', not 'playing'.
    const emptied = session.board.map((c) => (c === null ? null : { ...c, cleared: true }));
    await saveGame({ ...session, board: emptied }, kv);
    expect((await loadSavedGames(kv)).level).toBeNull();
  });

  it('rejects boards larger than the maximum board size', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(3), kv);
    const raw = JSON.parse((await kv.get(NM_STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.values = '1'.repeat(271);
    raw.mask = '0'.repeat(271);
    await kv.set(NM_STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).level).toBeNull();
  });

  it('clearSavedGame removes the stored game', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(3), kv);
    await clearSavedGame('level', kv);
    expect((await loadSavedGames(kv)).level).toBeNull();
    expect(await loadRecord(gameSchema, kv)).toBeNull();
  });
});

describe('three save slots', () => {
  it('keeps a level game, a daily game and a free board at the same time', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(4), kv);
    await saveGame(createDailySession('2026-07-28'), kv);
    const free = createFreeSession('hard');
    await saveGame(free, kv);
    const games = await loadSavedGames(kv);
    expect(games.level?.level).toBe(4);
    expect(games.daily?.dailyDate).toBe('2026-07-28');
    expect(games.free?.freeTier).toBe('hard');
    expect(games.free?.seed).toBe(free.seed);
    expect(games.free?.board).toEqual(free.board);
  });

  it('clearing the free slot leaves the other two intact', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(4), kv);
    await saveGame(createDailySession('2026-07-28'), kv);
    await saveGame(createFreeSession('easy'), kv);
    await clearSavedGame('free', kv);
    const games = await loadSavedGames(kv);
    expect(games.level?.level).toBe(4);
    expect(games.daily?.dailyDate).toBe('2026-07-28');
    expect(games.free).toBeNull();
  });

  it('clearing one slot leaves the other intact', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(4), kv);
    await saveGame(createDailySession('2026-07-28'), kv);
    await clearSavedGame('daily', kv);
    const games = await loadSavedGames(kv);
    expect(games.level?.level).toBe(4);
    expect(games.daily).toBeNull();
  });

  it('starting another daily replaces only the daily slot', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(4), kv);
    await saveGame(createDailySession('2026-07-27'), kv);
    await saveGame(createDailySession('2026-07-28'), kv);
    const games = await loadSavedGames(kv);
    expect(games.level?.level).toBe(4);
    expect(games.daily?.dailyDate).toBe('2026-07-28');
  });
});

describe('schema migrations', () => {
  it('migrates a v1 daily save to v2, into the daily slot, with a fresh score', async () => {
    const v1 = {
      schemaVersion: 1,
      mode: 'daily',
      seed: 'daily-2026-07-26',
      dailyDate: '2026-07-26',
      values: '19',
      mask: '00',
      moveCount: 2,
      addCount: 0,
      hintCount: 1,
      elapsedSeconds: 30,
      savedAt: 123,
    };
    const kv = createMemoryKV({ [NM_STORAGE_KEYS.game]: JSON.stringify(v1) });
    const games = await loadSavedGames(kv);
    expect(games.level).toBeNull();
    expect(games.daily).not.toBeNull();
    expect(games.daily!.mode).toBe('daily');
    expect(games.daily!.level).toBeNull();
    expect(games.daily!.score.total).toBe(0);
    expect(games.daily!.elapsedSeconds).toBe(30);
    // The legacy key is emptied so it cannot shadow a future daily game.
    expect(await kv.get(NM_STORAGE_KEYS.game)).toBeNull();
    expect(await kv.get(NM_STORAGE_KEYS.dailyGame)).not.toBeNull();
  });

  it('drops a v1 classic save (no level context to resume into)', async () => {
    const v1 = {
      schemaVersion: 1,
      mode: 'classic',
      seed: 'abc',
      dailyDate: null,
      values: '19',
      mask: '00',
      moveCount: 0,
      addCount: 0,
      hintCount: 0,
      elapsedSeconds: 0,
      savedAt: 123,
    };
    const kv = createMemoryKV({ [NM_STORAGE_KEYS.game]: JSON.stringify(v1) });
    expect((await loadSavedGames(kv)).level).toBeNull();
  });

  it('migrates v2 stats to v3: streak fields are dropped, counts survive', async () => {
    const v2 = {
      schemaVersion: 2,
      level: { played: 4, cleared: 2, gameOver: 1, totalPlaySeconds: 300, bestClearSeconds: 70 },
      daily: {
        played: 3,
        cleared: 3,
        gameOver: 0,
        totalPlaySeconds: 250,
        bestClearSeconds: 60,
        lastCompletedDate: '2026-07-28',
        streak: 3,
        bestStreak: 5,
      },
    };
    const kv = createMemoryKV({ [NM_STORAGE_KEYS.stats]: JSON.stringify(v2) });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats).toEqual({
      schemaVersion: 3,
      level: { played: 4, cleared: 2, gameOver: 1, totalPlaySeconds: 300, bestClearSeconds: 70 },
      daily: { played: 3, cleared: 3, gameOver: 0, totalPlaySeconds: 250, bestClearSeconds: 60 },
      free: { played: 0, cleared: 0, gameOver: 0, totalPlaySeconds: 0, bestClearSeconds: null },
    });
  });

  it('migrates v1 stats: the classic bucket becomes the level bucket', async () => {
    const v1 = {
      schemaVersion: 1,
      classic: { played: 7, cleared: 3, gameOver: 1, totalPlaySeconds: 500, bestClearSeconds: 90 },
      daily: {
        played: 2,
        cleared: 2,
        gameOver: 0,
        totalPlaySeconds: 200,
        bestClearSeconds: 80,
        lastCompletedDate: '2026-07-26',
        streak: 2,
        bestStreak: 2,
      },
    };
    const kv = createMemoryKV({ [NM_STORAGE_KEYS.stats]: JSON.stringify(v1) });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.schemaVersion).toBe(3);
    expect(stats.level.played).toBe(7);
    expect(stats.level.bestClearSeconds).toBe(90);
    expect(stats.daily.cleared).toBe(2);
  });
});

describe('progress record', () => {
  it('round-trips progress', async () => {
    const kv = createMemoryKV();
    const progress = {
      ...progressSchema.defaultValue(),
      highestUnlocked: 12,
      bestScores: { '1': 200, '11': 350 },
      bestDaily: { '2026-07-27': 240 },
      topScores: [{ mode: 'level' as const, ref: '11', score: 350, at: 5 }],
    };
    await saveRecord(progressSchema, progress, kv);
    expect(await loadRecord(progressSchema, kv)).toEqual(progress);
  });

  it('drops malformed best-score and top-score entries instead of failing', async () => {
    const kv = createMemoryKV({
      [NM_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 2,
        highestUnlocked: 5,
        bestScores: { '3': 100, '0': 50, '1000': 50, bogus: 1, '4': 'high' },
        bestDaily: { '2026-07-27': 200, 'not-a-date': 5, '2026-07-26': 'high' },
        topScores: [
          { mode: 'level', ref: '3', score: 100, at: 1 },
          { mode: 'nope', ref: '4', score: 1, at: 1 },
          'junk',
        ],
      }),
    });
    const progress = await loadRecord(progressSchema, kv);
    expect(progress.highestUnlocked).toBe(5);
    expect(progress.bestScores).toEqual({ '3': 100 });
    expect(progress.bestDaily).toEqual({ '2026-07-27': 200 });
    expect(progress.topScores).toHaveLength(1);
  });

  it('canonicalizes padded level keys and enforces top-score invariants', async () => {
    const kv = createMemoryKV({
      [NM_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 2,
        highestUnlocked: 5,
        bestScores: { '042': 100, '42': 80 },
        bestDaily: {},
        topScores: [
          { mode: 'level', ref: '1', score: 50, at: 2 },
          { mode: 'level', ref: '1', score: 90, at: 3 }, // dup: keep best
          { mode: 'level', ref: '2', score: 70, at: 1 },
        ],
      }),
    });
    const progress = await loadRecord(progressSchema, kv);
    expect(progress.bestScores).toEqual({ '42': 100 }); // canonical key, max kept
    expect(progress.topScores).toEqual([
      { mode: 'level', ref: '1', score: 90, at: 3 },
      { mode: 'level', ref: '2', score: 70, at: 1 },
    ]);
  });

  /**
   * The v1 → v2 migration (§11). Shrinking the ladder from 999 levels to 100
   * changed what a level number means, so level progress is dropped rather than
   * rescaled — but a player's dailies never came from the level list, and
   * losing them would be destroying history for no reason.
   */
  it('resets level progress but keeps the dailies when migrating from v1', async () => {
    const kv = createMemoryKV({
      [NM_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 1,
        highestUnlocked: 350,
        bestScores: { '1': 200, '349': 900 },
        bestDaily: { '2026-07-27': 240, '2026-07-28': 260 },
        topScores: [
          { mode: 'level', ref: '349', score: 900, at: 5 },
          { mode: 'daily', ref: '2026-07-28', score: 260, at: 6 },
        ],
      }),
    });
    const progress = await loadRecord(progressSchema, kv);
    expect(progress.schemaVersion).toBe(2);
    expect(progress.highestUnlocked).toBe(1);
    expect(progress.bestScores).toEqual({});
    expect(progress.bestDaily).toEqual({ '2026-07-27': 240, '2026-07-28': 260 });
    // The level row would be a score against a board that no longer exists.
    expect(progress.topScores).toEqual([{ mode: 'daily', ref: '2026-07-28', score: 260, at: 6 }]);
  });

  /**
   * The reason the migration is an explicit branch rather than a version bump
   * alone: a stored `highestUnlocked` of 350 is out of range for the new list,
   * and letting the range check see it would reject the whole record — taking
   * the daily history down with it.
   */
  it('does not let an out-of-range v1 level cost the player their daily history', async () => {
    const kv = createMemoryKV({
      [NM_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 1,
        highestUnlocked: 999,
        bestScores: {},
        bestDaily: { '2026-07-27': 240 },
        topScores: [],
      }),
    });
    expect((await loadRecord(progressSchema, kv)).bestDaily).toEqual({ '2026-07-27': 240 });
  });
});

describe("clearLocalData with the game's keys", () => {
  it('wipes every Number Match record', async () => {
    const kv = createMemoryKV();
    await saveRecord(statsSchema, statsSchema.defaultValue(), kv);
    await saveRecord(prefsSchema, { schemaVersion: 1, freeTier: 'hard' }, kv);
    await saveGame(createLevelSession(3), kv);
    await saveGame(createFreeSession('hard'), kv);
    await clearLocalData(Object.values(NM_STORAGE_KEYS), kv);
    for (const key of Object.values(NM_STORAGE_KEYS)) {
      expect(await kv.get(key)).toBeNull();
    }
  });
});
