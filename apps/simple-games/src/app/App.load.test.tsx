/**
 * The shell while a game view has no mounted game (issue #120): a chunk
 * still loading, a chunk that failed, and the settings screen — the same
 * "who owns the screen" question App.shortcut.test.tsx asks for a mounted
 * game, asked here for the three states where nothing has mounted yet.
 *
 * Two contracts from the issue:
 *
 * - **No flash for a fast load.** Loading a bundled chunk normally finishes
 *   in a frame or two; GameLoadingFallback.test.tsx pins the component's own
 *   200ms gate in isolation. This file pins the same promise through the
 *   real wiring: App.tsx's Suspense around the real `getLazyRoot` (`
 *   app/lazyRoots.ts`), not a stand-in.
 * - **Hardware back follows ownership.** App.tsx keeps exactly one
 *   `backButton` listener registered at a time (docs/ARCHITECTURE.md「ハード
 *   ウェア戻るボタン」). While a game is showing but nothing has mounted —
 *   loading, or failed — the shell itself registers none; ownership sits
 *   with `useHardwareBackExit` inside the fallback or the error screen
 *   (ui/useHardwareBackExit.ts). The settings screen has no listener of its
 *   own either; App.tsx's `view.kind === 'settings'` effect owns it. Nobody
 *   has ever pinned that the collection reclaims sole ownership the moment
 *   any of these three screens gives it back — that hand-off is this file's
 *   subject.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { lazy, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRootProps } from './registry';

const { capacitorMock, appMock, loader, lazyCache } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  // Each call is its own subscription, the way Capacitor's real event
  // emitter behaves — keyed by a fresh object per call, not by the listener
  // function itself. The loading fallback and the load-error screen are both
  // handed the shell's own `exitGame`, the very same function reference
  // (App.tsx), so a Set<Listener> would dedupe their two registrations into
  // one and a single remove() would silently drop both.
  type Registration = { listener: Listener };
  const listeners = new Map<string, Set<Registration>>();
  return {
    capacitorMock: { platform: 'android' },
    appMock: {
      listeners,
      /** Delivers one plugin event to every listener the shell registered for it. */
      fire(name: string, event: unknown) {
        for (const { listener } of [...(listeners.get(name) ?? [])]) listener(event);
      },
      App: {
        addListener: vi.fn((name: string, listener: Listener) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          const registration: Registration = { listener };
          listeners.get(name)!.add(registration);
          return Promise.resolve({
            remove: () => {
              listeners.get(name)?.delete(registration);
            },
          });
        }),
        minimizeApp: vi.fn(() => Promise.resolve()),
        exitApp: vi.fn(() => Promise.resolve()),
        // The settings screen shows the app's version on native.
        getInfo: vi.fn(() => Promise.resolve({ version: '0.0.0' })),
      },
    },
    // What every game's chunk import becomes here — programmed per test, so
    // a case can hold it pending, resolve it, or reject it on command.
    loader: vi.fn<(id: string) => Promise<{ default: ComponentType<GameRootProps> }>>(),
    // Mirrors app/lazyRoots.ts's own cache: one lazy() per id, made once and
    // reused, so the retry case (F) is only meaningful if resetLazyRoot really
    // drops the entry rather than handing back the same, already-rejected one.
    lazyCache: new Map<string, ReturnType<typeof lazy>>(),
  };
});

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => capacitorMock.platform !== 'web',
      getPlatform: () => capacitorMock.platform,
    },
  };
});

vi.mock('@capacitor/app', () => ({ App: appMock.App }));

// Closing a game releases the shared audio context — the visible edge of "the
// shell tore the game down" that the failed-chunk case (D) can point at, the
// same signal App.shortcut.test.tsx reads for a game that loaded normally.
vi.mock('../services/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/sound')>()),
  releaseSound: vi.fn(),
}));

// A stand-in for app/lazyRoots.ts, not a bypass of it: getLazyRoot still
// creates one React.lazy() per id and caches it, and resetLazyRoot still
// drops the cache entry — the only thing swapped out is what the lazy
// wrapper loads, so each test can drive that import directly.
vi.mock('./lazyRoots', () => ({
  getLazyRoot: (id: string) => {
    const cached = lazyCache.get(id);
    if (cached) return cached;
    const created = lazy(() => loader(id));
    lazyCache.set(id, created);
    return created;
  },
  resetLazyRoot: (id: string) => {
    lazyCache.delete(id);
  },
}));

import { releaseSound } from '../services/sound';
import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema } from '../storage/schemas';
import { resetRecentGamesForTesting } from './recentGames';
import { App } from './App';

/** The stub a resolved chunk hands back — shows the door it was told (issue #113). */
function makeStubGameRoot(id: string) {
  return function StubGameRoot({
    onExit,
    entry,
  }: {
    onExit: () => void;
    entry?: 'collection' | 'shortcut';
  }) {
    return (
      <div>
        <p>{`playing ${id}`}</p>
        <p data-testid="entry">{entry ?? 'none'}</p>
        <button type="button" onClick={onExit}>
          All games
        </button>
      </div>
    );
  };
}

function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}

const openSudoku = () => fireEvent.click(screen.getByRole('button', { name: /Sudoku/ }));
const collectionHeading = () => screen.getByRole('heading', { name: 'Simple Games' });

