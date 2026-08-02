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
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.native },
}));

import {
  initRecentGames,
  recordGameOpened,
  resetRecentGamesForTesting,
} from '../../app/recentGames';
import { GAMES } from '../../app/registry';
import { SettingsProvider } from '../../state/SettingsContext';
import { createMemoryKV } from '../../storage/kv';
import { settingsSchema } from '../../storage/schemas';
import { CollectionHomeScreen } from './CollectionHomeScreen';

function renderHome() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CollectionHomeScreen onOpenGame={() => undefined} onOpenSettings={() => undefined} />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  capacitorMock.native = false;
  resetRecentGamesForTesting();
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

describe('the game list', () => {
  it('shows every game on both builds', () => {
    renderHome();
    for (const game of GAMES) {
      expect(screen.getByRole('button', { name: game.title })).toBeInTheDocument();
    }
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

  it('leaves the full list complete and in registry order', async () => {
    await initRecentGames(createMemoryKV());
    recordGameOpened('sudoku');
    renderHome();

    const all = screen.getByRole('navigation', { name: 'Games' });
    expect(cardsIn(all)).toEqual(GAMES.map(cardFor));
  });
});
