/**
 * The hardware Back button and the native pause, on Android (docs/BRIDGES_RULES.md
 * §10, docs/ARCHITECTURE.md「ハードウェア戻るボタン」): the game context is
 * their only owner. Back leaves a sub-screen for the game's home — saving the
 * board on the way — and from the home hands control to the collection;
 * pause saves like any background. Nothing is left listening after unmount.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { BG_STORAGE_KEYS } from '../storage/schemas';
import { BridgesRoot } from './BridgesRoot';

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
      count(name: string) {
        return listeners.get(name)?.size ?? 0;
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
    await new Promise((resolve) => setTimeout(resolve, 25));
  });

function launch() {
  const onExit = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BridgesRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return { onExit, view };
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('hardware Back (Android)', () => {
  it('leaves the board for the home, saving it, and leaves the home for the collection', async () => {
    const user = userEvent.setup();
    deviceStore.set(
      BG_STORAGE_KEYS.flags,
      JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    );
    const { onExit } = launch();
    await settle();
    expect(appMock.count('backButton')).toBe(1);

    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    expect(screen.getByRole('group', { name: /^Bridges board/ })).toBeInTheDocument();
    act(() => appMock.fire('backButton'));
    await settle();
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.game)!).mode).toBe('difficulty');

    // Still one owner after the screen changed, and Back from the home leaves.
    expect(appMock.count('backButton')).toBe(1);
    act(() => appMock.fire('backButton'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('leaves statistics for the home', async () => {
    const user = userEvent.setup();
    deviceStore.set(
      BG_STORAGE_KEYS.flags,
      JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    );
    const { onExit } = launch();
    await settle();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    act(() => appMock.fire('backButton'));
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Easy/ })).toBeInTheDocument();
  });

  it('saves on pause, and lets go of every listener on unmount', async () => {
    const user = userEvent.setup();
    deviceStore.set(
      BG_STORAGE_KEYS.flags,
      JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    );
    const { view } = launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    deviceStore.delete(BG_STORAGE_KEYS.dailyGame);
    act(() => appMock.fire('pause'));
    await settle();
    expect(JSON.parse(deviceStore.get(BG_STORAGE_KEYS.dailyGame)!).mode).toBe('daily');

    view.unmount();
    await settle();
    expect(appMock.count('backButton')).toBe(0);
    expect(appMock.count('pause')).toBe(0);
  });
});
