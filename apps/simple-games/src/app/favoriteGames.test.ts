/**
 * The pinned shelf (issue #109). What is worth pinning here is what keeps it a
 * shelf the player arranged: pins survive a restart, pinning one game never
 * moves another, and a record naming a game this build does not have shortens
 * the shelf instead of breaking the home.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '../storage/kv';
import { FAVORITE_GAMES_MAX, STORAGE_KEYS, favoriteGamesSchema } from '../storage/schemas';
import {
  getFavoriteGames,
  initFavoriteGames,
  resetFavoriteGamesForTesting,
  subscribeFavoriteGames,
  toggleFavoriteGame,
} from './favoriteGames';
import { GAMES } from './registry';

beforeEach(() => {
  resetFavoriteGamesForTesting();
});

describe('pinning', () => {
  it('is empty on a fresh install, so the home shows no section at all', async () => {
    await initFavoriteGames(createMemoryKV());
    expect(getFavoriteGames()).toEqual([]);
  });

  it('adds and removes the one game asked for', async () => {
    await initFavoriteGames(createMemoryKV());
    expect(toggleFavoriteGame('sudoku')).toEqual(['sudoku']);
    expect(toggleFavoriteGame('sudoku')).toEqual([]);
  });

  it('keeps the order they were pinned in, so a new pin moves nothing', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('water-sort');
    toggleFavoriteGame('sudoku');
    toggleFavoriteGame('hearts');
    expect(getFavoriteGames()).toEqual(['water-sort', 'sudoku', 'hearts']);
  });

  it('sends a re-pinned game to the end rather than listing it twice', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('sudoku');
    toggleFavoriteGame('hearts');
    toggleFavoriteGame('sudoku');
    toggleFavoriteGame('sudoku');
    expect(getFavoriteGames()).toEqual(['hearts', 'sudoku']);
  });

  it('has no limit a player can reach: every game in the collection fits', async () => {
    await initFavoriteGames(createMemoryKV());
    for (const game of GAMES) toggleFavoriteGame(game.id);
    expect(getFavoriteGames()).toHaveLength(GAMES.length);
    expect(GAMES.length).toBeLessThanOrEqual(FAVORITE_GAMES_MAX);
  });

  it('survives a restart', async () => {
    const kv = createMemoryKV();
    await initFavoriteGames(kv);
    toggleFavoriteGame('nonogram');
    toggleFavoriteGame('solitaire');
    // Wait for the fire-and-forget save before booting again.
    await Promise.resolve();

    resetFavoriteGamesForTesting();
    await initFavoriteGames(kv);
    expect(getFavoriteGames()).toEqual(['nonogram', 'solitaire']);
  });

  it('remembers an unpin across a restart too, rather than resurrecting it', async () => {
    const kv = createMemoryKV();
    await initFavoriteGames(kv);
    toggleFavoriteGame('nonogram');
    await Promise.resolve();
    toggleFavoriteGame('nonogram');
    await Promise.resolve();

    resetFavoriteGamesForTesting();
    await initFavoriteGames(kv);
    expect(getFavoriteGames()).toEqual([]);
  });

  it('drops ids this build has no game for, rather than offering a dead tile', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.favorites]: JSON.stringify({
        schemaVersion: 1,
        ids: ['retired-game', 'sudoku'],
      }),
    });
    await initFavoriteGames(kv);
    expect(getFavoriteGames()).toEqual(['sudoku']);
  });

  /**
   * Dropped from the shelf, kept in the record: a title withdrawn for a
   * release and put back in the next one comes back pinned, because nobody
   * unpinned it.
   */
  it('keeps an unknown id in storage, so a game that returns returns pinned', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.favorites]: JSON.stringify({
        schemaVersion: 1,
        ids: ['retired-game', 'sudoku'],
      }),
    });
    await initFavoriteGames(kv);
    toggleFavoriteGame('hearts');
    await Promise.resolve();
    const stored: unknown = JSON.parse((await kv.get(STORAGE_KEYS.favorites)) ?? 'null');
    expect(stored).toEqual({ schemaVersion: 1, ids: ['retired-game', 'sudoku', 'hearts'] });
  });

  it('starts empty when the store cannot be read, instead of throwing', async () => {
    await initFavoriteGames({
      get: () => Promise.reject(new Error('storage is gone')),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    });
    expect(getFavoriteGames()).toEqual([]);
  });
});

