/**
 * The resource-release contract on the game screen itself
 * (docs/GAME_LIFECYCLE.md, docs/GEM_SWAP_RULES.md §10). The registry-wide
 * sweep in src/test/lifecycle.test.tsx mounts this game with nothing saved,
 * so it only ever reaches Quick Rules and never sees a replay. Here the game
 * is unmounted with everything the game screen owns live — on jsdom's real
 * timers, because the question is whether every timer that was set got
 * cleared: the play clock's interval, the window key listener (useGameKeys),
 * the provider's visibilitychange listener, a cascade replay's beat timer and
 * the visibility listener it holds while it runs, the result card's beat
 * (ui/useResultReveal.ts) and the card itself. Nothing may survive any of
 * them.
 *
 * Saves go to Capacitor Preferences, mocked as a Map.
 */
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import { ROUND_SWAPS, type Round } from '../game';
import { GS_STORAGE_KEYS } from '../storage/schemas';
import { GemSwapRoot } from './GemSwapRoot';
import { cascadingRound, cell, firstValid, recordOf, roundAfter } from './test-helpers';

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

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

/** Real time passing: whatever jsdom queued for that long has run. */
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

afterEach(async () => {
  cleanup();
  await settle();
  deviceStore.clear();
});

/** Straight onto `round`, suspended, the way a home-screen shortcut opens it. */
async function mount(round: Round) {
  deviceStore.set(
    GS_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  deviceStore.set(GS_STORAGE_KEYS.game, JSON.stringify(recordOf(round)));
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <GemSwapRoot onExit={() => undefined} entry="shortcut" />
    </SettingsProvider>,
  );
  await settle();
  expect(screen.getByRole('group', { name: 'Gem board, 8 by 8' })).toBeInTheDocument();
  return view;
}

const tap = (index: number) => fireEvent.click(cell(index), { detail: 1 });

/**
 * Mounts, plays a cascading swap and unmounts once before tracking:
 * first-use module singletons (the sound service, Capacitor's web shims)
 * belong to the shell's lifetime, not the game's.
 */
async function warmUp() {
  const { round, swap } = cascadingRound(2);
  const view = await mount(round);
  tap(swap[0]);
  tap(swap[1]);
  await wait(20);
  view.unmount();
  await settle();
  deviceStore.clear();
}

/** Runs `body` with motion allowed, so the replay and the card's beat are real timers. */
async function withMotion(body: () => Promise<void>) {
  const restoreMedia = stubMatchMedia();
  try {
    await body();
  } finally {
    restoreMedia();
  }
}

it('releases a cascade replay unmounted mid-beat, with a gem selected and a finger down', async () => {
  await withMotion(async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const { round, swap } = cascadingRound(2);
      const view = await mount(round);
      tap(swap[0]);
      tap(swap[1]);
      // The replay is on: the beat timer and its visibility listener are live.
      expect(document.querySelector('.gs-board-replaying')).not.toBeNull();
      fireEvent.pointerDown(cell(9), { pointerId: 2, clientX: 0, clientY: 0 });
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});

it('releases the clock and the listeners on a still board with a gem selected', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await mount(roundAfter(3));
    tap(10);
    await wait(30);
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the last move’s replay and the card’s beat when the round ends just before unmount', async () => {
  await withMotion(async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const round = roundAfter(ROUND_SWAPS - 1);
      const view = await mount(round);
      const [a, b] = firstValid(round);
      tap(a);
      tap(b);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});

it('releases everything with the result card up', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const round = roundAfter(ROUND_SWAPS - 1);
    const view = await mount(round);
    const [a, b] = firstValid(round);
    tap(a);
    tap(b);
    expect(screen.getByRole('alertdialog', { name: 'Round over' })).toBeInTheDocument();
    // The card's autofocus has jsdom queue a zero-delay selection timer of
    // its own; that one is jsdom's, so it is let run before the question.
    await wait(10);
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
