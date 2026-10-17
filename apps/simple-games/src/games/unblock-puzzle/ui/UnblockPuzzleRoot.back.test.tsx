/**
 * The Android hardware Back button, which only the game's own provider
 * answers (docs/ARCHITECTURE.md「ハードウェア戻るボタン」,
 * src/test/gameBackButtonWiring.test.ts). Native is forced here so a jsdom
 * test can fire the same event the button sends: Back leaves a sub-screen
 * for the game's home — saving the board on the way — and from the home it
 * hands control back to the collection. One listener, whatever screen it is
 * pressed on.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { UB_STORAGE_KEYS } from '../storage/schemas';
import { UnblockPuzzleRoot } from './UnblockPuzzleRoot';

const { deviceStore, appMock } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  return {
    deviceStore: new Map<string, string>(),
    appMock: {
      listeners,
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
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

const pressBack = () => act(() => appMock.fire('backButton'));

async function launch() {
  deviceStore.set(
    UB_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <UnblockPuzzleRoot onExit={onExit} />
    </SettingsProvider>,
  );
  await settle();
  return onExit;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('hardware Back', () => {
  it('leaves the board for the game’s home, keeping it, then leaves the game', async () => {
    const user = userEvent.setup();
    const onExit = await launch();
    await user.click(screen.getByRole('button', { name: /^Medium/ }));
    await settle();
    expect(screen.getByRole('group', { name: /^Board, 6 by 6/ })).toBeInTheDocument();

    pressBack();
    await settle();
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: /^Board, 6 by 6/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Medium.*Resume/ })).toBeInTheDocument();
    expect(deviceStore.get(UB_STORAGE_KEYS.game)).toBeDefined();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);

    pressBack();
    await settle();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('leaves the statistics and the Quick Rules for the home', async () => {
    const user = userEvent.setup();
    const onExit = await launch();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    pressBack();
    await settle();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'How to Play' }));
    pressBack();
    await settle();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);
  });

  it('releases its listeners when the game closes', async () => {
    await launch();
    expect(appMock.listeners.get('backButton')?.size).toBe(1);
    cleanup();
    await settle();
    expect(appMock.listeners.get('backButton')?.size ?? 0).toBe(0);
    expect(appMock.listeners.get('pause')?.size ?? 0).toBe(0);
  });
});