/**
 * Lets a promise-driven state update (a resolved/rejected loader, a removed
 * plugin-listener handle) land before the next assertion, without a sleep.
 *
 * Enough by construction rather than by tick count: `act` awaits the callback,
 * flushes React's queue, then keeps re-flushing behind a macrotask until React
 * has nothing left (react/act). Any chain of already-resolved promises, and the
 * renders they schedule, has therefore settled by the time this resolves; the
 * two ticks inside only put the first flush after the loader's own `.then`.
 *
 * It is also why the assertions below reach for this instead of `findBy`.
 * `findBy` turns the act environment off while it polls, which hands React back
 * its own scheduler — and there a Suspense boundary that has already committed
 * a fallback is held back for up to FALLBACK_THROTTLE_MS (300ms of real clock,
 * react-dom) before the content is revealed. Measured, every reveal in this
 * file spent a flat ~300ms of `findBy`'s 1000ms deadline waiting out that
 * timer, leaving the rest of the deadline as the only margin against a loaded
 * runner. Settled through `act` the same reveals take 1–12ms and no clock is
 * consulted at all (issue #158).
 */
const flushMicrotasks = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  capacitorMock.platform = 'android';
  appMock.listeners.clear();
  appMock.App.addListener.mockClear();
  appMock.App.minimizeApp.mockClear();
  vi.mocked(releaseSound).mockClear();
  loader.mockReset();
  lazyCache.clear();
  // Otherwise a game this file opened earlier still sits in the "Recently
  // played" row (app/recentGames.ts's cache is in memory, not just storage),
  // and the tile this file is about would then match twice.
  resetRecentGamesForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without a storage implementation: nothing to clear.
  }
});

describe('the loading indicator (no flash while a chunk loads)', () => {
  it('never shows "Loading…" for a chunk that resolves at once', async () => {
    loader.mockImplementation((id) => Promise.resolve({ default: makeStubGameRoot(id) }));
    renderShell();

    openSudoku();
    // The instant the tile is tapped, Suspense has already swapped in the
    // fallback — this is the moment a flash would show if the gate did not
    // hold it back.
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    await flushMicrotasks();
    expect(screen.getByText('playing sudoku')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows the text only once the load has genuinely kept the player waiting', async () => {
    let resolveLoad: ((mod: { default: ComponentType<GameRootProps> }) => void) | undefined;
    loader.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );
    vi.useFakeTimers();
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /Sudoku/ }));

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await act(async () => {
      resolveLoad!({ default: makeStubGameRoot('sudoku') });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('playing sudoku')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });
});

describe('a failed chunk', () => {
  it('shows the error screen, and "All games" tears the game down like any other exit', async () => {
    // The boundary's own console.error (and React's matching log for the
    // same thrown error) are the expected shape of this case, not a defect.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loader.mockImplementation(() => Promise.reject(new Error('chunk missing')));
    renderShell();

    openSudoku();
    await flushMicrotasks();
    expect(screen.getByText('The game could not be loaded.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All games' }));

    expect(collectionHeading()).toBeInTheDocument();
    expect(releaseSound).toHaveBeenCalledTimes(1);
  });

  it('lets "Try again" in by the ordinary door once the chunk actually loads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loader
      .mockImplementationOnce(() => Promise.reject(new Error('chunk missing')))
      .mockImplementationOnce((id) => Promise.resolve({ default: makeStubGameRoot(id) }));
    renderShell();

    openSudoku();
    await flushMicrotasks();
    expect(screen.getByText('The game could not be loaded.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    // Reachable only if resetLazyRoot really dropped the cached wrapper:
    // React caches a rejected lazy() forever, so a retry that reused it would
    // replay the same rejection without the loader ever being asked again.
    await flushMicrotasks();
    expect(screen.getByText('playing sudoku')).toBeInTheDocument();
    expect(screen.getByTestId('entry')).toHaveTextContent('collection');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('the hardware back button while no game is mounted', () => {
  it('during a load: the fallback owns it, then the collection takes it back', async () => {
    let resolveLoad: ((mod: { default: ComponentType<GameRootProps> }) => void) | undefined;
    loader.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );
    renderShell();
    await screen.findByRole('heading', { name: 'Simple Games' });

    openSudoku();
    // The collection's own listener is still registered until its unmount
    // cleanup runs (a promise resolution, App.tsx), and the fallback's is
    // added the moment it mounts — both land in the same commit.
    await flushMicrotasks();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);

    act(() => appMock.fire('backButton', {}));

    expect(collectionHeading()).toBeInTheDocument();
    expect(appMock.App.minimizeApp).not.toHaveBeenCalled();

    await flushMicrotasks();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);

    // Nothing left pending: the chunk resolving after the exit must not
    // throw or resurrect the game.
    await act(async () => {
      resolveLoad?.({ default: makeStubGameRoot('sudoku') });
    });
  });

  it('after a failure: the error screen owns it instead of the OS', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loader.mockImplementation(() => Promise.reject(new Error('chunk missing')));
    renderShell();
    await screen.findByRole('heading', { name: 'Simple Games' });

    openSudoku();
    await flushMicrotasks();
    expect(screen.getByText('The game could not be loaded.')).toBeInTheDocument();
    await flushMicrotasks();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);

    act(() => appMock.fire('backButton', {}));

    expect(collectionHeading()).toBeInTheDocument();
    expect(appMock.App.minimizeApp).not.toHaveBeenCalled();
  });

  it('on the settings screen: it returns to the collection, which then owns back alone', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Simple Games' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    // Same hand-off as leaving a game: the collection's listener is removed
    // by a promise callback, and settings' replacement is added synchronously
    // in the same commit — only after that microtask lands is there one.
    await flushMicrotasks();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);

    act(() => appMock.fire('backButton', {}));

    expect(collectionHeading()).toBeInTheDocument();
    expect(appMock.App.minimizeApp).not.toHaveBeenCalled();

    // The shell removed its own listener on the way out, leaving only the
    // collection's — not two owners quietly stacked on top of each other.
    await flushMicrotasks();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);
  });
});
