/**
 * The shell following an address (issue #83). A visitor who searched for one
 * game and read its guide should land in that game, not in a list of thirty
 * where they have to find it a second time — and once inside, Back should
 * mean what it means everywhere else on the web.
 *
 * Two behaviours are easy to get wrong and are each pinned below:
 *
 * - **Arriving from outside is not the same as walking in from the
 *   collection.** A guide page is one Back press behind a direct arrival, so
 *   leaving the game must rewrite the address rather than spend that press.
 *   Somebody who opened the game from the collection *does* have a collection
 *   entry behind them, and gets it back, with Forward still working.
 * - **The app does none of this.** Its screen is not an address, and its
 *   hardware back button already owns the gesture
 *   (docs/ARCHITECTURE.md「ハードウェア戻るボタン」). The last block renders the
 *   shell the way the app sees it and checks that nothing is read or written.
 *
 * The games are stubbed here. Every one of the thirty opens on its tutorial
 * until it has been finished once, and a tutorial offers no way back to the
 * collection — so a real title would make "the game asked to leave" a walk
 * through that title's own screens, which is not what this file is about. The
 * stub is exactly the contract the shell relies on: a root that is handed
 * `onExit`. That a real chunk mounts from a real address is App.test.tsx's
 * 「opens the game its address names」; the plain URL functions are
 * webRoute.test.ts.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

// The real module is kept and only the platform answer is swapped: `App` pulls
// in `@capacitor/app`, which needs `registerPlugin` from here, and so does the
// Preferences-backed store the collection reads its shortcut row from.
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

// The shell registers a hardware back listener while it thinks it is native;
// a stub keeps that deterministic and off the real plugin.
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: () => Promise.resolve({ remove: () => undefined }),
    minimizeApp: () => Promise.resolve(),
    exitApp: () => Promise.resolve(),
  },
}));

// Closing a game releases the shared audio context. That call is the visible
// edge of "the shell tore the game down", which is what one test below needs
// to be able to say did *not* happen. SettingsContext imports this module too,
// so the rest of it is kept.
vi.mock('../services/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/sound')>()),
  releaseSound: vi.fn(),
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
          {/* A game asking to leave twice before it has unmounted — the shell
              must not walk back twice, which would step out of the site. */}
          <button
            type="button"
            onClick={() => {
              onExit();
              onExit();
            }}
          >
            All games twice
          </button>
        </div>
      );
    },
  resetLazyRoot: () => undefined,
}));

import { releaseSound } from '../services/sound';
import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema } from '../storage/schemas';
import { getRecentGames, resetRecentGamesForTesting } from './recentGames';
import { App } from './App';

const PLAY = '/simple-games/play/';
/** Where a visitor arrives from: the game's own guide page, one Back behind. */
const GUIDE = '/simple-games/games/sudoku/en/';

function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}

/** Puts the document at an address without adding a history entry. */
function arriveAt(href: string) {
  window.history.replaceState(null, '', href);
}

/** `history.back()` / `forward()` are asynchronous: popstate lands a task later. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function goBack() {
  window.history.back();
  await settle();
}

async function goForward() {
  window.history.forward();
  await settle();
}

/**
 * Starts counting what the shell does to history from this line on.
 *
 * `history.length` cannot answer these questions: jsdom keeps one session
 * history for the whole file, and a push after a back truncates the entries in
 * front of it — so the number depends on which tests ran before. Which method
 * the shell reached for does not, and it is the more exact question anyway:
 * "walked back" and "pushed a third entry" both leave the same address.
 */
function watchHistory() {
  return {
    push: vi.spyOn(window.history, 'pushState'),
    replace: vi.spyOn(window.history, 'replaceState'),
    back: vi.spyOn(window.history, 'back'),
  };
}

const playing = (gameId: string) => screen.findByText(`playing ${gameId}`);
const collectionHome = () => screen.findByRole('heading', { name: 'Simple Games' });
const leaveGame = () => screen.getByRole('button', { name: 'All games' });
const leaveGameTwice = () => screen.getByRole('button', { name: 'All games twice' });

beforeEach(() => {
  capacitorMock.native = false;
  resetRecentGamesForTesting();
  arriveAt('/');
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  arriveAt('/');
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without a storage implementation: nothing to clear.
  }
});

