/**
 * The native-only doors (docs/OVERTAKE_RULES.md §2): Capacitor's `pause` (the
 * app goes to background — it may never get another event before the OS
 * kills it) stops a running race and books its seconds, and `resume` never
 * starts it again; hardware Back on a running race only pauses it — a
 * steering finger can be a swipe from the screen's edge, and one press must
 * not cost the race — and from there, this game's home, then the
 * collection. The listeners are one each, and go with the game.
 *
 * Native is forced the way src/test/tutorialBackWiring.test.tsx forces it;
 * plugin events go to every listener registered, as Capacitor delivers them.
 * The game is a web beta and not in the app yet (§2): this pins the
 * behaviour for the day it is.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d } from '@/test/lifecycle';
import { OT_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { OvertakeRoot } from './OvertakeRoot';
import { layOutCanvas, pump, raceState } from './test-driver';

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

const fire = (name: string) => act(() => appMock.fire(name));

const boardLabel = () =>
  screen.getByRole('img', { name: /^Overtake, level/ }).getAttribute('aria-label') ?? '';

let restores: Array<() => void> = [];

beforeEach(() => {
  restores = [stubCanvas2d(), stubAnimationFrames(), layOutCanvas()];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T09:00:00Z'));
});

afterEach(async () => {
  cleanup();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  for (const restore of restores.reverse()) restore();
  vi.useRealTimers();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

async function launchRunning() {
  deviceStore.set(
    OT_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <OvertakeRoot onExit={onExit} />
    </SettingsProvider>,
  );
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  pump(10);
  vi.setSystemTime(Date.now() + 6_000);
  expect(boardLabel()).toMatch(/running$/);
  return { onExit };
}

describe('native background and Back (§2)', () => {
  it('the app’s `pause` stops the race and books it; `resume` does not start it again', async () => {
    await launchRunning();
    fire('pause');
    await settle();
    expect(boardLabel()).toMatch(/paused$/);
    const stats = JSON.parse(deviceStore.get(OT_STORAGE_KEYS.stats) ?? 'null') as Stats | null;
    expect(stats).toEqual({ schemaVersion: 1, played: 1, totalPlaySeconds: 6 });
    const step = raceState().step;

    fire('resume');
    pump(30);
    expect(boardLabel()).toMatch(/paused$/);
    expect(raceState().step).toBe(step);
  });

  it('Back on a running race only pauses; the next Back is this game’s home, then the collection', async () => {
    const { onExit } = await launchRunning();
    fire('backButton');
    await settle();
    expect(boardLabel()).toMatch(/paused$/);
    expect(onExit).not.toHaveBeenCalled();

    fire('backButton');
    await settle();
    expect(screen.queryByRole('img', { name: /^Overtake, level/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();

    fire('backButton');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('Back from a ready board goes straight to this game’s home', async () => {
    deviceStore.set(
      OT_STORAGE_KEYS.flags,
      JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    );
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <OvertakeRoot onExit={vi.fn()} />
      </SettingsProvider>,
    );
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
    fire('backButton');
    await settle();
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeInTheDocument();
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
