/**
 * The persistence rules of docs/NUMBER_PATH_RULES.md §8 and §9: two
 * independent slots, a save that never blocks play, corrupt data that is read
 * past rather than repaired, a preference that only remembers, and statistics
 * that count boards and days and never a streak.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { createDailySession, createDifficultySession, doTap } from '../game';
import { availableDailyDates } from '../state/progressLogic';
import {
  applyGameStart,
  applyPlayTime,
  applySolve,
  dailiesSolved,
  previousBestFor,
} from '../state/statsLogic';
import { clearSavedGame, loadSavedGames, saveGame, soleSuspendedMode } from './gamePersistence';
import { flagsSchema, NP_STORAGE_KEYS, prefsSchema, statsSchema } from './schemas';

describe('storage keys', () => {
  it('all sit under the np. prefix, apart from every other game', () => {
    for (const key of Object.values(NP_STORAGE_KEYS)) expect(key.startsWith('np.')).toBe(true);
    expect(new Set(Object.values(NP_STORAGE_KEYS)).size).toBe(
      Object.values(NP_STORAGE_KEYS).length,
    );
  });
});

describe('preferences (§7)', () => {
  it('starts on easy and round-trips the difficulty last chosen', async () => {
    const kv = createMemoryKV();
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'hard' }, kv);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('hard');
  });

  it('falls back to the default rather than throwing on nonsense', async () => {
    const kv = createMemoryKV({
      [NP_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"brutal"}',
      [NP_STORAGE_KEYS.flags]: 'not json at all',
    });
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('easy');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
    expect(prefsSchema.validate({ schemaVersion: 2, difficulty: 'easy' })).toBeNull();
  });
});

describe('statistics (§8)', () => {
  it('drops an unreadable day without losing the others', async () => {
    const kv = createMemoryKV({
      [NP_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        easy: { played: 3, solved: 2, totalPlaySeconds: 90, bestSeconds: 30 },
        medium: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        hard: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
        dailyTimes: { '2026-09-03': 42, 'not-a-date': 10, '2026-09-04': 'soon' },
      }),
    });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.easy.played).toBe(3);
    expect(stats.dailyTimes).toEqual({ '2026-09-03': 42 });
  });

  it('counts plays, solves and fastest times per difficulty', () => {
    let stats = statsSchema.defaultValue();
    stats = applyGameStart(stats, 'easy');
    stats = applyGameStart(stats, 'easy');
    stats = applyPlayTime(stats, 'easy', 70);
    expect(applyPlayTime(stats, 'easy', 0)).toBe(stats);

    const session = {
      ...createDifficultySession('easy', 'number-path-easy-stats'),
      elapsedSeconds: 40,
    };
    expect(previousBestFor(stats, session)).toBeNull();
    const first = applySolve(stats, session);
    expect(first.isNewBest).toBe(true);
    expect(first.bestSeconds).toBe(40);
    expect(first.stats.easy.solved).toBe(1);
    expect(first.stats.easy.bestSeconds).toBe(40);
    expect(first.stats.easy.totalPlaySeconds).toBe(70);
    expect(previousBestFor(first.stats, session)).toBe(40);

    // A slower solve keeps the faster time.
    const slower = applySolve(first.stats, { ...session, elapsedSeconds: 90 });
    expect(slower.isNewBest).toBe(false);
    expect(slower.stats.easy.bestSeconds).toBe(40);
    expect(slower.bestSeconds).toBe(40);
  });

  it('records the days the daily was solved, and nothing that resembles a streak', () => {
    const daily = { ...createDailySession('2026-09-03'), elapsedSeconds: 55 };
    const outcome = applySolve(statsSchema.defaultValue(), daily);
    expect(outcome.stats.dailyTimes).toEqual({ '2026-09-03': 55 });
    expect(outcome.isNewBest).toBe(true);
    expect(previousBestFor(outcome.stats, daily)).toBe(55);
    const again = applySolve(outcome.stats, { ...daily, elapsedSeconds: 80 });
    expect(again.isNewBest).toBe(false);
    expect(again.bestSeconds).toBe(55);
    expect(dailiesSolved(outcome.stats)).toBe(1);
    expect(Object.keys(outcome.stats)).not.toContain('streak');
  });
});

describe('the daily backlog (§7)', () => {
  it('opens today and the twenty-nine days before it, unconditionally', () => {
    const dates = availableDailyDates('2026-09-26');
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-09-26');
    expect(dates[1]).toBe('2026-09-25');
    expect(dates[29]).toBe('2026-08-28');
    expect(availableDailyDates('2026-09-26', 3)).toEqual([
      '2026-09-26',
      '2026-09-25',
      '2026-09-24',
    ]);
  });
});

describe('saved games (§9)', () => {
  it('keeps a difficulty game and a daily in slots that cannot evict each other', async () => {
    const kv = createMemoryKV();
    const easy = createDifficultySession('easy', 'number-path-easy-slot');
    const level = doTap(easy, easy.solution[1]!)!;
    const daily = createDailySession('2026-09-03');
    await saveGame(level, kv);
    await saveGame(daily, kv);

    const loaded = await loadSavedGames(kv);
    expect(loaded.difficulty?.seed).toBe(level.seed);
    expect(loaded.difficulty?.path).toEqual(level.path);
    expect(loaded.difficulty?.board.walls).toEqual(level.board.walls);
    expect(loaded.daily?.dailyDate).toBe('2026-09-03');
    expect(soleSuspendedMode(loaded)).toBeNull();

    await clearSavedGame('daily', kv);
    const after = await loadSavedGames(kv);
    expect(after.daily).toBeNull();
    expect(after.difficulty).not.toBeNull();
    expect(soleSuspendedMode(after)).toBe('difficulty');
    expect(soleSuspendedMode({ difficulty: null, daily: null })).toBeNull();
  });

  it('reads past a broken record instead of resuming a board that cannot be played', async () => {
    const kv = createMemoryKV();
    const easy = createDifficultySession('easy', 'number-path-easy-broken');
    const level = doTap(easy, easy.solution[1]!)!;
    await saveGame(level, kv);

    const raw = JSON.parse((await kv.get(NP_STORAGE_KEYS.game))!) as Record<string, unknown>;
    // A path that jumps across the board.
    await kv.set(NP_STORAGE_KEYS.game, JSON.stringify({ ...raw, path: [level.path[0], 24] }));
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
    // A solution with a wall in its way.
    await kv.set(
      NP_STORAGE_KEYS.game,
      JSON.stringify({
        ...raw,
        walls: [...level.board.walls, `v${level.solution[0]}`, `h${level.solution[0]}`],
      }),
    );
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
    // And the untouched record still loads, so the checks above mean something.
    await kv.set(NP_STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).difficulty).not.toBeNull();
  });

  it('does not resume a game that has already been solved', async () => {
    const kv = createMemoryKV();
    let session = createDifficultySession('easy', 'number-path-easy-solved');
    for (const cell of session.solution.slice(1)) session = doTap(session, cell)!;
    expect(session.status).toBe('solved');
    await saveGame(session, kv);
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
  });
});
