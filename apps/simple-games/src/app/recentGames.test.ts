/**
 * The home's shortcut row. It is only ever a shortcut, so the rules worth
 * pinning are the ones that keep it from becoming something else: it never
 * grows past its limit, never lists the same game twice, and never offers a
 * door to a game this build does not have.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKV } from '../storage/kv';
import { RECENT_GAMES_LIMIT, STORAGE_KEYS, recentGamesSchema } from '../storage/schemas';
import {
  getRecentGames,
  initRecentGames,
  recordGameOpened,
  resetRecentGamesForTesting,
} from './recentGames';
import { GAMES } from './registry';

beforeEach(() => {
  resetRecentGamesForTesting();
});

describe('the shortcut row', () => {
  it('is empty on a fresh install, so the home shows no section at all', async () => {
    await initRecentGames(createMemoryKV());
    expect(getRecentGames()).toEqual([]);
  });

  it('puts the game just opened first', async () => {
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    recordGameOpened('nonogram');
    expect(getRecentGames()).toEqual(['nonogram', 'sudoku']);
  });

  it('moves a re-opened game to the front instead of listing it twice', async () => {
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    recordGameOpened('nonogram');
    recordGameOpened('sudoku');
    expect(getRecentGames()).toEqual(['sudoku', 'nonogram']);
  });

  it('never grows past the limit', async () => {
    await initRecentGames(createMemoryKV());
    for (const game of GAMES) recordGameOpened(game.id);
    expect(getRecentGames()).toHaveLength(RECENT_GAMES_LIMIT);
  });

  it('survives a restart', async () => {
    const kv = createMemoryKV();
    await initRecentGames(kv);
    recordGameOpened('water-sort');
    // Wait for the fire-and-forget save before booting again.
    await Promise.resolve();

    resetRecentGamesForTesting();
    await initRecentGames(kv);
    expect(getRecentGames()).toEqual(['water-sort']);
  });

  it('drops ids this build has no game for, rather than showing a dead row', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.recent]: JSON.stringify({ schemaVersion: 1, ids: ['retired-game', 'sudoku'] }),
    });
    await initRecentGames(kv);
    expect(getRecentGames()).toEqual(['sudoku']);
  });
});

describe('the stored record', () => {
  it('falls back to empty for a corrupt list instead of throwing', () => {
    expect(recentGamesSchema.validate({ schemaVersion: 1, ids: [7] })).toBeNull();
    expect(recentGamesSchema.validate({ schemaVersion: 1, ids: 'sudoku' })).toBeNull();
    expect(recentGamesSchema.validate({ schemaVersion: 2, ids: [] })).toBeNull();
  });

  it('trims an over-long stored list to the limit', () => {
    const ids = GAMES.map((game) => game.id);
    expect(recentGamesSchema.validate({ schemaVersion: 1, ids })?.ids).toHaveLength(
      RECENT_GAMES_LIMIT,
    );
  });
});
