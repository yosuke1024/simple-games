/**
 * The favourites shelf mirrored onto the iOS quick actions (issue #114). What
 * is pinned here is the contract with the shelf and with the OS: the list is
 * the top of the shelf and nothing else, cut at what iOS will show, in the
 * order the player pinned; it follows every change to the shelf and is
 * written once at boot; and no ending — a plugin that rejects, a platform
 * with no quick actions — ever reaches the shelf as a throw or a wait.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, pluginMock } = vi.hoisted(() => ({
  capacitorMock: { platform: 'ios' },
  pluginMock: {
    setItems: vi.fn<(options: { items: unknown[] }) => Promise<void>>(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorMock.platform,
    isNativePlatform: () => capacitorMock.platform !== 'web',
  },
}));
vi.mock('@capacitor/app', () => ({ App: { getLaunchUrl: vi.fn() } }));
vi.mock('./quickActionsPlugin', () => ({ QuickActions: pluginMock }));

import {
  initFavoriteGames,
  resetFavoriteGamesForTesting,
  toggleFavoriteGame,
} from '../../app/favoriteGames';
import { GAMES, type GameId } from '../../app/registry';
import { shortcutUrlFor } from '../../app/shortcutLaunch';
import { createMemoryKV } from '../../storage/kv';
import { STORAGE_KEYS } from '../../storage/schemas';
import {
  QUICK_ACTIONS_MAX,
  initQuickActions,
  quickActionItemsFor,
  resetQuickActionsForTesting,
  syncQuickActions,
} from './quickActions';

const titleOf = (id: GameId) => GAMES.find((game) => game.id === id)!.title;
const itemFor = (id: GameId) => ({ id: `game-${id}`, label: titleOf(id), uri: shortcutUrlFor(id) });

/** The list the plugin was last handed. */
const lastItems = () => pluginMock.setItems.mock.calls.at(-1)?.[0].items;

beforeEach(() => {
  capacitorMock.platform = 'ios';
  pluginMock.setItems.mockReset().mockResolvedValue(undefined);
  resetQuickActionsForTesting();
  resetFavoriteGamesForTesting();
});

describe('what a shelf maps to', () => {
  it('is one item per pinned game, in shelf order, carrying the title and the game’s address', () => {
    expect(quickActionItemsFor(['water-sort', 'sudoku', 'hearts'])).toEqual([
      itemFor('water-sort'),
      itemFor('sudoku'),
      itemFor('hearts'),
    ]);
    expect(quickActionItemsFor(['sudoku'])).toEqual([
      {
        id: 'game-sudoku',
        label: 'Sudoku',
        uri: 'https://pixapps.ai/simple-games/play/?game=sudoku',
      },
    ]);
  });

  it('is empty for an empty shelf — no favourites, no quick actions', () => {
    expect(quickActionItemsFor([])).toEqual([]);
  });

  /**
   * iOS shows four. The cut is the TOP of the shelf, which is pinning order:
   * a fifth pin changes nothing the OS shows, and unpinning one of the four
   * lets the fifth in. A stable shelf, not a ranking.
   */
  it('keeps the first four pinned when the shelf is longer', () => {
    expect(QUICK_ACTIONS_MAX).toBe(4);
    const shelf: GameId[] = ['sudoku', 'hearts', 'kakuro', 'takuzu', 'ludo', 'reversi'];
    expect(quickActionItemsFor(shelf).map((item) => item.id)).toEqual([
      'game-sudoku',
      'game-hearts',
      'game-kakuro',
      'game-takuzu',
    ]);
  });

  it('reads back to the game it names, for every title in the collection', () => {
    for (const game of GAMES) {
      expect(quickActionItemsFor([game.id])).toEqual([itemFor(game.id)]);
    }
  });

  // The shelf drops these itself (app/favoriteGames.ts); this is the promise
  // made to the OS regardless of who calls, and that a dead id costs no slot.
  it('drops an id this build has no game for, before the cut', () => {
    const shelf = ['retired-game', 'sudoku', 'hearts', 'kakuro', 'takuzu'] as GameId[];
    expect(quickActionItemsFor(shelf).map((item) => item.id)).toEqual([
      'game-sudoku',
      'game-hearts',
      'game-kakuro',
      'game-takuzu',
    ]);
  });
});

