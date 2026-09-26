/**
 * The persistence rules of docs/CROWN_GRID_RULES.md §11: two independent
 * slots, a save that never blocks play, and corrupt data that is read past
 * rather than repaired — plus the preferences of §9 and the statistics of
 * §10, which count solves and days and never a streak.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { createDailySession, createDifficultySession, doMarkCross, doTap } from '../game';
import { availableDailyDates } from '../state/progressLogic';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  dailiesSolved,
  previousBestFor,
} from '../state/statsLogic';
import { clearSavedGame, loadSavedGames, saveGame } from './gamePersistence';
import { CG_STORAGE_KEYS, flagsSchema, prefsSchema, statsSchema } from './schemas';

describe('storage keys', () => {
  it('all sit under the cg. prefix, apart from every other game', () => {
    for (const key of Object.values(CG_STORAGE_KEYS)) expect(key.startsWith('cg.')).toBe(true);
    expect(new Set(Object.values(CG_STORAGE_KEYS)).size).toBe(
      Object.values(CG_STORAGE_KEYS).length,
    );
  });
});

describe('preferences (§9)', () => {
  it('starts at easy and round-trips the difficulty last picked', async () => {
    const kv = createMemoryKV();
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'hard' }, kv);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('hard');
  });

  it('falls back to the default rather than throwing on nonsense', async () => {
    const kv = createMemoryKV({
      [CG_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"brutal"}',
      [CG_STORAGE_KEYS.flags]: 'not json at all',
    });
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('easy');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
    expect(prefsSchema.validate({ schemaVersion: 2, difficulty: 'hard' })).toBeNull();
  });
});

describe('statistics (§10)', () => {
  it('drops an unreadable day without losing the others', async () => {
    const kv = createMemoryKV({
      [CG_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        easy: { played: 3, solved: 2, totalPlaySeconds: 90, bestSeconds: 30 },
        medium: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        hard: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        dailyTimes: { '2026-08-03': 42, 'not-a-date': 10, '2026-08-04': 'soon' },
      }),
    });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.easy.played).toBe(3);
    expect(stats.dailyTimes).toEqual({ '2026-08-03': 42 });
  });

  it('counts plays, solves, fastest times and the record to beat', () => {
    let stats = statsSchema.defaultValue();
    stats = applyGameStart(stats, 'easy');
    stats = applyGameStart(stats, 'easy');
    stats = applyPlayTime(stats, 'easy', 70);

    const session = {
      ...createDifficultySession('easy', 'crown-grid-easy-stats'),
      elapsedSeconds: 40,
    };
    expect(previousBestFor(stats, session)).toBeNull();
    const first = applySolved(stats, session);
    expect(first.isNewBest).toBe(true);
    expect(first.stats.easy.solved).toBe(1);
    expect(first.stats.easy.bestSeconds).toBe(40);
    expect(first.stats.easy.totalPlaySeconds).toBe(70);
    expect(previousBestFor(first.stats, session)).toBe(40);

    // A slower solve keeps the faster time.
    const slower = applySolved(first.stats, { ...session, elapsedSeconds: 90 });
    expect(slower.isNewBest).toBe(false);
    expect(slower.stats.easy.bestSeconds).toBe(40);
  });

  it('records the days the daily was solved, and nothing that resembles a streak', () => {
    const daily = { ...createDailySession('2026-08-03'), elapsedSeconds: 55 };
    const outcome = applySolved(statsSchema.defaultValue(), daily);
    expect(outcome.stats.dailyTimes).toEqual({ '2026-08-03': 55 });
    expect(outcome.bestSeconds).toBe(55);
    expect(dailiesSolved(outcome.stats)).toBe(1);
    expect(Object.keys(outcome.stats)).not.toContain('streak');
  });
});

describe('the daily backlog (§9)', () => {
  it('opens today and the thirty days behind it, unconditionally', () => {
    const dates = availableDailyDates('2026-08-05');
    expect(dates[0]).toBe('2026-08-05');
    expect(dates[1]).toBe('2026-08-04');
    expect(dates).toHaveLength(30);
    expect(dates.every((date) => date <= '2026-08-05')).toBe(true);
  });
});

describe('saved games (§11)', () => {
  it('keeps a difficulty game and a daily in slots that cannot evict each other', async () => {
    const kv = createMemoryKV();
    const game = doMarkCross(
      doTap(createDifficultySession('easy', 'crown-grid-easy-slot2'), 0)!,
      [1, 2],
    )!;
    const daily = doTap(createDailySession('2026-08-03'), 5)!;
    await saveGame(game, kv);
    await saveGame(daily, kv);

    const loaded = await loadSavedGames(kv);
    expect(loaded.difficulty?.seed).toBe(game.seed);
    expect(loaded.difficulty?.regions).toEqual(game.regions);
    expect(loaded.difficulty?.marks).toEqual(game.marks);
    expect(loaded.daily?.dailyDate).toBe('2026-08-03');
    expect(loaded.daily?.marks).toEqual(daily.marks);

    await clearSavedGame('daily', kv);
    const after = await loadSavedGames(kv);
    expect(after.daily).toBeNull();
    expect(after.difficulty).not.toBeNull();
  });

  it('reads past a broken record instead of resuming a board that cannot be played', async () => {
    const kv = createMemoryKV();
    const game = doTap(createDifficultySession('medium', 'crown-grid-medium-broken'), 0)!;
    await saveGame(game, kv);

    const raw = JSON.parse((await kv.get(CG_STORAGE_KEYS.game))!) as Record<string, unknown>;
    // A board of the wrong size for the difficulty it claims.
    await kv.set(CG_STORAGE_KEYS.game, JSON.stringify({ ...raw, size: 9 }));
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
    // An answer that touches itself.
    await kv.set(CG_STORAGE_KEYS.game, JSON.stringify({ ...raw, solution: '01234567' }));
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
    // And the untouched record still loads, so the checks above mean something.
    await kv.set(CG_STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).difficulty).not.toBeNull();
  });

  it('does not resume a game that has already been solved', async () => {
    const kv = createMemoryKV();
    let session = createDifficultySession('easy', 'crown-grid-easy-done');
    session.solution.forEach((col, row) => {
      const index = row * session.size + col;
      session = doTap(doTap(session, index)!, index)!;
    });
    expect(session.status).toBe('solved');
    await saveGame(session, kv);
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
  });
});
