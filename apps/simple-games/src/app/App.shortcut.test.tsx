/**
 * The shell answering an Android home-screen shortcut (issue #110): a pinned
 * icon that launches the app straight into one game, the Android counterpart
 * of the browser's `?game=` arrival (App.route.test.tsx).
 *
 * Two arrivals, and each is pinned separately below:
 *
 * - **Cold start.** The launch Intent's URI is read at boot
 *   (app/shortcutLaunch.ts) and the shell's first render is the game — the
 *   collection never flashes on the way. An id this build no longer carries
 *   lands on the collection, and a launch from the plain app icon opens the
 *   collection as it always did.
 * - **Warm start.** The activity is `singleTask`, so a tap on a shortcut
 *   while the app is running arrives as `appUrlOpen`. The same game already
 *   showing is left alone; a different game closes this one and opens that
 *   one without a review question in between; a retired id lands on the
 *   collection. The plugin also replays a cold start's own URI once a
 *   listener exists, and that replay must be a no-op.
 *
 * Nothing here writes history — there is none — and the hardware back button
 * keeps its owners: the game while it shows, the shell on the collection.
 *
 * The games are stubbed for the reason App.route.test.tsx gives: a real
 * title opens on its tutorial, and this file is about the shell.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, appMock, reviewMock } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  const state = { launchUrl: undefined as string | undefined };
  return {
    capacitorMock: { native: true },
    reviewMock: {
      shouldPromptReview: vi.fn<() => boolean>(() => false),
      markReviewPromptShown: vi.fn(),
    },
    appMock: {
      state,
      listeners,
      /** Delivers one plugin event to every listener the shell registered for it. */
      fire(name: string, event: unknown) {
        for (const listener of listeners.get(name) ?? []) listener(event);
      },
      App: {
        addListener: vi.fn((name: string, listener: Listener) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name)!.add(listener);
          return Promise.resolve({
            remove: () => {
              listeners.get(name)?.delete(listener);
            },
          });
        }),
        getLaunchUrl: vi.fn(() =>
          Promise.resolve(state.launchUrl ? { url: state.launchUrl } : undefined),
        ),
        minimizeApp: vi.fn(() => Promise.resolve()),
        exitApp: vi.fn(() => Promise.resolve()),
        // The settings screen shows the app's version on native.
        getInfo: vi.fn(() => Promise.resolve({ version: '0.0.0' })),
      },
    },
  };
});

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

vi.mock('@capacitor/app', () => ({ App: appMock.App }));

// The question the shell may ask on the way out of a game
// (docs/REVIEW_PROMPT_POLICY.md). Answered "yes, ask" by a test that needs to
// see it *not* asked; the rest of the module is real.
vi.mock('../services/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/review')>()),
  shouldPromptReview: reviewMock.shouldPromptReview,
  markReviewPromptShown: reviewMock.markReviewPromptShown,
}));

// Closing a game releases the shared audio context — the visible edge of "the
// shell tore the game down", which is what the same-game test needs to be
// able to say did not happen.
vi.mock('../services/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/sound')>()),
  releaseSound: vi.fn(),
}));

// The stub shows the door it was handed (issue #113). A real game answers
// that fact by choosing its own first screen; the shell's side of the
// contract is only that the fact arrives, and arrives correctly.
vi.mock('./lazyRoots', () => ({
  getLazyRoot: (gameId: string) =>
    function StubGameRoot({
      onExit,
      entry,
    }: {
      onExit: () => void;
      entry?: 'collection' | 'shortcut';
    }) {
      return (
        <div>
          <p>{`playing ${gameId}`}</p>
          <p data-testid="entry">{entry ?? 'none'}</p>
          <button type="button" onClick={onExit}>
            All games
          </button>
        </div>
      );
    },
  resetLazyRoot: () => undefined,
}));

import { WEB_PLAY_URL } from '@simple-games/brand';
import { releaseSound } from '../services/sound';
import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema } from '../storage/schemas';
import { getRecentGames, resetRecentGamesForTesting } from './recentGames';
import {
  initShortcutLaunch,
  resetShortcutLaunchForTesting,
  shortcutUrlFor,
} from './shortcutLaunch';
import { App } from './App';

const RETIRED = `${WEB_PLAY_URL}?game=retired-game`;

function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}

/** A cold start: boot reads the launch Intent, then the shell renders. */
async function launchFrom(url: string | undefined) {
  appMock.state.launchUrl = url;
  await initShortcutLaunch();
  return renderShell();
}

/** A shortcut tapped while the app is running: the plugin's `appUrlOpen`. */
function tapShortcut(url: string) {
  act(() => appMock.fire('appUrlOpen', { url }));
}

function pressHardwareBack() {
  act(() => appMock.fire('backButton', {}));
}

function watchHistory() {
  return {
    push: vi.spyOn(window.history, 'pushState'),
    replace: vi.spyOn(window.history, 'replaceState'),
    back: vi.spyOn(window.history, 'back'),
  };
}