describe('writing the shelf to the OS', () => {
  it('hands the plugin the shelf’s items on iOS', async () => {
    await syncQuickActions(['sudoku', 'freecell', 'minesweeper']);
    expect(pluginMock.setItems).toHaveBeenCalledTimes(1);
    expect(lastItems()).toEqual([itemFor('sudoku'), itemFor('freecell'), itemFor('minesweeper')]);
  });

  it('hands over an empty list for an empty shelf, so the OS clears its own', async () => {
    await syncQuickActions([]);
    expect(pluginMock.setItems).toHaveBeenCalledWith({ items: [] });
  });

  it('never rejects, whatever the plugin does', async () => {
    pluginMock.setItems.mockRejectedValue(new Error('not implemented'));
    await expect(syncQuickActions(['sudoku'])).resolves.toBeUndefined();
  });

  it.each(['android', 'web'])(
    'writes nothing on %s, where there are no quick actions',
    async (platform) => {
      capacitorMock.platform = platform;
      await syncQuickActions(['sudoku']);
      expect(pluginMock.setItems).not.toHaveBeenCalled();
    },
  );
});

describe('following the shelf (boot)', () => {
  it('writes the stored shelf at boot, before anybody pins anything', async () => {
    await initFavoriteGames(
      createMemoryKV({
        [STORAGE_KEYS.favorites]: JSON.stringify({
          schemaVersion: 1,
          ids: ['nonogram', 'solitaire'],
        }),
      }),
    );
    await initQuickActions();
    expect(pluginMock.setItems).toHaveBeenCalledTimes(1);
    expect(lastItems()).toEqual([itemFor('nonogram'), itemFor('solitaire')]);
  });

  it('rewrites the list after every pin and unpin', async () => {
    await initFavoriteGames(createMemoryKV());
    await initQuickActions();
    pluginMock.setItems.mockClear();

    toggleFavoriteGame('sudoku');
    expect(lastItems()).toEqual([itemFor('sudoku')]);

    toggleFavoriteGame('hearts');
    expect(lastItems()).toEqual([itemFor('sudoku'), itemFor('hearts')]);

    toggleFavoriteGame('sudoku');
    expect(lastItems()).toEqual([itemFor('hearts')]);
    expect(pluginMock.setItems).toHaveBeenCalledTimes(3);
  });

  it('keeps the OS at four while the shelf grows past it, and lets the fifth in when one leaves', async () => {
    await initFavoriteGames(createMemoryKV());
    await initQuickActions();
    for (const id of ['sudoku', 'hearts', 'kakuro', 'takuzu', 'ludo'] as const)
      toggleFavoriteGame(id);
    expect(lastItems()!.map((item) => (item as { id: string }).id)).toEqual([
      'game-sudoku',
      'game-hearts',
      'game-kakuro',
      'game-takuzu',
    ]);

    toggleFavoriteGame('hearts');
    expect(lastItems()!.map((item) => (item as { id: string }).id)).toEqual([
      'game-sudoku',
      'game-kakuro',
      'game-takuzu',
      'game-ludo',
    ]);
  });

  // "Reset Local Data" reloads the shelf from the emptied record
  // (SettingsScreen.tsx) rather than toggling; the OS must follow that too.
  it('clears the list when the shelf is reloaded empty', async () => {
    await initFavoriteGames(createMemoryKV());
    await initQuickActions();
    toggleFavoriteGame('sudoku');
    expect(lastItems()).toEqual([itemFor('sudoku')]);

    await initFavoriteGames(createMemoryKV());
    expect(lastItems()).toEqual([]);
  });

  it('writes once per change even if boot ran twice', async () => {
    await initFavoriteGames(createMemoryKV());
    await initQuickActions();
    await initQuickActions();
    pluginMock.setItems.mockClear();
    toggleFavoriteGame('sudoku');
    expect(pluginMock.setItems).toHaveBeenCalledTimes(1);
  });

  it('never rejects at boot, whatever the plugin does', async () => {
    pluginMock.setItems.mockRejectedValue(new Error('no bridge'));
    await initFavoriteGames(createMemoryKV());
    await expect(initQuickActions()).resolves.toBeUndefined();
  });

  it.each(['android', 'web'])('subscribes to nothing on %s', async (platform) => {
    capacitorMock.platform = platform;
    await initFavoriteGames(createMemoryKV());
    await initQuickActions();
    toggleFavoriteGame('sudoku');
    expect(pluginMock.setItems).not.toHaveBeenCalled();
  });
});