describe('arriving at a game address', () => {
  it('opens that game instead of the collection', async () => {
    arriveAt(`${PLAY}?game=sudoku`);
    renderShell();

    expect(await playing('sudoku')).toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBe('sudoku');
    expect(window.location.search).toBe('?game=sudoku');
  });

  // A reload is the same arrival again — the address is the only thing the
  // browser carries across it, which is the point of putting the game there.
  it('opens the same game again after a reload', async () => {
    arriveAt(`${PLAY}?game=solitaire`);
    const first = renderShell();
    expect(await playing('solitaire')).toBeInTheDocument();
    first.unmount();

    renderShell();
    expect(await playing('solitaire')).toBeInTheDocument();
  });

  it('counts as an open, so the game reaches the shortcut row', async () => {
    arriveAt(`${PLAY}?game=kakuro`);
    renderShell();
    await playing('kakuro');

    expect(getRecentGames()).toEqual(['kakuro']);
  });

  it.each([
    ['an id no build carries', `${PLAY}?game=not-a-game`],
    ['an empty value', `${PLAY}?game=`],
  ])('shows the collection for %s, and drops it from the address', async (_case, href) => {
    arriveAt(href);
    renderShell();

    expect(await collectionHome()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sudoku/ })).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('keeps whatever else the link carried', async () => {
    arriveAt(`${PLAY}?utm_source=guide&game=not-a-game`);
    renderShell();

    await collectionHome();
    expect(window.location.search).toBe('?utm_source=guide');
  });
});

describe('walking in from the collection', () => {
  it('puts the opened game in the address, one entry forward', async () => {
    const user = userEvent.setup();
    arriveAt(PLAY);
    renderShell();
    await collectionHome();
    const history = watchHistory();

    await user.click(screen.getByRole('button', { name: /Sudoku/ }));

    expect(await playing('sudoku')).toBeInTheDocument();
    expect(window.location.search).toBe('?game=sudoku');
    // Pushed, not rewritten: Back has to have somewhere to return to.
    expect(history.push).toHaveBeenCalledTimes(1);
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('returns to the collection when the game asks, and Forward opens it again', async () => {
    const user = userEvent.setup();
    arriveAt(PLAY);
    renderShell();
    await collectionHome();
    await user.click(screen.getByRole('button', { name: /Sudoku/ }));
    await playing('sudoku');

    await user.click(leaveGame());
    await settle();
    expect(await collectionHome()).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(document.documentElement.dataset.game).toBeUndefined();

    await goForward();
    expect(await playing('sudoku')).toBeInTheDocument();
    expect(window.location.search).toBe('?game=sudoku');
  });

  // Not every step of history is a change of game. A same-document entry that
  // leaves `?game=` alone — an in-page anchor, or any other script on the page
  // pushing state — must not be answered by closing the running game and
  // opening it again. The board would survive it (the lazy wrapper is cached,
  // so React reconciles rather than remounts), but the shared audio would be
  // suspended under a game still using it, and a close and an open nobody
  // navigated would be booked against the session.
  it('leaves a running game alone when a step does not change the game', async () => {
    const user = userEvent.setup();
    arriveAt(PLAY);
    renderShell();
    await collectionHome();
    await user.click(screen.getByRole('button', { name: /Sudoku/ }));
    await playing('sudoku');
    window.history.pushState(null, '', `${PLAY}?game=sudoku#rules`);
    vi.mocked(releaseSound).mockClear();

    await goBack();

    expect(await playing('sudoku')).toBeInTheDocument();
    expect(window.location.search).toBe('?game=sudoku');
    expect(releaseSound).not.toHaveBeenCalled();
  });

  it('follows the browser Back out of the game and Forward into it again', async () => {
    const user = userEvent.setup();
    arriveAt(PLAY);
    renderShell();
    await collectionHome();
    await user.click(screen.getByRole('button', { name: /Sudoku/ }));
    await playing('sudoku');

    await goBack();
    expect(await collectionHome()).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(document.documentElement.dataset.game).toBeUndefined();

    await goForward();
    expect(await playing('sudoku')).toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBe('sudoku');
  });

  // Leaving is a step back onto the collection, never a third entry pushed on
  // top of it — otherwise looking at two games in turn would leave a trail the
  // visitor has to walk out of one game at a time.
  it('walks back to the collection instead of pushing over the game', async () => {
    const user = userEvent.setup();
    arriveAt(PLAY);
    renderShell();
    await collectionHome();
    await user.click(screen.getByRole('button', { name: /Sudoku/ }));
    await playing('sudoku');
    const history = watchHistory();

    await user.click(leaveGame());
    await settle();
    await collectionHome();
    expect(history.back).toHaveBeenCalledTimes(1);
    expect(history.push).not.toHaveBeenCalled();
    expect(history.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Kakuro/ }));
    expect(await playing('kakuro')).toBeInTheDocument();
    expect(window.location.search).toBe('?game=kakuro');
    expect(history.push).toHaveBeenCalledTimes(1);

    await goBack();
    expect(await collectionHome()).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });
});

