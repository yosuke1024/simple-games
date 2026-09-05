/**
 * The home screen's tagline claims offline play, which is true of the Android
 * app and not of the web build: the browser downloads the assets on a first
 * visit (docs/WEB_VERSION.md). One source ships both, so the claim is gated on
 * the platform, and this pins it in place.
 *
 * It also pins which tagline: the collection shares the `tagline` the games
 * show, rather than a line of its own that claimed the app cost nothing at all
 * (docs/BRAND.md,「表現ルール」).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.native },
}));

// The real homeShortcut module (services/homeShortcut/homeShortcut.ts)
// transitively imports plugin.ts, which calls `registerPlugin` at module
// scope — a name the stub above does not provide. Stubbing the whole module
// sidesteps that entirely, and lets each test say what the shell decided at
// boot without touching Capacitor at all.
const { homeShortcutsAvailable, requestHomeShortcut } = vi.hoisted(() => ({
  homeShortcutsAvailable: vi.fn(),
  requestHomeShortcut: vi.fn(),
}));

vi.mock('../../services/homeShortcut/homeShortcut', () => ({
  homeShortcutsAvailable,
  requestHomeShortcut,
}));

import {
  getFavoriteGames,
  initFavoriteGames,
  resetFavoriteGamesForTesting,
  toggleFavoriteGame,
} from '../../app/favoriteGames';
import {
  initRecentGames,
  recordGameOpened,
  resetRecentGamesForTesting,
} from '../../app/recentGames';
import { GAMES, GAME_CATEGORIES, type GameId } from '../../app/registry';
import { en } from '../../i18n/locales/en';
import { SettingsProvider } from '../../state/SettingsContext';
import { createMemoryKV } from '../../storage/kv';
import { settingsSchema } from '../../storage/schemas';
import { CollectionHomeScreen, GAME_MENU_PRESS_MS } from './CollectionHomeScreen';

function renderHome(onOpenGame: (gameId: GameId) => void = () => undefined) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CollectionHomeScreen onOpenGame={onOpenGame} onOpenSettings={() => undefined} />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  capacitorMock.native = false;
  resetRecentGamesForTesting();
  resetFavoriteGamesForTesting();
  // Off by default, like every build the launcher cannot pin to.
  homeShortcutsAvailable.mockReset().mockReturnValue(false);
  requestHomeShortcut.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe('collection tagline', () => {
  it('claims offline play on the app build, without claiming the app is free of charge', () => {
    capacitorMock.native = true;
    renderHome();
    expect(screen.getByText('Works offline. No account. No paywalls.')).toBeInTheDocument();
  });

  it('is absent on the web build, which needs a download on a first visit', () => {
    renderHome();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });
});

/**
 * Every card reads as its glyph followed by its title, which is exactly what
 * a card is: the series mark plus the name.
 */
const cardsIn = (region: HTMLElement) =>
  within(region)
    .getAllByRole('button')
    .map((button) => button.textContent);
const cardFor = (game: (typeof GAMES)[number]) => `${game.glyph}${game.title}`;

/**
 * The list as the categories lay it out: each section's heading, then that
 * section's games in registry order. Deriving it from the registry keeps the
 * expectation honest for any game count — what it pins is the shape.
 */
const sectionedList = GAME_CATEGORIES.flatMap((category) => [
  en[category.headingKey],
  ...GAMES.filter((game) => game.category === category.id).map(cardFor),
]);

describe('the game list', () => {
  it('shows every game exactly once on both builds', () => {
    renderHome();
    for (const game of GAMES) {
      // getBy* would also throw on duplicates, but spell the intent out: a
      // game must not appear under two categories.
      expect(screen.getAllByRole('button', { name: game.title })).toHaveLength(1);
    }
  });

  it('groups the grid by category, keeping registry order within each section', () => {
    renderHome();
    const list = screen.getByRole('navigation', { name: 'Games' });
    // Headings and cards in document order. A game whose category is missing
    // from GAME_CATEGORIES would be absent here; one listed under a duplicate
    // category id would appear twice — either way this comparison fails.
    const rendered = Array.from(list.querySelectorAll('h2, button')).map(
      (element) => element.textContent,
    );
    expect(rendered).toEqual(sectionedList);
  });
});

