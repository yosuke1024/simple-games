/**
 * The persistence rules of docs/BINARY_BALANCE_RULES.md §11: two independent
 * slots, a save that never blocks play, and corrupt data that is read past
 * rather than repaired — plus the preferences and statistics of §10, which
 * count solves and days and never a streak.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { createDailySession, createDifficultySession, doTap, EMPTY } from '../game';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  dailiesSolved,
  previousBestFor,
} from '../state/statsLogic';
import { clearSavedGame, loadSavedGames, saveGame } from './gamePersistence';
import { BN_STORAGE_KEYS, flagsSchema, prefsSchema, statsSchema } from './schemas';

describe('storage keys', () => {
  it('are the five of §11, all under the bn. prefix', () => {
    expect(Object.values(BN_STORAGE_KEYS).sort()).toEqual(
      ['bn.flags', 'bn.prefs', 'bn.saveDaily', 'bn.saveGame', 'bn.stats'].sort(),
    );
  });
});

describe('preferences (§10)', () => {
  it('starts at easy and round-trips the difficulty last picked', async () => {
    const kv = createMemoryKV();
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    await saveRecord(prefsSchema, { schemaVersion: 1, difficulty: 'hard' }, kv);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('hard');
  });

  it('holds nothing but the difficulty — there is no setting in this game (§9)', () => {
    expect(Object.keys(prefsSchema.defaultValue()).sort()).toEqual(['difficulty', 'schemaVersion']);
  });

  it('falls back to the default rather than throwing on nonsense', async () => {
    const kv = createMemoryKV({
      [BN_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"brutal"}',
      [BN_STORAGE_KEYS.flags]: 'not json at all',
    });
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('easy');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
  });
});

describe('statistics (§10)', () => {
  it('drops an unreadable day without losing the others', async () => {
    const kv = createMemoryKV({
      [BN_STORAGE_KEYS.stats]: JSON.stringify({
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
    stats = applyGameStart(stats, 'hard');
    stats = applyPlayTime(stats, 'hard', 70);
    const session = {
      ...createDifficultySession('easy', 'binary-balance-easy-golden'),
      difficulty: 'hard' as const,
      elapsedSeconds: 40,
    };
    expect(previousBestFor(stats, session)).toBeNull();
    const first = applySolved(stats, session);
    expect(first.isNewBest).toBe(true);
    expect(first.stats.hard).toMatchObject({ played: 1, solved: 1, bestSeconds: 40 });
    expect(first.stats.hard.totalPlaySeconds).toBe(70);

    const slower = applySolved(first.stats, { ...session, elapsedSeconds: 90 });
    expect(slower.isNewBest).toBe(false);
    expect(slower.stats.hard.bestSeconds).toBe(40);
  });

  it('records the days the daily was solved, and nothing that resembles a streak', () => {
    const daily = { ...createDailySession('2026-08-03'), elapsedSeconds: 55 };
    const outcome = applySolved(statsSchema.defaultValue(), daily);
    expect(outcome.stats.dailyTimes).toEqual({ '2026-08-03': 55 });
    expect(dailiesSolved(outcome.stats)).toBe(1);
    expect(Object.keys(outcome.stats)).not.toContain('streak');
  });
});

describe('saved games (§11)', () => {
  it('keeps a difficulty game and a daily in slots that cannot evict each other', async () => {
    const kv = createMemoryKV();
    const base = createDifficultySession('hard', 'binary-balance-hard-golden');
    const open = base.givens.findIndex((cell) => cell === EMPTY);
    const game = doTap(base, open)!;
    const daily = createDailySession('2026-08-03');
    await saveGame(game, kv);
    await saveGame(daily, kv);

    const loaded = await loadSavedGames(kv, '2026-08-03');
    expect(loaded.difficulty?.seed).toBe(game.seed);
    expect(loaded.difficulty?.links).toEqual(game.links);
    expect(loaded.difficulty?.marks).toEqual(game.marks);
    expect(loaded.daily?.dailyDate).toBe('2026-08-03');

    await clearSavedGame('daily', kv);
    const after = await loadSavedGames(kv, '2026-08-03');
    expect(after.daily).toBeNull();
    expect(after.difficulty).not.toBeNull();
  });

  it('reads past a broken record instead of resuming a board that cannot be played', async () => {
    const kv = createMemoryKV();
    await saveGame(createDifficultySession('medium', 'binary-balance-medium-golden'), kv);
    const raw = JSON.parse((await kv.get(BN_STORAGE_KEYS.game))!) as Record<string, unknown>;

    await kv.set(BN_STORAGE_KEYS.game, JSON.stringify({ ...raw, size: 8 }));
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
    await kv.set(BN_STORAGE_KEYS.game, JSON.stringify({ ...raw, links: '' }));
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
    // And the untouched record still loads, so the checks above mean something.
    await kv.set(BN_STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).difficulty).not.toBeNull();
  });

  it('does not resume a game that has already been solved', async () => {
    const kv = createMemoryKV();
    let session = createDifficultySession('easy', 'binary-balance-easy-golden');
    session.givens.forEach((given, index) => {
      if (given !== EMPTY) return;
      session = doTap(session, index)!;
      if (session.solution[index] === 1) session = doTap(session, index)!;
    });
    expect(session.status).toBe('solved');
    await saveGame(session, kv);
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
  });
});
