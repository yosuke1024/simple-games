/**
 * Tangram as the native build sees it: the Android hardware Back button and
 * the app's `pause` (docs/ARCHITECTURE.md「ハードウェア戻るボタン」,
 * docs/TANGRAM_RULES.md §8). One press leaves the board (or the statistics,
 * or Quick Rules) for this game's home with the figure saved — a piece in
 * the hand abandoned, saved where it was before it was picked up — and the
 * next leaves the game for the collection. `pause` saves like a hidden page
 * does, and unmounting removes every listener the game added.
 *
 * A file of its own because it is the only one that runs as the native
 * build: `Capacitor.isNativePlatform()` decides whether the provider listens
 * at all, and flipping it for TangramRoot.test.tsx would change what every
 * case there is testing.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createSession, figureById, placePiece } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { TN_STORAGE_KEYS, type PersistedGame } from '../storage/schemas';
import { TangramRoot } from './TangramRoot';

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
      <TangramRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit, view };
}

/** One press, after whatever the last screen change set in motion has landed. */
const pressBack = async () => {
  await settle();
  act(() => appMock.fire('backButton'));
};
const listenerCount = (name: string) => appMock.listeners.get(name)?.size ?? 0;
const savedGame = (): PersistedGame | null => {
  const raw = deviceStore.get(TN_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
};
const piece = (id: string) => document.querySelector<HTMLButtonElement>(`[data-piece="${id}"]`)!;

const square = figureById('square')!;

function taughtAlready() {
  deviceStore.set(
    TN_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
}

/** The square with L1 down where the solution has it. */
function suspendSquare() {
  const session = placePiece(createSession(square), 'L1', {
    ...square.solution.L1,
    pv: square.solution.L1.at,
  })!;
  deviceStore.set(TN_STORAGE_KEYS.game, JSON.stringify(toPersisted(session, 1)));
  return toPersisted(session, 1).pieces.L1;
}

afterEach(async () => {
  cleanup();
  await settle();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('hardware Back (docs/ARCHITECTURE.md「ハードウェア戻るボタン」)', () => {
  it('leaves the board for the home with the figure saved — a piece in the hand where it was', async () => {
    taughtAlready();
    const before = suspendSquare();
    const { onExit } = launch('shortcut');
    await settle();
    expect(piece('L1').getAttribute('aria-label')).toMatch(/on the board$/);

    // L1 carried off the silhouette, still in the hand when Back comes.
    fireEvent.pointerDown(piece('L1'), { pointerId: 1, clientX: 150, clientY: 120 });
    fireEvent.pointerMove(piece('L1'), { pointerId: 1, clientX: 5, clientY: 5 });
    await pressBack();
    await settle();
    expect(screen.getByRole('button', { name: /^Resume/ })).toHaveTextContent('Easy 1');
    expect(savedGame()!.pieces.L1).toEqual(before);
    expect(onExit).not.toHaveBeenCalled();

    // Resumed: the piece stands where it stood, and nothing was recorded.
    fireEvent.click(screen.getByRole('button', { name: /^Resume/ }));
    expect(piece('L1').getAttribute('aria-label')).toMatch(/on the board$/);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await pressBack();
    await pressBack();
    expect(onExit).toHaveBeenCalledTimes(1);
    // One owner, the whole time.
    expect(listenerCount('backButton')).toBe(1);
  });

  it('leaves the statistics and Quick Rules for the home', async () => {
    taughtAlready();
    const { onExit } = launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    await pressBack();
    expect(screen.getByRole('heading', { level: 1, name: 'Tangram' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How to Play' }));
    await pressBack();
    expect(screen.getByRole('heading', { level: 1, name: 'Tangram' })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe('the app’s pause, and leaving (docs/GAME_LIFECYCLE.md)', () => {
  it('saves the figure on pause, and removes every listener on unmount', async () => {
    taughtAlready();
    suspendSquare();
    const { view } = launch('shortcut');
    await settle();
    deviceStore.delete(TN_STORAGE_KEYS.game);

    act(() => appMock.fire('pause'));
    await settle();
    expect(savedGame()!.figure).toBe('square');
    expect(listenerCount('backButton')).toBe(1);
    expect(listenerCount('pause')).toBe(1);

    view.unmount();
    await settle();
    expect(listenerCount('backButton')).toBe(0);
    expect(listenerCount('pause')).toBe(0);
  });
});
