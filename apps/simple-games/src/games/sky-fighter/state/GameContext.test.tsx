/**
 * The board books play seconds and reports the run's end in the same tick
 * (components/SkyBoard.tsx `settle`). Both go through `persistStats`, and both
 * start from `statsRef.current` — so if that ref only caught up on the next
 * render, the second write would carry pre-flush stats and silently undo the
 * first (docs/SKY_FIGHTER_RULES.md §9).
 *
 * Sky Fighter takes that second write on *every* ending, cleared or not,
 * because the score is recorded either way.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { statsSchema, type Stats } from '../storage/schemas';
import { SkyProvider, useSkyFighter, type SkyContextValue } from './GameContext';

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
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

function mount() {
  let api!: SkyContextValue;
  function Probe() {
    api = useSkyFighter();
    return null;
  }
  render(
    <SkyProvider
      initialStats={statsSchema.defaultValue()}
      initialFlags={{ schemaVersion: 1, tutorialCompleted: true }}
      initialProgress={{ schemaVersion: 1, highestUnlocked: 3 }}
      onExit={vi.fn()}
    >
      <Probe />
    </SkyProvider>,
  );
  return () => api;
}

/** What actually survives on disk — the record the next launch will read. */
function storedStats(): Stats | null {
  const raw = deviceStore.get(statsSchema.key);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

const settle = () => act(async () => undefined);

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('a run ending in one tick (§9)', () => {
  it('keeps the final seconds, the clear, and the score', async () => {
    const api = mount();
    act(() => api().startLevel(2));

    act(() => {
      api().bookPlaySeconds(44);
      api().reportRunEnd('cleared', 1200);
    });
    await settle();

    expect(storedStats()).toMatchObject({ cleared: 1, bestScore: 1200, totalPlaySeconds: 44 });
    expect(api().stats.totalPlaySeconds).toBe(44);
  });

  it('keeps the final seconds and the score when the run is lost', async () => {
    const api = mount();
    act(() => api().startLevel(1));

    // The points were scored whether or not the last wave fell (§9).
    act(() => {
      api().bookPlaySeconds(20);
      api().reportRunEnd('failed', 640);
    });
    await settle();

    expect(storedStats()).toMatchObject({ cleared: 0, bestScore: 640, totalPlaySeconds: 20 });
  });

  it('does not lower a best score a weaker run failed to beat', async () => {
    const api = mount();
    act(() => api().startLevel(1));
    act(() => api().reportRunEnd('failed', 900));
    await settle();
    act(() => api().retryLevel());
    act(() => api().reportRunEnd('failed', 100));
    await settle();

    expect(api().stats.bestScore).toBe(900);
    expect(api().lastResult).toMatchObject({ isNewBestScore: false, bestScore: 900 });
  });
});
