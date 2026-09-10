/**
 * The app card as the shell actually produces it (issue #192,
 * docs/WEB_VERSION.md「アプリへの送客」). The card says *what* and decides for
 * itself *whether*; what is only visible from here is that nothing else does —
 * the number of games played, the door somebody came in by, a reload, a trip
 * through the settings and a browser that still carries the old record all
 * leave it exactly where it is.
 *
 * That is the whole change this file was rewritten for. It used to pin the
 * opposite: a counter, two thresholds, and one showing per browser.
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

const { capacitorMock, networkMock, openExternalMock, storeData, storeTouched } = vi.hoisted(
  () => ({
    capacitorMock: { native: false },
    networkMock: { online: true },
    openExternalMock: vi.fn(),
    storeData: new Map<string, string>(),
    storeTouched: [] as string[],
  }),
);

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

/**
 * Every key the shell reads or writes while these tests run, recorded so the
 * retired record can be asserted *gone* rather than merely unused: nothing
 * gets `sg.webAppPrompt` and nothing sets it, whatever the browser already
 * has under that key (issue #192).
 */
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => {
      storeTouched.push(key);
      return Promise.resolve({ value: storeData.get(key) ?? null });
    },
    set: ({ key, value }: { key: string; value: string }) => {
      storeTouched.push(key);
      storeData.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      storeTouched.push(key);
      storeData.delete(key);
      return Promise.resolve();
    },
  },
}));

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
import { SettingsProvider } from '../state/SettingsContext';
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

/**
 * The other way home: the browser's own Back button. It takes a different path
 * through the shell — the popstate handler, not `exitGame` — and since a
 * `?game=<id>` link is a supported entry point (issue #83), it is how a real
 * visitor returns as often as the in-game control is.
 */
async function playAndGoBack(user: ReturnType<typeof userEvent.setup>, title: string) {
  const list = screen.getByRole('navigation', { name: en.gamesHeading });
  await user.click(within(list).getByRole('button', { name: title }));
  await screen.findByText(/^playing /);
  window.history.back();
  await settle();
  // A history traversal is asynchronous in jsdom as in a browser, and one
  // macrotask is not a promise that popstate has landed: wait for the screen
  // the address now names rather than assuming it is already painted.
  await screen.findByRole('navigation', { name: en.gamesHeading });
}

beforeEach(() => {
  vi.clearAllMocks();
  capacitorMock.native = false;
  networkMock.online = true;
  storeTouched.length = 0;
  storeData.clear();
  resetRecentGamesForTesting();
  window.history.replaceState(null, '', '/');
});

afterEach(async () => {
  cleanup();
  await settle();
  window.history.replaceState(null, '', '/');
});