const playing = (gameId: string) => screen.getByText(`playing ${gameId}`);
/** Which door the shell told the game it came through (issue #113). */
const enteredBy = () => screen.getByTestId('entry').textContent;
const collectionHome = () => screen.findByRole('heading', { name: 'Simple Games' });
const leaveGame = () => screen.getByRole('button', { name: 'All games' });

beforeEach(() => {
  capacitorMock.native = true;
  appMock.state.launchUrl = undefined;
  appMock.listeners.clear();
  appMock.App.addListener.mockClear();
  appMock.App.getLaunchUrl.mockClear();
  appMock.App.minimizeApp.mockClear();
  reviewMock.shouldPromptReview.mockReturnValue(false);
  reviewMock.markReviewPromptShown.mockClear();
  vi.mocked(releaseSound).mockClear();
  resetRecentGamesForTesting();
  resetShortcutLaunchForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  window.history.replaceState(null, '', '/');
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without a storage implementation: nothing to clear.
  }
});

describe('a cold start from a home-screen shortcut', () => {
  it('opens the game it names, as the first thing on screen', async () => {
    const history = watchHistory();
    await launchFrom(shortcutUrlFor('sudoku'));

    // Synchronous on purpose: the first render is the game, not the
    // collection followed by the game.
    expect(playing('sudoku')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Simple Games' })).not.toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBe('sudoku');
    // No address to write: the app has no history.
    expect(history.push).not.toHaveBeenCalled();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('tells the game the shortcut was the door it came through', async () => {
    await launchFrom(shortcutUrlFor('sudoku'));

    // What the game does about it is the game's own business: one that keeps
    // a single suspended board may open straight onto it, and the shell never
    // hears which it chose (app/registry.ts, issue #113).
    expect(enteredBy()).toBe('shortcut');
  });

  it('counts as an open, so the game reaches the shortcut row on the home', async () => {
    await launchFrom(shortcutUrlFor('kakuro'));
    expect(playing('kakuro')).toBeInTheDocument();
    expect(getRecentGames()).toEqual(['kakuro']);
  });

  // A shortcut outlives the build that made it: the icon for a game withdrawn
  // in a later release still sits on the home screen.
  it('lands on the collection for a game this build no longer carries', async () => {
    await launchFrom(RETIRED);
    expect(await collectionHome()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sudoku/ })).toBeInTheDocument();
    expect(getRecentGames()).toEqual([]);
  });

  it('is not what a launch from the app icon does: that still opens the collection', async () => {
    await launchFrom(undefined);
    expect(await collectionHome()).toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBeUndefined();
  });

  /**
   * The App plugin retains the launch Intent's `appUrlOpen` until a listener
   * exists, then replays it — so every cold start from a shortcut is followed
   * by a warm-start echo of the same URI. Boot already opened that game; the
   * echo must find nothing to do, or every shortcut launch would tear the
   * game down and mount it again a moment after it appeared.
   */
  it('ignores the plugin’s replay of the launch it already answered', async () => {
    await launchFrom(shortcutUrlFor('sudoku'));
    const board = playing('sudoku');

    tapShortcut(shortcutUrlFor('sudoku'));

    expect(playing('sudoku')).toBe(board);
    expect(releaseSound).not.toHaveBeenCalled();
    expect(getRecentGames()).toEqual(['sudoku']);
  });
});

describe('a shortcut tapped while the app is running', () => {
  it('opens the game from the collection', async () => {
    await launchFrom(undefined);
    await collectionHome();

    tapShortcut(shortcutUrlFor('sudoku'));

    expect(playing('sudoku')).toBeInTheDocument();
    expect(enteredBy()).toBe('shortcut');
    expect(document.documentElement.dataset.game).toBe('sudoku');
    expect(getRecentGames()).toEqual(['sudoku']);
  });

  it('opens the game from the settings screen', async () => {
    const user = userEvent.setup();
    await launchFrom(undefined);
    await collectionHome();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('heading', { name: 'Simple Games' })).not.toBeInTheDocument();

    tapShortcut(shortcutUrlFor('hearts'));

    expect(playing('hearts')).toBeInTheDocument();
  });

  it('swaps one game for another, closing the first', async () => {
    await launchFrom(shortcutUrlFor('sudoku'));
    playing('sudoku');

    tapShortcut(shortcutUrlFor('kakuro'));

    expect(playing('kakuro')).toBeInTheDocument();
    expect(enteredBy()).toBe('shortcut');
    expect(screen.queryByText('playing sudoku')).not.toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBe('kakuro');
    expect(releaseSound).toHaveBeenCalledTimes(1);
    expect(getRecentGames()).toEqual(['kakuro', 'sudoku']);
  });

  /**
   * The review question's doorway is the game's own back control, on the way
   * to the collection (docs/REVIEW_PROMPT_POLICY.md). A shortcut to another
   * game is the player on their way somewhere; asking in that doorway is not a
   * pause. The doorway itself still works — checked here in the same run, so
   * the test cannot pass by the question being off altogether.
   */
  it('asks no review question on the way from one game to another', async () => {
    const user = userEvent.setup();
    reviewMock.shouldPromptReview.mockReturnValue(true);
    await launchFrom(shortcutUrlFor('sudoku'));

    tapShortcut(shortcutUrlFor('kakuro'));
    expect(playing('kakuro')).toBeInTheDocument();
    expect(reviewMock.markReviewPromptShown).not.toHaveBeenCalled();

    await user.click(leaveGame());
    expect(await collectionHome()).toBeInTheDocument();
    expect(reviewMock.markReviewPromptShown).toHaveBeenCalledTimes(1);
  });

  it('leaves the same game alone: a door, not a reset', async () => {
    await launchFrom(undefined);
    await collectionHome();
    tapShortcut(shortcutUrlFor('sudoku'));
    const board = playing('sudoku');

    tapShortcut(shortcutUrlFor('sudoku'));

    expect(playing('sudoku')).toBe(board);
    expect(releaseSound).not.toHaveBeenCalled();
  });

  it('lands a retired shortcut on the collection, closing the game that was showing', async () => {
    reviewMock.shouldPromptReview.mockReturnValue(true);
    await launchFrom(shortcutUrlFor('sudoku'));
    playing('sudoku');

    tapShortcut(RETIRED);

    expect(await collectionHome()).toBeInTheDocument();
    expect(screen.queryByText('playing sudoku')).not.toBeInTheDocument();
    expect(releaseSound).toHaveBeenCalledTimes(1);
    // A fail-safe landing is not the pause the question waits for either.
    expect(reviewMock.markReviewPromptShown).not.toHaveBeenCalled();
  });

  it('does nothing on the collection for a retired shortcut', async () => {
    await launchFrom(undefined);
    await collectionHome();

    tapShortcut(RETIRED);

    expect(await collectionHome()).toBeInTheDocument();
    expect(releaseSound).not.toHaveBeenCalled();
  });
});

