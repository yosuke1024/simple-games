/**
 * The two native-only doors out of a running board (docs/SNAKE_RULES.md §6,
 * §11): Capacitor's `pause` (the app goes to background — it may never get
 * another event before the OS kills it) and the hardware Back button. Both
 * must stop the snake and write the run; neither may let it move again on
 * its own. Coming back to the foreground (`resume`) changes nothing.
 *
 * Native is forced the way src/test/tutorialBackWiring.test.tsx forces it,
 * and the plugin events are delivered to every listener registered, as
 * Capacitor does.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { TICK_MS } from '../game';
import { SN_STORAGE_KEYS, type PersistedGame } from '../storage/schemas';
import { SnakeRoot } from './SnakeRoot';

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

async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const fire = (name: string) => act(() => appMock.fire(name));

const boardState = () =>
  screen.getByRole('img', { name: /^Snake board/ }).getAttribute('aria-label') ?? '';

function headCol(): number {
  return Math.floor(Number(document.querySelector('.sn-head-shape')!.getAttribute('x')));
}

function storedRun(): PersistedGame | null {
  const raw = deviceStore.get(SN_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
}

async function launchRunning() {
  deviceStore.set(
    SN_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SnakeRoot onExit={onExit} />
    </SettingsProvider>,
  );
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
  const controls = screen.getByRole('group', { name: 'Controls' });
  fireEvent.click(within(controls).getByRole('button', { name: 'Start' }));
  advance(TICK_MS.normal * 2);
  return { onExit };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  cleanup();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  vi.useRealTimers();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('native background and Back (§6, §11)', () => {
  it('the app’s `pause` stops and saves a moving run; `resume` does not restart it', async () => {
    await launchRunning();
    expect(boardState()).toMatch(/moving$/);
    fire('pause');
    await settle();
    expect(boardState()).toMatch(/paused$/);
    expect(storedRun()).toMatchObject({ ticks: 2 });
    const stopped = headCol();

    fire('resume');
    advance(TICK_MS.normal * 6);
    expect(boardState()).toMatch(/paused$/);
    expect(headCol()).toBe(stopped);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hardware Back from the board saves the run and lands on this game’s home', async () => {
    const { onExit } = await launchRunning();
    fire('backButton');
    await settle();
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(storedRun()).toMatchObject({ ticks: 2 });
    // Nothing moves behind the home.
    advance(TICK_MS.normal * 6);
    expect(vi.getTimerCount()).toBe(0);

    // And from the home, Back is the collection's.
    fire('backButton');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('holds exactly one Back listener and one pause listener, and lets both go on unmount', async () => {
    await launchRunning();
    expect(appMock.count('backButton')).toBe(1);
    expect(appMock.count('pause')).toBe(1);
    cleanup();
    await settle();
    expect(appMock.count('backButton')).toBe(0);
    expect(appMock.count('pause')).toBe(0);
  });
});