/**
 * The one reader outside the screens — the iOS quick actions
 * (services/homeShortcut/quickActions.ts, issue #114) — follows the shelf by
 * subscribing. What it must hear: every change, the reload "Reset Local Data"
 * performs, and the shelf as the screens see it, never the raw record.
 */
describe('telling a subscriber', () => {
  it('hears every pin and unpin, with the shelf as it now stands', async () => {
    await initFavoriteGames(createMemoryKV());
    const heard: (readonly string[])[] = [];
    subscribeFavoriteGames((favorites) => heard.push(favorites));

    toggleFavoriteGame('sudoku');
    toggleFavoriteGame('hearts');
    toggleFavoriteGame('sudoku');
    expect(heard).toEqual([['sudoku'], ['sudoku', 'hearts'], ['hearts']]);
  });

  it('hears a reload, which is how "Reset Local Data" empties the shelf', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('sudoku');
    const heard: (readonly string[])[] = [];
    subscribeFavoriteGames((favorites) => heard.push(favorites));

    await initFavoriteGames(createMemoryKV());
    expect(heard).toEqual([[]]);
  });

  it('hears the shelf, not the record: ids this build has no game for are already gone', async () => {
    const heard: (readonly string[])[] = [];
    subscribeFavoriteGames((favorites) => heard.push(favorites));
    await initFavoriteGames(
      createMemoryKV({
        [STORAGE_KEYS.favorites]: JSON.stringify({
          schemaVersion: 1,
          ids: ['retired-game', 'sudoku'],
        }),
      }),
    );
    expect(heard).toEqual([['sudoku']]);
  });

  it('stops hearing once unsubscribed', async () => {
    await initFavoriteGames(createMemoryKV());
    const listener = vi.fn();
    const unsubscribe = subscribeFavoriteGames(listener);
    toggleFavoriteGame('sudoku');
    unsubscribe();
    toggleFavoriteGame('hearts');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is told after the shelf has changed, so what it reads back agrees', async () => {
    await initFavoriteGames(createMemoryKV());
    let readBack: readonly string[] = [];
    subscribeFavoriteGames(() => {
      readBack = getFavoriteGames();
    });
    toggleFavoriteGame('kakuro');
    expect(readBack).toEqual(['kakuro']);
  });
});

describe('the stored record', () => {
  it('falls back to empty for a corrupt list instead of throwing', () => {
    expect(favoriteGamesSchema.validate({ schemaVersion: 1, ids: [7] })).toBeNull();
    expect(favoriteGamesSchema.validate({ schemaVersion: 1, ids: 'sudoku' })).toBeNull();
    expect(favoriteGamesSchema.validate({ schemaVersion: 2, ids: [] })).toBeNull();
    expect(favoriteGamesSchema.validate(null)).toBeNull();
  });

  it('accepts an id no game claims — the shelf, not storage, knows the games', () => {
    expect(favoriteGamesSchema.validate({ schemaVersion: 1, ids: ['retired-game'] })).toEqual({
      schemaVersion: 1,
      ids: ['retired-game'],
    });
  });

  it('keeps one entry per id', () => {
    expect(
      favoriteGamesSchema.validate({ schemaVersion: 1, ids: ['sudoku', 'sudoku'] })?.ids,
    ).toEqual(['sudoku']);
  });

  it('bounds a hand-edited record, keeping the newest entries', () => {
    const ids = Array.from({ length: FAVORITE_GAMES_MAX + 5 }, (_, index) => `game-${index}`);
    const kept = favoriteGamesSchema.validate({ schemaVersion: 1, ids })?.ids ?? [];
    expect(kept).toHaveLength(FAVORITE_GAMES_MAX);
    expect(kept.at(-1)).toBe(`game-${FAVORITE_GAMES_MAX + 4}`);
  });
});