describe('the browser version', () => {
  it('shows the card on a first visit, before any game has been played', () => {
    renderShell();
    const shown = card();
    expect(shown).toBeInTheDocument();
    expect(shown).toHaveTextContent(en.webAppPromptBody);
  });

  /**
   * Where it lands is the difference between an invitation and an
   * interruption — and, now that it is permanent, between a card and a hero.
   * Under the collection's own hero, above both shelves and the full list, at
   * the same place on every visit however much the shelves grow.
   */
  it('sits under the hero and above the shelves and the full list', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');

    const blocks = Array.from(
      container.querySelectorAll(
        '.home-hero, .app-store-card, .game-favorites, .game-recent, .game-sections',
      ),
    ).map((element) => element.className.split(' ')[0]);
    expect(blocks).toEqual(['home-hero', 'app-store-card', 'game-recent', 'game-sections']);
  });

  it('is still there after a game, and after several', async () => {
    const user = userEvent.setup();
    renderShell();
    expect(card()).toBeInTheDocument();

    await playAndReturn(user, 'Sudoku');
    expect(card()).toBeInTheDocument();

    await playAndReturn(user, 'Kakuro');
    await playAndReturn(user, 'Reversi');
    expect(card()).toBeInTheDocument();
  });

  it('is still there after a trip through the settings screen', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: en.settings }));
    await user.click(await screen.findByRole('button', { name: en.back }));
    expect(card()).toBeInTheDocument();
  });

  /**
   * The browser's Back button reaches the collection through the popstate
   * handler rather than through `exitGame`, so it is a second wiring of the
   * same screen — and the one a visitor who arrived on a `?game=` link uses.
   */
  it('is still there when the browser Back button is what came home', async () => {
    const user = userEvent.setup();
    renderShell();
    await playAndGoBack(user, 'Sudoku');
    expect(card()).toBeInTheDocument();
  });

  it('is still there after a reload', async () => {
    const user = userEvent.setup();
    const first = renderShell();
    await playAndReturn(user, 'Sudoku');
    expect(card()).toBeInTheDocument();
    first.unmount();

    renderShell();
    expect(card()).toBeInTheDocument();
  });

  it('sends a tap on the store button out to the listing, and stays', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Google Play' }));
    expect(openExternalMock).toHaveBeenCalledWith(PLAY_STORE_URL);
    expect(card()).toBeInTheDocument();
  });

  /**
   * A visit that opens straight on a game (issue #83). It used to be the one
   * arrival with a threshold of its own; now it is not an arrival the shell
   * has any opinion about, and the collection behind the game carries the same
   * card as every other visit.
   */
  it('carries the same card for a visitor who arrived on a game link', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?game=sudoku');
    renderShell();
    await screen.findByText('playing sudoku');
    expect(card()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All games' }));
    await settle();
    expect(card()).toBeInTheDocument();
  });
});

describe('offline', () => {
  it('leaves the card out and the collection playable', async () => {
    networkMock.online = false;
    const user = userEvent.setup();
    renderShell();
    expect(card()).not.toBeInTheDocument();

    // Nothing else about the home changed: a game still opens and comes back.
    await playAndReturn(user, 'Sudoku');
    expect(card()).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: en.gamesHeading })).toBeInTheDocument();
  });
});

describe('the app build', () => {
  it('never shows the card, before or after any number of games', async () => {
    capacitorMock.native = true;
    const user = userEvent.setup();
    renderShell();
    expect(card()).not.toBeInTheDocument();

    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');
    expect(card()).not.toBeInTheDocument();
  });
});

/**
 * The retired record (issue #192). `sg.webAppPrompt` is not read, not written
 * and not deleted — and a browser that still has one from an earlier version
 * is treated exactly like a browser that never had one, because nothing looks.
 */
describe('the record this card no longer keeps', () => {
  it('never touches sg.webAppPrompt, however the visit goes', async () => {
    const user = userEvent.setup();
    renderShell();
    await playAndReturn(user, 'Sudoku');
    await playAndReturn(user, 'Kakuro');
    await user.click(screen.getByRole('button', { name: 'Google Play' }));

    expect(storeTouched).not.toContain('sg.webAppPrompt');
    // The shell did reach storage in the meantime, so the assertion above is
    // about this key rather than about a store nobody called.
    expect(storeTouched.length).toBeGreaterThan(0);
  });

  it('shows the card on a browser that still carries the retired record', () => {
    // What a browser upgraded from the one-time card looks like: shown, and
    // therefore never eligible again under the old rule.
    storeData.set(
      'sg.webAppPrompt',
      JSON.stringify({ schemaVersion: 1, gameExits: 2, shown: true }),
    );
    renderShell();

    expect(card()).toBeInTheDocument();
    expect(storeTouched).not.toContain('sg.webAppPrompt');
    // And it is left exactly as it was: no read, no write, and no delete
    // dressed up as a migration (issue #192).
    expect(storeData.get('sg.webAppPrompt')).toBe(
      JSON.stringify({ schemaVersion: 1, gameExits: 2, shown: true }),
    );
  });
});
