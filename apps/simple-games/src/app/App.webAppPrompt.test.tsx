/**
 * The one-time app card as the shell actually produces it (issue #85,
 * docs/WEB_VERSION.md「アプリへの送客」). The service decides *when* and the
 * card says *what*; what is only visible from here is that the two meet at the
 * right moment and nowhere else — after two games, on the collection home, in
 * the browser, once.
 *
 * The games are stubbed for the same reason App.route.test.tsx stubs them:
 * every real title opens on its tutorial, which offers no way back to the
 * collection, so a real chunk would make "the player returned" a walk through
 * that title's own screens. The stub is the contract the shell relies on — a
 * root handed `onExit`.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, networkMock, openExternalMock } = vi.hoisted(() => ({
  capacitorMock: { native: false },
  networkMock: { online: true },
  openExternalMock: vi.fn(),
}));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => capacitorMock.native,
      getPlatform: () => (capacitorMock.native ? 'android' : 'web'),
    },
  };
});

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: () => Promise.resolve({ remove: () => undefined }),
    minimizeApp: () => Promise.resolve(),
    exitApp: () => Promise.resolve(),
  },
}));

vi.mock('../services/network', () => ({
  isOnline: () => networkMock.online,
  initNetwork: () => Promise.resolve(),
  setOnlineForTesting: () => undefined,
}));

vi.mock('../ui/openExternal', () => ({ openExternal: openExternalMock }));

vi.mock('./lazyRoots', () => ({
  getLazyRoot: (gameId: string) =>
    function StubGameRoot({ onExit }: { onExit: () => void }) {
      return (
        <div>
          <p>{`playing ${gameId}`}</p>
          <button type="button" onClick={onExit}>
            All games
          </button>
        </div>
      );
    },
  resetLazyRoot: () => undefined,
}));

import { PLAY_STORE_URL } from '@simple-games/brand';
import {
  initWebAppPrompt,
  resetWebAppPromptForTesting,
  shouldShowWebAppPrompt,
} from '../services/webAppPrompt';
import { SettingsProvider } from '../state/SettingsContext';
import { createMemoryKV } from '../storage/kv';
import { settingsSchema } from '../storage/schemas';
import { en } from '../i18n/locales/en';
import { resetRecentGamesForTesting } from './recentGames';
import { App } from './App';

function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}

/** `history.back()` is asynchronous: popstate lands a task later. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const card = () => screen.queryByRole('region', { name: en.webAppPromptTitle });

/**
 * Open a game from the collection and come back the way a player does. Always
 * from the full list, because a game played once is on the home twice from
 * then on — the shortcut row carries it too, and either door opens it.
 */
async function playAndReturn(user: ReturnType<typeof userEvent.setup>, title: string) {
  const list = screen.getByRole('navigation', { name: en.gamesHeading });
  await user.click(within(list).getByRole('button', { name: title }));
  await screen.findByText(/^playing /);
  await user.click(screen.getByRole('button', { name: 'All games' }));
  await settle();
}

beforeEach(async () => {
  vi.clearAllMocks();
  capacitorMock.native = false;
  networkMock.online = true;
  resetRecentGamesForTesting();
  await initWebAppPrompt(createMemoryKV());
  window.history.replaceState(null, '', '/');
});

afterEach(async () => {
  cleanup();
  resetWebAppPromptForTesting();
  await settle();
  window.history.replaceState(null, '', '/');
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without a storage implementation: nothing to clear.
  }
});

describe('the browser version', () => {
  it('says nothing on a first visit', () => {
    renderShell();
    expect(card()).not.toBeInTheDocument();
  });

  it('says nothing after one game', async () => {
    const user = userEvent.setup();
    renderShell();
    await playAndReturn(user, 'Sudoku');
    expect(card()).not.toBeInTheDocument();
  });

  it('shows the card when the second game hands the collection back', async () => {
    const user = userEvent.setup();
    renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');

    const shown = card();
    expect(shown).toBeInTheDocument();
    expect(shown).toHaveTextContent(en.webAppPromptBody);
  });

  /**
   * Where it lands is the difference between an invitation and an
   * interruption: below the games somebody just came back for, above the
   * thirty they scroll through.
   */
  it('sits between the shortcut row and the full list', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');

    const blocks = Array.from(
      container.querySelectorAll('.game-recent, .app-prompt, .game-sections'),
    ).map((element) => element.className.split(' ')[0]);
    expect(blocks).toEqual(['game-recent', 'app-prompt', 'game-sections']);
  });

  it('goes away when closed and does not come back on the next game', async () => {
    const user = userEvent.setup();
    renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');

    await user.click(screen.getByRole('button', { name: en.close }));
    expect(card()).not.toBeInTheDocument();

    await playAndReturn(user, 'Sudoku');
    expect(card()).not.toBeInTheDocument();
  });

  it('does not come back after a reload once it has been shown', async () => {
    const user = userEvent.setup();
    const first = renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');
    expect(card()).toBeInTheDocument();
    first.unmount();

    renderShell();
    expect(card()).not.toBeInTheDocument();
  });

  /**
   * A visit that ends before the card is due leaves the count behind, so the
   * next launch opens on the collection with the card already earned — which
   * is also how an offline visit gets its card once the connection is back.
   */
  it('shows a card earned in an earlier visit at the next launch', async () => {
    const user = userEvent.setup();
    const first = renderShell();
    networkMock.online = false;
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');
    expect(card()).not.toBeInTheDocument();
    first.unmount();

    networkMock.online = true;
    renderShell();
    expect(card()).toBeInTheDocument();
  });

  it('sends a tap on the store button out to the listing, and closes', async () => {
    const user = userEvent.setup();
    renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');

    await user.click(screen.getByRole('button', { name: 'Google Play' }));
    expect(openExternalMock).toHaveBeenCalledWith(PLAY_STORE_URL);
    expect(card()).not.toBeInTheDocument();
  });
});

describe('the app build', () => {
  it('never shows the card, however many games are played', async () => {
    capacitorMock.native = true;
    const user = userEvent.setup();
    renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');
    await playAndReturn(user, 'Reversi');

    expect(card()).not.toBeInTheDocument();
    expect(shouldShowWebAppPrompt()).toBe(false);
  });
});
