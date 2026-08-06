/**
 * The persistence rules of docs/MINESWEEPER_RULES.md §10: two independent
 * slots, a save that never blocks play, and corrupt data that is read past
 * rather than repaired — plus the statistics of §9, which count wins and days
 * and never a streak.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { createDailySession, createDifficultySession, tapCell } from '../game';
import { availableDailyDates, canPlayDaily } from '../state/progressLogic';
import {
  applyGameStart,
  applyPlayTime,
  applyWin,
  dailiesCleared,
  winRate,
} from '../state/statsLogic';
import { clearSavedGame, loadSavedGames, saveGame } from './gamePersistence';
import { flagsSchema, MS_STORAGE_KEYS, prefsSchema, statsSchema } from './schemas';

const CENTRE = 40;

describe('storage keys', () => {
  it('all sit under the ms. prefix, apart from every other game', () => {
    for (const key of Object.values(MS_STORAGE_KEYS)) expect(key.startsWith('ms.')).toBe(true);
    expect(new Set(Object.values(MS_STORAGE_KEYS)).size).toBe(
      Object.values(MS_STORAGE_KEYS).length,
    );
  });
});

describe('preferences (§3)', () => {
  it('defaults flag mode off and round-trips it', async () => {
    const kv = createMemoryKV();
    expect(prefsSchema.defaultValue().flagMode).toBe(false);
    await saveRecord(prefsSchema, { schemaVersion: 1, flagMode: true }, kv);
    expect((await loadRecord(prefsSchema, kv)).flagMode).toBe(true);
  });

  it('falls back to the default rather than throwing on nonsense', async () => {
    const kv = createMemoryKV({
      [MS_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"flagMode":"yes"}',
      [MS_STORAGE_KEYS.flags]: 'not json at all',
    });
    expect((await loadRecord(prefsSchema, kv)).flagMode).toBe(false);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(false);
  });
});

describe('statistics (§9)', () => {
  it('drops an unreadable day without losing the others', async () => {
    const kv = createMemoryKV({
      [MS_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        easy: { played: 3, won: 2, totalPlaySeconds: 90, bestSeconds: 30 },
        medium: { played: 0, won: 0, totalPlaySeconds: 0, bestSeconds: null },
        hard: { played: 0, won: 0, totalPlaySeconds: 0, bestSeconds: null },
        dailyTimes: { '2026-08-03': 42, 'not-a-date': 10, '2026-08-04': 'soon' },
      }),
    });
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.easy.played).toBe(3);
    expect(stats.dailyTimes).toEqual({ '2026-08-03': 42 });
  });

  it('counts plays, wins, fastest times and the win rate', () => {
    let stats = statsSchema.defaultValue();
    expect(winRate(stats, 'easy')).toBeNull();

    stats = applyGameStart(stats, 'easy');
    stats = applyGameStart(stats, 'easy');
    stats = applyPlayTime(stats, 'easy', 70);

    const session = { ...createDifficultySession('easy', 'seed'), elapsedSeconds: 40 };
    const first = applyWin(stats, session);
    expect(first.isNewBest).toBe(true);
    expect(first.stats.easy.won).toBe(1);
    expect(first.stats.easy.bestSeconds).toBe(40);
    expect(first.stats.easy.totalPlaySeconds).toBe(70);
    expect(winRate(first.stats, 'easy')).toBe(0.5);

    // A slower win keeps the faster time.
    const slower = applyWin(first.stats, { ...session, elapsedSeconds: 90 });
    expect(slower.isNewBest).toBe(false);
    expect(slower.stats.easy.bestSeconds).toBe(40);
  });

  it('records the days the daily was cleared, and nothing that resembles a streak', () => {
    const daily = { ...createDailySession('2026-08-03'), elapsedSeconds: 55 };
    const outcome = applyWin(statsSchema.defaultValue(), daily);
    expect(outcome.stats.dailyTimes).toEqual({ '2026-08-03': 55 });
    expect(dailiesCleared(outcome.stats)).toBe(1);
    expect(Object.keys(outcome.stats)).not.toContain('streak');
  });
});

describe('the daily backlog (§8)', () => {
  it('opens today always, and one older day per day cleared', () => {
    const stats = statsSchema.defaultValue();
    expect(canPlayDaily(stats, '2026-08-05', '2026-08-05')).toBe(true);
    expect(canPlayDaily(stats, '2026-08-04', '2026-08-05')).toBe(false);
    expect(canPlayDaily(stats, '2026-08-06', '2026-08-05')).toBe(false);
    expect(availableDailyDates(stats, '2026-08-05')).toEqual(['2026-08-05']);

    const cleared = { ...stats, dailyTimes: { '2026-08-05': 30, '2026-08-04': 30 } };
    expect(canPlayDaily(cleared, '2026-08-04', '2026-08-05')).toBe(true);
    expect(availableDailyDates(cleared, '2026-08-05')).toEqual([
      '2026-08-05',
      '2026-08-04',
      '2026-08-03',
    ]);
  });
});

describe('saved games (§10)', () => {
  it('keeps a difficulty game and a daily in slots that cannot evict each other', async () => {
    const kv = createMemoryKV();
    const level = tapCell(createDifficultySession('easy', 'mines-easy-slot'), CENTRE)!;
    const daily = tapCell(createDailySession('2026-08-03'), CENTRE)!;
    await saveGame(level, kv);
    await saveGame(daily, kv);

    const loaded = await loadSavedGames(kv);
    expect(loaded.difficulty?.seed).toBe(level.seed);
    expect(loaded.difficulty?.board.field.mines).toEqual(level.board.field.mines);
    expect(loaded.difficulty?.board.opened).toEqual(level.board.opened);
    expect(loaded.daily?.dailyDate).toBe('2026-08-03');

    await clearSavedGame('daily', kv);
    const after = await loadSavedGames(kv);
    expect(after.daily).toBeNull();
    expect(after.difficulty).not.toBeNull();
  });

  it('resumes a game that has not been tapped yet', async () => {
    const kv = createMemoryKV();
    const fresh = createDifficultySession('medium', 'mines-medium-slot');
    await saveGame(fresh, kv);
    const loaded = await loadSavedGames(kv);
    expect(loaded.difficulty?.firstIndex).toBeNull();
    expect(loaded.difficulty?.board.field.mines.some(Boolean)).toBe(false);
  });

  it('reads past a broken record instead of resuming a board that cannot be played', async () => {
    const kv = createMemoryKV();
    const level = tapCell(createDifficultySession('easy', 'mines-easy-broken'), CENTRE)!;
    await saveGame(level, kv);

    const raw = JSON.parse((await kv.get(MS_STORAGE_KEYS.game))!) as Record<string, unknown>;
    // A board of the wrong size for the difficulty it claims.
    await kv.set(MS_STORAGE_KEYS.game, JSON.stringify({ ...raw, width: 12 }));
    expect((await loadSavedGames(kv)).difficulty).toBeNull();

    // A mine count that does not match the preset.
    await kv.set(MS_STORAGE_KEYS.game, JSON.stringify({ ...raw, mines: '0'.repeat(81) }));
    expect((await loadSavedGames(kv)).difficulty).toBeNull();

    // And the untouched record still loads, so the checks above mean something.
    await kv.set(MS_STORAGE_KEYS.game, JSON.stringify(raw));
    expect((await loadSavedGames(kv)).difficulty).not.toBeNull();
  });

  it('does not resume a game that has already ended', async () => {
    const kv = createMemoryKV();
    const level = tapCell(createDifficultySession('easy', 'mines-easy-lost'), CENTRE)!;
    const lost = tapCell(level, level.board.field.mines.findIndex(Boolean))!;
    expect(lost.status).toBe('lost');
    await saveGame(lost, kv);
    expect((await loadSavedGames(kv)).difficulty).toBeNull();
  });
});
