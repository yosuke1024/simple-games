/**
 * The native-only doors (docs/BOUNCE_UP_RULES.md §4「止まるとき」): Capacitor's
 * `pause` (the app goes to background — it may never get another event before
 * the OS kills it) stops a running run and books its seconds and height, and
 * `resume` never starts it again; hardware Back on a running run only pauses
 * it — a sideways drag can be a swipe from the screen's edge, and one press
 * must not cost the run — and from there, this game's home, then the
 * collection. The listeners are one each, and go with the game.
 *
 * Native is forced the way src/test/tutorialBackWiring.test.tsx forces it;
 * plugin events go to every listener registered, as Capacitor delivers them.
 * The game is a web beta and not in the app (§4: hardware Back is
 * native-only, after release): this pins the behaviour for the day it is.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d } from '@/test/lifecycle';
import { BO_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { BounceUpRoot } from './BounceUpRoot';
import { holdEntropy, layOutCanvas, pump, runState } from './test-driver';

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
  screen.getByRole('img', { name: /^Bounce Up board/ }).getAttribute('aria-label') ?? '';

let restores: Array<() => void> = [];

beforeEach(() => {
  // The tower is a function of the seed, and the provider's seed is `Date.now`
  // and `Math.random` (state/GameContext.tsx `freshSeed`): with the second
  // loose, a few seeds in a hundred put a platform within reach of the first 60
  // steps and the booked height is 16 or 18, not 15 — no clock is involved. The test-driver's convention is to
  // hold both (BounceUpRoot.test.tsx does).
  restores = [stubCanvas2d(), stubAnimationFrames(), layOutCanvas(), holdEntropy()];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T09:00:00Z'));
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

function mountRoot(onExit = vi.fn()) {
  deviceStore.set(
    BO_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BounceUpRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

async function launchRunning() {
  const onExit = mountRoot();
  await settle();
  fireEvent.click(screen.getByRole('button', { name: /^Start Climbing/ }));
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  pump(60);
  vi.setSystemTime(Date.now() + 6_000);
  expect(boardLabel()).toMatch(/climbing$/);
  return { onExit };
}

describe('native background and Back (§4)', () => {
  it('the app’s `pause` stops the run and books it; `resume` does not start it again', async () => {
    await launchRunning();
    fire('pause');
    await settle();
    expect(boardLabel()).toMatch(/paused$/);
    const stats = JSON.parse(deviceStore.get(BO_STORAGE_KEYS.stats) ?? 'null') as Stats | null;
    // 60 steps up from the floor: past the apex of the first bounce, 15 points.
    expect(stats).toEqual({
      schemaVersion: 1,
      played: 1,
      best: { normal: 15, wide: 0 },
      total: { normal: 15, wide: 0 },
      totalPlaySeconds: 6,
    });
    const tick = runState().tick;

    fire('resume');
    pump(30);
    expect(boardLabel()).toMatch(/paused$/);
    expect(runState().tick).toBe(tick);
  });

  it('Back on a running run only pauses; the next Back is this game’s home, then the collection', async () => {
    const { onExit } = await launchRunning();
    fire('backButton');
    await settle();
    expect(boardLabel()).toMatch(/paused$/);
    expect(onExit).not.toHaveBeenCalled();

    fire('backButton');
    await settle();
    expect(screen.queryByRole('img', { name: /^Bounce Up board/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Start Climbing/ })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();

    fire('backButton');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('Back from a ready board goes straight to this game’s home', async () => {
    mountRoot();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /^Start Climbing/ }));
    fire('backButton');
    await settle();
    expect(screen.getByRole('button', { name: /^Start Climbing/ })).toBeInTheDocument();
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
