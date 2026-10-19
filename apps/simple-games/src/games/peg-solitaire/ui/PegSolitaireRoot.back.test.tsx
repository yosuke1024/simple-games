/**
 * Peg Solitaire as the native build sees it: the Android hardware Back
 * button and the app's `pause` (docs/ARCHITECTURE.md「ハードウェア戻るボタン」,
 * docs/PEG_SOLITAIRE_RULES.md §11). One press leaves the board (or the
 * statistics) for this game's home with the game saved; the next leaves the
 * game for the collection. A board a home-screen shortcut opened is no
 * different — the way in added no screen to undo. `pause` saves like a
 * hidden page does, and unmounting removes every listener the game added.
 *
 * A file of its own because it is the only one that runs as the native
 * build: `Capacitor.isNativePlatform()` decides whether the provider listens
 * at all, and flipping it for PegSolitaireRoot.test.tsx would change what
 * every case there is testing.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { ENGLISH, ENGLISH_PROBLEM, holeIndex } from '../game';
import { PG_STORAGE_KEYS, type PersistedGame } from '../storage/schemas';
import { PegSolitaireRoot } from './PegSolitaireRoot';

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

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PegSolitaireRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit, view };
}

/**
 * One press, after whatever the last screen change set in motion has landed:
 * a replaced listener is removed through a promise (as with the real plugin),
 * and no finger is faster than that.
 */
const pressBack = async () => {
  await settle();
  act(() => appMock.fire('backButton'));
};
const listenerCount = (name: string) => appMock.listeners.get(name)?.size ?? 0;
const savedGame = (): PersistedGame | null => {
  const raw = deviceStore.get(PG_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
};
const hole = (index: number) =>
  screen
    .getByRole('group', { name: /board, \d+ holes$/ })
    .querySelector<HTMLButtonElement>(`[data-hole="${index}"]`)!;

const D2 = holeIndex(ENGLISH, 1, 3);
const D4 = holeIndex(ENGLISH, 3, 3);

function taughtAlready() {
  deviceStore.set(
    PG_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
}

afterEach(async () => {
  cleanup();
  // The unmount books the play clock into the slot; let that save land
  // before the store is wiped (GameContext).
  await settle();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('hardware Back (docs/ARCHITECTURE.md「ハードウェア戻るボタン」)', () => {
  it('leaves the board for the home with the game saved, then leaves the game', async () => {
    taughtAlready();
    const { onExit } = launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    fireEvent.click(hole(D2), { detail: 1 });
    fireEvent.click(hole(D4), { detail: 1 });

    await pressBack();
    await settle();
    expect(screen.getByRole('button', { name: /English.*Resume/ })).toBeInTheDocument();
    expect(savedGame()!.jumps).toEqual([[D2, D4]]);
    expect(onExit).not.toHaveBeenCalled();

    await pressBack();
    expect(onExit).toHaveBeenCalledTimes(1);
    // One owner, the whole time.
    expect(listenerCount('backButton')).toBe(1);
  });

  it('leaves the statistics for the home', async () => {
    taughtAlready();
    const { onExit } = launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    await pressBack();
    expect(screen.getByRole('heading', { level: 1, name: 'Peg Solitaire' })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('leaves a board a shortcut opened for this game’s home, not the collection', async () => {
    taughtAlready();
    deviceStore.set(
      PG_STORAGE_KEYS.game,
      JSON.stringify({
        schemaVersion: 1,
        board: 'english',
        start: ENGLISH_PROBLEM.start,
        target: ENGLISH_PROBLEM.target,
        jumps: [[D2, D4]],
        elapsedSeconds: 0,
        savedAt: 1,
      }),
    );
    const { onExit } = launch('shortcut');
    await settle();
    expect(hole(D4)).toHaveClass('pg-hole-peg');
    await pressBack();
    expect(screen.getByRole('button', { name: /English.*Resume/ })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
    await pressBack();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('the app’s pause, and leaving (docs/GAME_LIFECYCLE.md)', () => {
  it('saves the board on pause, and removes every listener on unmount', async () => {
    taughtAlready();
    const { view } = launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    fireEvent.click(hole(D2), { detail: 1 });
    fireEvent.click(hole(D4), { detail: 1 });
    deviceStore.delete(PG_STORAGE_KEYS.game);

    act(() => appMock.fire('pause'));
    await settle();
    expect(savedGame()!.jumps).toEqual([[D2, D4]]);
    expect(listenerCount('backButton')).toBe(1);
    expect(listenerCount('pause')).toBe(1);

    view.unmount();
    await settle();
    expect(listenerCount('backButton')).toBe(0);
    expect(listenerCount('pause')).toBe(0);
  });
});
