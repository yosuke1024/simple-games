/**
 * GameLoadingFallback (issue #120), pinning two promises from the component's
 * own header comment:
 *
 * - **No flash for a fast load.** Loading a bundled chunk from disk normally
 *   finishes in a frame or two; showing "Loading…" on every open would make
 *   the app feel slower than it is. The text must stay hidden until the load
 *   has genuinely kept the player waiting past SHOW_AFTER_MS, and a load that
 *   finishes before that must leave nothing running behind it — the same
 *   resource-release contract every game answers to (docs/GAME_LIFECYCLE.md,
 *   src/test/lifecycle.test.tsx).
 * - **Hardware back ownership.** The shell hands the hardware back button to
 *   the game once one is mounted, but during a load there is no game to hand
 *   it to (docs/ARCHITECTURE.md「ハードウェア戻るボタン」) — useHardwareBackExit
 *   fills that gap so back does not fall through to the OS and background the
 *   app. Registration is native-only and unregisters cleanly, following the
 *   listener harness in src/games/sudoku/ui/SudokuRoot.back.test.tsx.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { GameLoadingFallback } from './GameLoadingFallback';

const { capacitorMock, appMock } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  return {
    capacitorMock: { native: false },
    appMock: {
      listeners,
      /** Delivers one plugin event to every listener currently registered. */
      fire(name: string) {
        for (const listener of [...(listeners.get(name) ?? [])]) listener({});
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
      },
    },
  };
});

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => capacitorMock.native },
  };
});

vi.mock('@capacitor/app', () => ({ App: appMock.App }));

function renderFallback(onExit: () => void = vi.fn()) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <GameLoadingFallback onExit={onExit} />
    </SettingsProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  capacitorMock.native = false;
  appMock.listeners.clear();
});

describe('the loading text (no flash on a fast load)', () => {
  it('waits out SHOW_AFTER_MS before the text appears', () => {
    vi.useFakeTimers();
    const { container } = renderFallback();

    // The live region is there from the first frame — a screen reader has
    // somewhere to announce into — but empty, so a fast load never speaks.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('never shows the text, and leaves no timer running, for a load that finishes first', () => {
    // Real timers, and no await anywhere between the render and the unmount —
    // that is what keeps this out of a race with the gate rather than merely
    // ahead of it. Fake timers are not the alternative: trackResources
    // reinstalls window.setTimeout as a bound copy (src/test/lifecycle.ts), and
    // a fake installed underneath one loses the property vitest's uninstall
    // looks for, leaving the rest of the file without a setTimeout at all.
    //
    // The awaited version of this test passed only by being quick: 200ms of
    // runner time between the render and the assertion and SHOW_AFTER_MS opens
    // the gate by itself. Measured on a loaded machine that window ran 7–63ms;
    // held past 200ms it fails outright — a wall-clock gate of exactly the kind
    // docs/SUDOKU_RULES.md「予算は仕事量で門にする」refuses (issue #158). A load
    // that "finishes first" is simply the screen being replaced before the gate
    // opens, and unmounting in the same turn as the render is that, exactly.
    const tracker = trackResources();
    try {
      const view = renderFallback();
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

      view.unmount();
      // The pending 200ms timer must have been cancelled on the way out —
      // nothing about a load finishing early may outlive the screen it loaded.
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});

describe('hardware back ownership while a game is loading', () => {
  it('registers exactly one listener on native, calls onExit once, and removes it on unmount', async () => {
    capacitorMock.native = true;
    const onExit = vi.fn();
    const view = renderFallback(onExit);
    await act(async () => undefined);

    expect(appMock.listeners.get('backButton')?.size).toBe(1);

    act(() => appMock.fire('backButton'));
    expect(onExit).toHaveBeenCalledTimes(1);

    view.unmount();
    // The handle is a promise (useHardwareBackExit.ts), so removal lands a
    // microtask after unmount.
    await act(async () => undefined);
    expect(appMock.listeners.get('backButton')?.size).toBe(0);
  });

  it('never registers a listener in the browser, where back is not this screen’s to own', async () => {
    const view = renderFallback();
    await act(async () => undefined);

    expect(appMock.listeners.get('backButton')?.size ?? 0).toBe(0);

    view.unmount();
    await act(async () => undefined);
    expect(appMock.listeners.get('backButton')?.size ?? 0).toBe(0);
  });
});
