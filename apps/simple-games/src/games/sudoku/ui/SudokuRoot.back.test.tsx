/**
 * The Android hardware back button on a board a home-screen shortcut opened
 * directly (issue #113) — the acceptance criterion 「hardware Back で不自然な
 * 履歴を作らない」, asked of the one arrival that did not walk through the
 * game's home to get here.
 *
 * The answer is that nothing about back changes: one press leaves the board
 * for this game's home, the next leaves the game for the collection. The way
 * in added no screen to undo, so there is none to skip either — a shortcut is
 * a door, and a door is not a step in a history.
 *
 * A file of its own because it is the only Sudoku test that runs as the
 * native build: `Capacitor.isNativePlatform()` decides whether the provider
 * registers for `backButton` at all, and flipping that for the whole of
 * SudokuRoot.test.tsx would quietly change what every case in it is testing.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { SD_STORAGE_KEYS } from '../storage/schemas';
import { SudokuRoot } from './SudokuRoot';

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

const settle = () => act(async () => undefined);

function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SudokuRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The one press Android sends; every registered listener hears it. */
const pressBack = () => act(() => appMock.fire('backButton'));

const board = () => screen.queryByRole('group', { name: 'Sudoku grid' });
const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

beforeEach(() => {
  deviceStore.set(
    SD_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
});

afterEach(() => {
  cleanup();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('hardware back after a shortcut opened the board directly', () => {
  it('goes to this game’s home first, and only then out to the collection', async () => {
    const user = userEvent.setup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    const onExit = launch('shortcut');
    await settle();
    expect(board()).toBeInTheDocument();

    pressBack();
    await settle();

    // One step back is the game's home — the same step a board reached by
    // tapping Resume takes, and the collection is not skipped past.
    expect(home()).toBeInTheDocument();
    expect(board()).not.toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();

    pressBack();
    await settle();

    // And the next one leaves the game. Two screens in, two presses out.
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('keeps exactly one owner of the button, as the collection shell expects', async () => {
    const user = userEvent.setup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launch('shortcut');
    await settle();

    // Every Capacitor `backButton` listener fires, so a resumed board that
    // registered a second one would take two screens off the stack per press
    // (docs/ARCHITECTURE.md「コレクションホーム」).
    expect(appMock.listeners.get('backButton')?.size).toBe(1);
  });
});