/**
 * The shortcut row is what lets the list below stay in a fixed order as the
 * collection grows. It has to earn that by staying a shortcut: absent until
 * there is something to shortcut to, and never a second copy of the list.
 */
describe('recently played', () => {
  it('is absent on a fresh install rather than showing an empty section', async () => {
    await initRecentGames(createMemoryKV());
    renderHome();
    expect(screen.queryByRole('navigation', { name: 'Recently played' })).not.toBeInTheDocument();
  });

  it('shows the games last opened, newest first', async () => {
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    recordGameOpened('water-sort');
    renderHome();

    const shortcuts = screen.getByRole('navigation', { name: 'Recently played' });
    expect(cardsIn(shortcuts)).toEqual(['≋Water Sort', '⌗Sudoku']);
  });

  it('leaves the full list complete and in section order', async () => {
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    renderHome();

    const all = screen.getByRole('navigation', { name: 'Games' });
    expect(cardsIn(all)).toEqual(
      GAME_CATEGORIES.flatMap((category) =>
        GAMES.filter((game) => game.category === category.id).map(cardFor),
      ),
    );
  });
});

/**
 * The pinned shelf (issue #109). The recent row above answers "where was I";
 * this one answers "keep this here", which nothing else on the home can. What
 * these pin down is that it stays a shelf and not a second status board: it is
 * absent until somebody puts something on it, it never reorders itself, and
 * the full list below is unchanged by any of it.
 */
const tileFor = (title: string) => screen.getAllByRole('button', { name: title })[0]!;

/** A long press: the press, the threshold passing, and the finger coming up. */
function longPress(target: HTMLElement) {
  vi.useFakeTimers();
  try {
    fireEvent.pointerDown(target);
    act(() => vi.advanceTimersByTime(GAME_MENU_PRESS_MS + 20));
    fireEvent.pointerUp(target);
    // The click the release generates. It arrives with the sheet already on
    // screen, which is the whole reason GameActionSheet swallows it.
    fireEvent.click(target);
  } finally {
    vi.useRealTimers();
  }
}

describe('favorites', () => {
  it('is absent until something is pinned, rather than showing an empty section', async () => {
    await initFavoriteGames(createMemoryKV());
    renderHome();
    expect(screen.queryByRole('navigation', { name: 'Favorites' })).not.toBeInTheDocument();
    expect(screen.queryByText('Favorites')).not.toBeInTheDocument();
  });

  it('shows the pinned games in the order they were pinned', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('water-sort');
    toggleFavoriteGame('sudoku');
    renderHome();

    const shelf = screen.getByRole('navigation', { name: 'Favorites' });
    expect(cardsIn(shelf)).toEqual(['≋Water Sort', '⌗Sudoku']);
  });

  it('comes first: favorites, then recently played, then the categories', async () => {
    await initFavoriteGames(createMemoryKV());
    await initRecentGames(createMemoryKV());
    toggleFavoriteGame('sudoku');
    recordGameOpened('hearts');
    renderHome();

    const landmarks = screen
      .getAllByRole('navigation')
      .map((nav) => nav.getAttribute('aria-label') ?? nav.querySelector('h2')?.textContent);
    expect(landmarks).toEqual(['Favorites', 'Recently played', 'Games']);
  });

  it('leaves the full list complete: a pinned game keeps its place in its category', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('sudoku');
    renderHome();

    const all = screen.getByRole('navigation', { name: 'Games' });
    expect(cardsIn(all)).toEqual(
      GAME_CATEGORIES.flatMap((category) =>
        GAMES.filter((game) => game.category === category.id).map(cardFor),
      ),
    );
  });

  /**
   * The two blocks would otherwise duplicate each other in exactly the common
   * case — the game somebody pins is the game they last played — and spend the
   * recent row's two slots on doors that are already open one line above.
   */
  it('drops a pinned game from the recent row instead of listing it twice', async () => {
    await initFavoriteGames(createMemoryKV());
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    recordGameOpened('hearts');
    toggleFavoriteGame('hearts');
    renderHome();

    expect(cardsIn(screen.getByRole('navigation', { name: 'Favorites' }))).toEqual(['♡Hearts']);
    expect(cardsIn(screen.getByRole('navigation', { name: 'Recently played' }))).toEqual([
      '⌗Sudoku',
    ]);
  });

  it('hides the recent row entirely when every game in it is pinned', async () => {
    await initFavoriteGames(createMemoryKV());
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    toggleFavoriteGame('sudoku');
    renderHome();

    expect(screen.queryByRole('navigation', { name: 'Recently played' })).not.toBeInTheDocument();
  });

  it('ignores a stored id this build has no game for', async () => {
    await initFavoriteGames(
      createMemoryKV({
        'sg.favorites': JSON.stringify({ schemaVersion: 1, ids: ['retired-game', 'sudoku'] }),
      }),
    );
    renderHome();
    expect(cardsIn(screen.getByRole('navigation', { name: 'Favorites' }))).toEqual(['⌗Sudoku']);
  });
});