describe('the hardware back button after a shortcut launch', () => {
  it('belongs to the game while it shows, and to the shell on the collection', async () => {
    const user = userEvent.setup();
    await launchFrom(shortcutUrlFor('sudoku'));
    playing('sudoku');

    // The shell keeps exactly one owner: while a game is mounted it registers
    // no listener of its own, exactly as when the game was opened by a tap.
    // (The stub game registers none either, so the set is empty.)
    expect(appMock.listeners.get('backButton')?.size ?? 0).toBe(0);

    // The game's own way out: the same exit a tap-opened game takes.
    await user.click(leaveGame());
    expect(await collectionHome()).toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBeUndefined();

    // And on the collection, back means what it always meant.
    await act(async () => {
      await Promise.resolve();
    });
    expect(appMock.listeners.get('backButton')?.size).toBe(1);
    pressHardwareBack();
    expect(appMock.App.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it('is unchanged by a warm-start swap: the new game owns it', async () => {
    await launchFrom(shortcutUrlFor('sudoku'));
    tapShortcut(shortcutUrlFor('kakuro'));
    playing('kakuro');

    expect(appMock.listeners.get('backButton')?.size ?? 0).toBe(0);
    expect(appMock.App.minimizeApp).not.toHaveBeenCalled();
  });
});

describe('the ordinary way in', () => {
  /**
   * The contrast that gives the shortcut its meaning: a tap on a tile is
   * somebody choosing a game from the collection, and it says so. A game may
   * only open straight onto a suspended board for the other door (issue #113).
   */
  it('is a tile on the collection, and the game is told so', async () => {
    const user = userEvent.setup();
    await launchFrom(undefined);
    await collectionHome();

    await user.click(screen.getByRole('button', { name: /Sudoku/ }));

    expect(playing('sudoku')).toBeInTheDocument();
    expect(enteredBy()).toBe('collection');
  });

  it('is also how a game re-opened after a shortcut launch comes back', async () => {
    const user = userEvent.setup();
    await launchFrom(shortcutUrlFor('sudoku'));
    expect(enteredBy()).toBe('shortcut');

    await user.click(leaveGame());
    await collectionHome();
    // Two tiles carry the title now — the shortcut row remembers the game
    // that was just played, and the grid always had it (app/recentGames.ts).
    await user.click(screen.getAllByRole('button', { name: /Sudoku/ })[0]!);

    // The launch is over. Coming back by hand is coming back by hand, and a
    // game that resumed on the way in must not resume again on the way back.
    expect(enteredBy()).toBe('collection');
  });
});

describe('the shell the browser runs', () => {
  it('never registers for a shortcut, and never reads the launch', async () => {
    capacitorMock.native = false;
    await launchFrom(shortcutUrlFor('sudoku'));

    expect(await collectionHome()).toBeInTheDocument();
    expect(appMock.App.getLaunchUrl).not.toHaveBeenCalled();
    expect(appMock.listeners.get('appUrlOpen')?.size ?? 0).toBe(0);
  });
});
