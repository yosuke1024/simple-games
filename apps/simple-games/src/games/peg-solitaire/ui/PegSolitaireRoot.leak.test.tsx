/**
 * The resource-release contract on the game screen itself
 * (docs/GAME_LIFECYCLE.md, docs/PEG_SOLITAIRE_RULES.md §14). The
 * registry-wide sweep in src/test/lifecycle.test.tsx mounts this game with
 * nothing saved, so it only ever reaches Quick Rules. Here the game is
 * unmounted with everything the game screen owns live: the play clock's
 * interval, the window key listener (useGameKeys), the provider's
 * visibilitychange listener, a picked-up peg, a drag in the hand, the
 * result card's beat (ui/useResultReveal.ts) and the card itself. Nothing
 * may survive any of them.
 *
 * Saves go to Capacitor Preferences, mocked as a Map, so nothing here
 * touches the jsdom localStorage the other files share.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import {
  TRIANGLE_APEX_PERFECT_LAST,
  TRIANGLE_APEX_PREFIX,
  TRIANGLE_APEX_SINGLE_LAST,
} from '../game/fixtures';
import { PG_STORAGE_KEYS, type PersistedGame } from '../storage/schemas';
import { PegSolitaireRoot } from './PegSolitaireRoot';

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

/** One real macrotask: whatever jsdom queued with a zero timeout has run. */
const macrotask = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

afterEach(async () => {
  cleanup();
  await settle();
  deviceStore.clear();
});

/** Quick Rules seen, and the Triangle 1 → 1 suspended two jumps from its end. */
function seed() {
  deviceStore.set(
    PG_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  const record: PersistedGame = {
    schemaVersion: 1,
    board: 'triangle',
    start: 0,
    target: 0,
    jumps: TRIANGLE_APEX_PREFIX.map(([from, to]) => [from, to]),
    elapsedSeconds: 0,
    savedAt: 1,
  };
  deviceStore.set(PG_STORAGE_KEYS.game, JSON.stringify(record));
}

/** Straight onto the suspended board, the way a home-screen shortcut opens it. */
async function mount() {
  seed();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PegSolitaireRoot onExit={() => undefined} entry="shortcut" />
    </SettingsProvider>,
  );
  await settle();
  expect(screen.getByRole('group', { name: 'Triangle board, 15 holes' })).toBeInTheDocument();
  return view;
}

const hole = (index: number) =>
  document.querySelector<HTMLButtonElement>(`.pg-board [data-hole="${index}"]`)!;
const tap = (index: number) => fireEvent.click(hole(index), { detail: 1 });

/**
 * Mounts, plays the last jump and unmounts once before tracking: first-use
 * module singletons (the sound service, Capacitor's web shims) belong to the
 * shell's lifetime, not the game's.
 */
async function warmUp() {
  const view = await mount();
  tap(TRIANGLE_APEX_SINGLE_LAST[0]);
  tap(TRIANGLE_APEX_SINGLE_LAST[1]);
  await macrotask();
  view.unmount();
  await settle();
  deviceStore.clear();
}

it('releases the clock, the listeners, a picked-up peg and a drag in the hand', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await mount();
    // A peg picked up by a tap, and another carried past the drag threshold.
    tap(TRIANGLE_APEX_SINGLE_LAST[0]);
    expect(hole(TRIANGLE_APEX_SINGLE_LAST[0])).toHaveAttribute('aria-pressed', 'true');
    const [carried] = TRIANGLE_APEX_PERFECT_LAST;
    fireEvent.pointerDown(hole(carried), { pointerId: 4, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(hole(carried), { pointerId: 4, clientX: 40, clientY: 40 });
    expect(document.querySelector('.pg-float')).not.toBeNull();
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the result card’s beat when the game ends just before it unmounts', async () => {
  // Motion allowed, so the card waits its beat on a live timer.
  const restoreMedia = stubMatchMedia();
  try {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await mount();
      tap(TRIANGLE_APEX_SINGLE_LAST[0]);
      tap(TRIANGLE_APEX_SINGLE_LAST[1]);
      // The game is over and the jump is still sliding in; the card is not
      // up yet — its timer is the thing that must not outlive the game.
      expect(document.querySelector('.pg-peg-arrive')).not.toBeNull();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  } finally {
    restoreMedia();
  }
});

it('releases everything with the result card up', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await mount();
    tap(TRIANGLE_APEX_SINGLE_LAST[0]);
    tap(TRIANGLE_APEX_SINGLE_LAST[1]);
    expect(screen.getByRole('alertdialog', { name: 'One peg left' })).toBeInTheDocument();
    // The card's autofocus has jsdom queue a zero-delay selection timer of
    // its own; that one is jsdom's, so it is let run before the question.
    await macrotask();
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
