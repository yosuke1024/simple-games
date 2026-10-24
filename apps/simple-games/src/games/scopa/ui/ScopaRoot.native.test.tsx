/**
 * The native background path (docs/SCOPA_RULES.md §4.2, §8): Capacitor's
 * `pause` / `resume` move the same visibility flag as `visibilitychange`, and
 * everything that runs on time — the CPU's beat and the play clock — stops on
 * either. Here a `pause` arrives with the document still reporting `visible`
 * (jsdom never changes it), the case a check of `document.visibilityState`
 * alone would miss.
 *
 * Its own file because it mocks `@capacitor/core` as native for the whole
 * module; ui/ScopaRoot.test.tsx runs as the web.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { isCpuTurn } from '../game';
import { CPU_DELAY_MS } from '../state/GameContext';
import { toPersisted } from '../storage/gamePersistence';
import { SC_STORAGE_KEYS, type SavedMatch, type Stats } from '../storage/schemas';
import { ScopaRoot } from './ScopaRoot';
import { findPosition } from './testScenarios';

type Listener = () => void;

const { deviceStore, appMock } = vi.hoisted(() => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    deviceStore: new Map<string, string>(),
    appMock: {
      listeners,
      /** Delivers one plugin event to every listener currently registered. */
      fire(name: string) {
        for (const listener of [...(listeners.get(name) ?? [])]) listener();
      },
      App: {
        addListener: (name: string, listener: Listener) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name)!.add(listener);
          return Promise.resolve({
            remove: () => {
              listeners.get(name)?.delete(listener);
              return Promise.resolve();
            },
          });
        },
      },
    },
  };
});

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return { ...actual, Capacitor: { ...actual.Capacitor, isNativePlatform: () => true } };
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

/** The CPU's card is owed. */
const CPU_TO_PLAY = findPosition((s) => isCpuTurn(s) && s.deal.plays.length > 0);

const settle = () => act(async () => undefined);
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const storedSave = (): SavedMatch | null => {
  const raw = deviceStore.get(SC_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as SavedMatch);
};
const storedStats = (): Stats | null => {
  const raw = deviceStore.get(SC_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
};

afterEach(async () => {
  cleanup();
  await act(async () => undefined);
  vi.useRealTimers();
  appMock.listeners.clear();
  deviceStore.clear();
});

describe('a native pause with no visibilitychange (§4.2, §8)', () => {
  it('stops the CPU’s beat and the play clock alike, and books only the seconds in view', async () => {
    deviceStore.set(
      SC_STORAGE_KEYS.flags,
      JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    );
    deviceStore.set(SC_STORAGE_KEYS.game, JSON.stringify(toPersisted(CPU_TO_PLAY, 1)));
    vi.useFakeTimers();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <ScopaRoot onExit={vi.fn()} />
      </SettingsProvider>,
    );
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    expect(document.visibilityState).toBe('visible');

    act(() => appMock.fire('pause'));
    await advance(5_000);
    await settle();
    // Nothing moved while paused: no CPU card, and no seconds on the clock.
    expect(storedSave()?.moveCount).toBe(CPU_TO_PLAY.moveCount);
    expect(storedSave()?.elapsedSeconds).toBe(0);

    act(() => appMock.fire('resume'));
    await advance(CPU_DELAY_MS);
    await settle();
    expect(storedSave()?.moveCount).toBe(CPU_TO_PLAY.moveCount + 1);
    await advance(2_000 - CPU_DELAY_MS);

    // Leaving books what was played in view: two seconds, not seven.
    cleanup();
    await settle();
    expect(storedStats()?.totalPlaySeconds).toBe(2);
  });
});
