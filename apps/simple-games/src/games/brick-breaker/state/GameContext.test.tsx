/**
 * The board books play seconds and reports the run's end in the same tick
 * (components/BrickBoard.tsx `settle`). Both go through `persistStats`, and
 * both start from `statsRef.current` — so if that ref only caught up on the
 * next render, the second write would carry pre-flush stats and silently undo
 * the first (docs/BRICK_BREAKER_RULES.md §9).
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { statsSchema, type Stats } from '../storage/schemas';
import { BrickProvider, useBrickBreaker, type BrickContextValue } from './GameContext';

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
  let api!: BrickContextValue;
  function Probe() {
    api = useBrickBreaker();
    return null;
  }
  render(
    <BrickProvider
      initialStats={statsSchema.defaultValue()}
      initialFlags={{ schemaVersion: 1, tutorialCompleted: true }}
      initialProgress={{ schemaVersion: 1, highestUnlocked: 3 }}
      onExit={vi.fn()}
    >
      <Probe />
    </BrickProvider>,
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
  it('keeps both the final seconds and the clear', async () => {
    const api = mount();
    act(() => api().startLevel(2));

    // Exactly what the board does when the last brick falls.
    act(() => {
      api().bookPlaySeconds(37);
      api().reportRunEnd('cleared', 37);
    });
    await settle();

    expect(storedStats()).toMatchObject({ cleared: 1, totalPlaySeconds: 37 });
    expect(api().stats.totalPlaySeconds).toBe(37);
    expect(api().stats.cleared).toBe(1);
  });

  it('keeps the final seconds when the run is lost', async () => {
    const api = mount();
    act(() => api().startLevel(1));

    act(() => {
      api().bookPlaySeconds(12);
      api().reportRunEnd('failed', 12);
    });
    await settle();

    expect(storedStats()).toMatchObject({ cleared: 0, totalPlaySeconds: 12 });
  });

  it('counts a cleared level once and unlocks the next one', async () => {
    const api = mount();
    act(() => api().startLevel(3));
    act(() => {
      api().bookPlaySeconds(5);
      api().reportRunEnd('cleared', 5);
    });
    await settle();

    expect(api().progress.highestUnlocked).toBe(4);
    expect(api().stats.played).toBe(1);
    expect(api().stats.cleared).toBe(1);
  });
});