/**
 * One exit is one step back. Two `onExit()` calls before the game has unmounted
 * would otherwise be two `history.back()` calls — and the second one walks off
 * the end of what this shell put there, onto the page the visitor came from.
 * Measured in Chrome: with the guard removed, a double exit from
 * `/?marker=B&game=kakuro` landed on `/?marker=A`, one entry too far.
 *
 * jsdom cannot show that outcome: it coalesces two traversals queued in the
 * same task into one, so the address ends up correct either way. The count of
 * traversals is the part it can see, so that is what this asks for.
 */
describe('asking to leave twice', () => {
  it('walks back exactly one entry', async () => {
    const user = userEvent.setup();
    arriveAt(GUIDE);
    window.history.pushState(null, '', PLAY);
    renderShell();
    await collectionHome();
    await user.click(screen.getByRole('button', { name: /Sudoku/ }));
    await playing('sudoku');
    const history = watchHistory();

    await user.click(leaveGameTwice());
    await settle();

    expect(history.back).toHaveBeenCalledTimes(1);
    expect(await collectionHome()).toBeInTheDocument();
    expect(window.location.pathname).toBe(PLAY);
    expect(window.location.search).toBe('');
  });
});

describe('leaving a game that was arrived at directly', () => {
  // The entry behind belongs to the guide page the visitor came from. Spending
  // it here would make "back to the collection" and "back out of the site" the
  // same press, and the game would be one bounce away from re-opening itself.
  it('drops the game from the address without spending the way back out', async () => {
    const user = userEvent.setup();
    arriveAt(`${PLAY}?game=sudoku`);
    renderShell();
    await playing('sudoku');
    const history = watchHistory();

    await user.click(leaveGame());
    await settle();

    expect(await collectionHome()).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(history.back).not.toHaveBeenCalled();
    expect(history.replace).toHaveBeenCalledTimes(1);
  });

  it('still opens the next game one entry forward, so Back returns here', async () => {
    const user = userEvent.setup();
    arriveAt(`${PLAY}?game=sudoku`);
    renderShell();
    await playing('sudoku');
    await user.click(leaveGame());
    await settle();
    await collectionHome();
    const history = watchHistory();

    await user.click(screen.getByRole('button', { name: /Kakuro/ }));
    await playing('kakuro');
    expect(history.push).toHaveBeenCalledTimes(1);

    await goBack();
    expect(await collectionHome()).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });
});

describe('the shell the app runs', () => {
  it('opens the collection whatever the address says, and leaves it alone', async () => {
    capacitorMock.native = true;
    arriveAt(`${PLAY}?game=sudoku`);
    const history = watchHistory();
    renderShell();

    expect(await collectionHome()).toBeInTheDocument();
    // Not even the tidying rewrite the browser does on an id it cannot use:
    // there is no address here to be wrong.
    expect(window.location.search).toBe('?game=sudoku');
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('opens and leaves a game without touching history', async () => {
    capacitorMock.native = true;
    const user = userEvent.setup();
    arriveAt(PLAY);
    renderShell();
    await collectionHome();
    const history = watchHistory();

    await user.click(screen.getByRole('button', { name: /Sudoku/ }));
    expect(await playing('sudoku')).toBeInTheDocument();
    expect(window.location.search).toBe('');

    await user.click(leaveGame());
    await settle();
    expect(await collectionHome()).toBeInTheDocument();
    expect(window.location.search).toBe('');

    expect(history.push).not.toHaveBeenCalled();
    expect(history.replace).not.toHaveBeenCalled();
    expect(history.back).not.toHaveBeenCalled();
  });
});
