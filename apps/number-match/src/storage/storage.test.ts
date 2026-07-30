import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession } from '../game';
import { clearSavedGame, loadSavedGames, saveGame } from './gamePersistence';
import { createMemoryKV } from './kv';
import { clearAllLocalData, loadRecord, saveRecord } from './repo';
import {
  adStateSchema,
  flagsSchema,
  gameSchema,
  progressSchema,
  rcCacheSchema,
  settingsSchema,
  statsSchema,
  STORAGE_KEYS,
} from './schemas';

describe('loadRecord', () => {
  it('returns defaults when nothing is stored', async () => {
    const kv = createMemoryKV();
    const settings = await loadRecord(settingsSchema, kv);
    expect(settings).toEqual(settingsSchema.defaultValue());
  });

  it('returns defaults for corrupt JSON without crashing', async () => {
    const kv = createMemoryKV({ [STORAGE_KEYS.settings]: '{not json!!' });
    const settings = await loadRecord(settingsSchema, kv);
    expect(settings).toEqual(settingsSchema.defaultValue());
  });

  it('returns defaults for an unknown schemaVersion (every schema)', async () => {
    const schemas: import('./schemas').SchemaDef<unknown>[] = [
      settingsSchema,
      statsSchema,
      flagsSchema,
      adStateSchema,
      rcCacheSchema,
      progressSchema,
    ];
    for (const schema of schemas) {
      const kv = createMemoryKV({ [schema.key]: JSON.stringify({ schemaVersion: 99 }) });
      expect(await loadRecord(schema, kv)).toEqual(schema.defaultValue());
    }
    // The saved game falls back to null → no resume, never a crash.
    const kv = createMemoryKV({ [STORAGE_KEYS.game]: JSON.stringify({ schemaVersion: 99 }) });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
  });

  it('returns defaults for structurally invalid data', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.stats]: JSON.stringify({ schemaVersion: 1, classic: { played: 'many' } }),
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it('round-trips valid records', async () => {
    const kv = createMemoryKV();
    const settings = { ...settingsSchema.defaultValue(), theme: 'dark' as const, sound: false };
    await saveRecord(settingsSchema, settings, kv);
    expect(await loadRecord(settingsSchema, kv)).toEqual(settings);

    const stats = statsSchema.defaultValue();
    stats.level.played = 3;
    stats.daily.streak = 2;
    stats.daily.lastCompletedDate = '2026-07-26';
    await saveRecord(statsSchema, stats, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);

    const adState = { ...adStateSchema.defaultValue(), sessionCount: 5, lastInterstitialAt: 123 };
    await saveRecord(adStateSchema, adState, kv);
    expect(await loadRecord(adStateSchema, kv)).toEqual(adState);

    const rc = { ...rcCacheSchema.defaultValue(), values: { interstitial_enabled: false }, fetchedAt: 42 };
    await saveRecord(rcCacheSchema, rc, kv);
    expect(await loadRecord(rcCacheSchema, kv)).toEqual(rc);

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

  it('drops unknown-typed values from the rc cache instead of failing', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.rcCache]: JSON.stringify({
        schemaVersion: 1,
        values: { good: 1, alsoGood: true, bad: 'string', worse: { nested: 1 } },
        fetchedAt: null,
      }),
    });
    const rc = await loadRecord(rcCacheSchema, kv);
    expect(rc.values).toEqual({ good: 1, alsoGood: true });
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
    const raw = JSON.parse((await kv.get(STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.values = '99x99';
    raw.mask = '000';
    await kv.set(STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).level).toBeNull();
  });

  it('requires dailyDate for daily games', async () => {
    const kv = createMemoryKV();
    const session = createLevelSession(3);
    await saveGame(session, kv);
    const raw = JSON.parse((await kv.get(STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.mode = 'daily';
    raw.dailyDate = null;
    await kv.set(STORAGE_KEYS.game, JSON.stringify(raw));
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
    const raw = JSON.parse((await kv.get(STORAGE_KEYS.game))!) as Record<string, unknown>;
    raw.values = '1'.repeat(271);
    raw.mask = '0'.repeat(271);
    await kv.set(STORAGE_KEYS.game, JSON.stringify(raw));
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

describe('two save slots', () => {
  it('keeps a level game and a daily game at the same time', async () => {
    const kv = createMemoryKV();
    await saveGame(createLevelSession(4), kv);
    await saveGame(createDailySession('2026-07-28'), kv);
    const games = await loadSavedGames(kv);
    expect(games.level?.level).toBe(4);
    expect(games.daily?.dailyDate).toBe('2026-07-28');
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
    const kv = createMemoryKV({ [STORAGE_KEYS.game]: JSON.stringify(v1) });
    const games = await loadSavedGames(kv);
    expect(games.level).toBeNull();
    expect(games.daily).not.toBeNull();
    expect(games.daily!.mode).toBe('daily');
    expect(games.daily!.level).toBeNull();
    expect(games.daily!.score.total).toBe(0);
    expect(games.daily!.elapsedSeconds).toBe(30);
    // The legacy key is emptied so it cannot shadow a future daily game.
    expect(await kv.get(STORAGE_KEYS.game)).toBeNull();
    expect(await kv.get(STORAGE_KEYS.dailyGame)).not.toBeNull();
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
    const kv = createMemoryKV({ [STORAGE_KEYS.game]: JSON.stringify(v1) });
    expect((await loadSavedGames(kv)).level).toBeNull();
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
    const kv = createMemoryKV({ [STORAGE_KEYS.stats]: JSON.stringify(v1) });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.schemaVersion).toBe(2);
    expect(stats.level.played).toBe(7);
    expect(stats.level.bestClearSeconds).toBe(90);
    expect(stats.daily.streak).toBe(2);
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
      [STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 1,
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
      [STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 1,
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
});

describe('clearAllLocalData', () => {
  it('wipes every stored record', async () => {
    const kv = createMemoryKV();
    await saveRecord(settingsSchema, settingsSchema.defaultValue(), kv);
    await saveGame(createLevelSession(3), kv);
    await clearAllLocalData(kv);
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(await kv.get(key)).toBeNull();
    }
  });
});
