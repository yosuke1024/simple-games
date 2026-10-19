/**
 * The Android hardware back button (docs/ARCHITECTURE.md「ハードウェア戻るボタン」).
 * GameContext is its one owner: from the board, Back saves the game and goes
 * to this game's home — the board stays resumable, nothing is lost, nothing
 * keeps running — and from the home it hands control back to the collection.
 * The same holds for a board a home-screen shortcut opened directly (issue
 * #113): the way in added no screen to undo.
 *
 * A file of its own because it runs as the native build:
 * `Capacitor.isNativePlatform()` decides whether the provider registers for
 * `backButton` (and `pause`) at all, and flipping that for the whole of
 * LoopPuzzleRoot.test.tsx would quietly change what every case in it tests.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { LP_STORAGE_KEYS, type PersistedGame } from '../storage/schemas';
import { LoopPuzzleRoot } from './LoopPuzzleRoot';

const { deviceStore, appMock } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  return {
    deviceStore: new Map<string, string>(),
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
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' },
  };
});

vi.mock('@capacitor/app', () => ({ App: appMock.App }));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

/** Lets the async loads and saves land (they are promises; a macrotask covers the KV queue). */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <LoopPuzzleRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit, view };
}

/** The one press Android sends; every registered listener hears it. */
const pressBack = () => act(() => appMock.fire('backButton'));

const board = () => screen.queryByRole('group', { name: /Loop Puzzle board/ });
const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

beforeEach(() => {
  deviceStore.set(
    LP_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
});

afterEach(async () => {
  cleanup();
  // Unmounting saves: the provider runs its leave sync on the way out
  // (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and saves are
  // fire-and-forget. Let them land before wiping the store, or the next test
  // launches onto a game it never played.
  await act(async () => undefined);
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('hardware back', () => {
  it('leaves the board for the game’s home with the board saved, then leaves the game', async () => {
    const user = userEvent.setup();
    const { onExit } = launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await user.click(board()!.querySelector<HTMLButtonElement>('button[data-edge="0"]')!);

    pressBack();
    await settle();
    expect(board()).not.toBeInTheDocument();
    expect(home()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    const saved = JSON.parse(deviceStore.get(LP_STORAGE_KEYS.game)!) as PersistedGame;
    expect(saved.marks[0]).toBe('L');
    expect(onExit).not.toHaveBeenCalled();

    pressBack();
    await settle();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('closes the statistics screen to the home, not out of the game', async () => {
    const user = userEvent.setup();
    const { onExit } = launch();
    await settle();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    pressBack();
    await settle();
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('goes home first from a board a shortcut opened, with one owner of the button', async () => {
    const user = userEvent.setup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();
    appMock.listeners.clear();

    const { onExit } = launch('shortcut');
    await settle();
    expect(board()).toBeInTheDocument();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);

    pressBack();
    await settle();
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
    pressBack();
    await settle();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('lets go of the button and the pause listener when the game unmounts', async () => {
    const { view } = launch();
    await settle();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);
    expect(appMock.listeners.get('pause')?.size).toBe(1);
    view.unmount();
    await settle();
    expect(appMock.listeners.get('backButton')?.size ?? 0).toBe(0);
    expect(appMock.listeners.get('pause')?.size ?? 0).toBe(0);
  });

  it('saves the board when the native app pauses', async () => {
    const user = userEvent.setup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    deviceStore.delete(LP_STORAGE_KEYS.dailyGame);
    act(() => appMock.fire('pause'));
    await settle();
    expect(deviceStore.has(LP_STORAGE_KEYS.dailyGame)).toBe(true);
    // Paused, not left: the board is still on screen, and nothing moved on it.
    expect(board()).toBeInTheDocument();
  });
});