/**
 * How a game gets pinned from the home. Three doorways raise the same sheet —
 * a long press, a right-click, and the keyboard's own menu key (which the
 * browser delivers as the same `contextmenu` event) — and none of them may
 * cost a plain tap its meaning.
 */
describe('the tile action sheet', () => {
  it('opens on a long press, and that press does not also open the game', async () => {
    await initFavoriteGames(createMemoryKV());
    const onOpenGame = vi.fn();
    renderHome(onOpenGame);

    longPress(tileFor('Sudoku'));

    expect(screen.getByRole('dialog', { name: 'Sudoku' })).toBeInTheDocument();
    expect(onOpenGame).not.toHaveBeenCalled();
  });

  it('opens on a right-click — the same event the keyboard menu key raises', async () => {
    await initFavoriteGames(createMemoryKV());
    const onOpenGame = vi.fn();
    renderHome(onOpenGame);

    fireEvent.contextMenu(tileFor('Hearts'));

    expect(screen.getByRole('dialog', { name: 'Hearts' })).toBeInTheDocument();
    expect(onOpenGame).not.toHaveBeenCalled();
  });

  it('leaves a plain tap alone: it opens the game and no sheet', async () => {
    await initFavoriteGames(createMemoryKV());
    const user = userEvent.setup();
    const onOpenGame = vi.fn();
    renderHome(onOpenGame);

    await user.click(tileFor('Sudoku'));

    expect(onOpenGame).toHaveBeenCalledWith('sudoku');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pins the game, and the shelf appears without leaving the home', async () => {
    await initFavoriteGames(createMemoryKV());
    const user = userEvent.setup();
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    await user.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    expect(getFavoriteGames()).toEqual(['sudoku']);
    expect(cardsIn(screen.getByRole('navigation', { name: 'Favorites' }))).toEqual(['⌗Sudoku']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the other direction for a game already pinned, and unpins it', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('sudoku');
    const user = userEvent.setup();
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    expect(screen.queryByRole('button', { name: 'Add to Favorites' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove from Favorites' }));

    expect(getFavoriteGames()).toEqual([]);
    expect(screen.queryByRole('navigation', { name: 'Favorites' })).not.toBeInTheDocument();
  });

  it('closes on Escape without pinning anything', async () => {
    await initFavoriteGames(createMemoryKV());
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getFavoriteGames()).toEqual([]);
  });

  it('closes on Close, and hands focus back to the tile it was opened from', async () => {
    await initFavoriteGames(createMemoryKV());
    const user = userEvent.setup();
    renderHome();

    const tile = tileFor('Sudoku');
    fireEvent.contextMenu(tile);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(tile);
  });

  /**
   * A screen reader's activation reaches the page as a bare click, with no
   * pointer event and no keydown in front of it — exactly the shape the stray
   * click has. It must still work, which is why the guard is armed for the
   * long press alone and never for the keyboard or right-click route.
   */
  it('acts on a bare click, the shape a screen reader sends', async () => {
    await initFavoriteGames(createMemoryKV());
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    expect(getFavoriteGames()).toEqual(['sudoku']);
  });

  /**
   * The sheet's action has to be reachable by keyboard the moment it opens: a
   * keyboard user never generated the stray click the sheet guards against, so
   * the guard must not eat their first Enter.
   */
  it('acts on the first Enter when it was opened from the keyboard', async () => {
    await initFavoriteGames(createMemoryKV());
    const user = userEvent.setup();
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add to Favorites' }));
    await user.keyboard('{Enter}');

    expect(getFavoriteGames()).toEqual(['sudoku']);
  });
});

/**
 * Where focus goes when the sheet closes. This is the whole keyboard route's
 * last step: land somewhere, or the reader is back at the top of the document
 * with the list they were reading behind them.
 */
describe('the sheet and the keyboard', () => {
  it('hands focus back to the tile after acting, not only after Close', async () => {
    await initFavoriteGames(createMemoryKV());
    const user = userEvent.setup();
    renderHome();

    const tile = tileFor('Sudoku');
    fireEvent.contextMenu(tile);
    await user.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    expect(document.activeElement).toBe(tile);
  });

  /**
   * Unpinning deletes the very tile the sheet was opened from. The game still
   * has its tile in its own category, one section down — that is where focus
   * has to land, and it must not fall to `<body>`.
   */
  it('lands on the game rather than nowhere when its shelf tile is unpinned away', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('sudoku');
    const user = userEvent.setup();
    renderHome();

    const shelf = screen.getByRole('navigation', { name: 'Favorites' });
    const shelfTile = within(shelf).getByRole('button', { name: 'Sudoku' });
    fireEvent.contextMenu(shelfTile);
    await user.click(screen.getByRole('button', { name: 'Remove from Favorites' }));

    expect(shelfTile.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
    const list = screen.getByRole('navigation', { name: 'Games' });
    expect(document.activeElement).toBe(within(list).getByRole('button', { name: 'Sudoku' }));
  });
});

/**
 * The Android-only second action in the same sheet (issue #110): a pinned OS
 * shortcut to one game, offered beside — and independent of — favouriting.
 * Whether it appears at all is `homeShortcutsAvailable()`'s call, decided once
 * at boot; this screen only reads that answer and draws accordingly.
 */
describe('add to home screen (issue #110)', () => {
  it('is absent from the sheet when the shell has no launcher to pin to (web, iOS, an Android launcher without pin support)', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(false);
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));

    expect(screen.queryByRole('button', { name: 'Add to Home Screen' })).not.toBeInTheDocument();
  });

  it('is present when the shell already confirmed the launcher takes pin requests', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(true);
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));

    expect(screen.getByRole('button', { name: 'Add to Home Screen' })).toBeInTheDocument();
  });

  it('requests a shortcut for the game, closes the sheet, hands focus back, and leaves favourites untouched', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(true);
    const user = userEvent.setup();
    renderHome();

    const tile = tileFor('Sudoku');
    fireEvent.contextMenu(tile);
    await user.click(screen.getByRole('button', { name: 'Add to Home Screen' }));

    expect(requestHomeShortcut).toHaveBeenCalledTimes(1);
    expect(requestHomeShortcut).toHaveBeenCalledWith(expect.objectContaining({ id: 'sudoku' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Favouriting and shortcuts are independent decisions (issue #110): this
    // press never touches the favourites shelf.
    expect(getFavoriteGames()).toEqual([]);
    expect(document.activeElement).toBe(tile);
  });

  /**
   * A screen reader's activation reaches the page as a bare click, exactly
   * like the favourite action's own test above — this action has to work the
   * same way.
   */
  it('acts on a bare click, the shape a screen reader sends', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(true);
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }));

    expect(requestHomeShortcut).toHaveBeenCalledWith(expect.objectContaining({ id: 'sudoku' }));
  });

  it('never asks the launcher for a shortcut on Escape or Close', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(true);
    const user = userEvent.setup();
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(requestHomeShortcut).not.toHaveBeenCalled();

    fireEvent.contextMenu(tileFor('Sudoku'));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(requestHomeShortcut).not.toHaveBeenCalled();
  });

  it('leaves the favourite action working on its own, and never asks for a shortcut', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(true);
    const user = userEvent.setup();
    renderHome();

    fireEvent.contextMenu(tileFor('Sudoku'));
    await user.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    expect(getFavoriteGames()).toEqual(['sudoku']);
    expect(requestHomeShortcut).not.toHaveBeenCalled();
  });
});
