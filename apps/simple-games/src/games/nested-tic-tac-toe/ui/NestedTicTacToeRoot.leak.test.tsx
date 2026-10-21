/**
 * The resource-release contract on the game screen itself
 * (docs/GAME_LIFECYCLE.md, docs/NESTED_TIC_TAC_TOE_RULES.md §13). The
 * registry-wide sweep in src/test/lifecycle.test.tsx mounts this game with
 * nothing saved and unmounts it on the home, so neither of this game's
 * timers is armed when it looks. Here the game is unmounted with each of them
 * live: the CPU's one timer in its 450ms beat (§4), and the result card's
 * beat (ui/useResultReveal.ts, §10) — plus the play clock's interval, the
 * window key listener (useGameKeys) and the provider's visibilitychange
 * listener. Nothing may survive any of them.
 *
 * Saves go to Capacitor Preferences, mocked as a Map.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import { NT_STORAGE_KEYS } from '../storage/schemas';
import { NestedTicTacToeRoot } from './NestedTicTacToeRoot';
import { playerWinsWith, savedRecord } from './testPositions';

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

const win = playerWinsWith();

/** Quick Rules seen, and `moves` suspended. */
function seed(moves: readonly number[]) {
  deviceStore.set(
    NT_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  deviceStore.set(NT_STORAGE_KEYS.saveGame, savedRecord(moves));
}

/** Straight onto the suspended board, the way a home-screen shortcut opens it. */
async function mount(moves: readonly number[]) {
  seed(moves);
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NestedTicTacToeRoot onExit={() => undefined} entry="shortcut" />
    </SettingsProvider>,
  );
  await settle();
  expect(screen.getByRole('group', { name: /Nested Tic-Tac-Toe board/ })).toBeInTheDocument();
  return view;
}

const cell = (index: number) =>
  document.querySelector<HTMLButtonElement>(`.nt-cell[data-cell="${index}"]`)!;

/**
 * Mounts, finishes a match and unmounts once before tracking: first-use
 * module singletons (the sound service, Capacitor's web shims) belong to the
 * shell's lifetime, not the game's.
 */
async function warmUp() {
  const view = await mount(win.moves);
  fireEvent.click(cell(win.cell));
  await macrotask();
  view.unmount();
  await settle();
  deviceStore.clear();
}

it('releases the CPU’s timer when the game goes away in the middle of its beat', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    // One move in, and the CPU to answer it: its one timer is armed now.
    const view = await mount([40]);
    expect(document.querySelector('.nt-turn-line')).toHaveTextContent('CPU’s turn');
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the CPU’s timer armed by the player’s own move', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await mount([40, 36]);
    fireEvent.click(cell(4));
    expect(document.querySelector('.nt-turn-line')).toHaveTextContent('CPU’s turn');
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the result card’s beat when the match ends just before it unmounts', async () => {
  // Motion allowed, so the card waits its beat on a live timer.
  const restoreMedia = stubMatchMedia();
  try {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await mount(win.moves);
      fireEvent.click(cell(win.cell));
      // The match is over and the card is not up yet: its timer is the thing
      // that must not outlive the game.
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(document.querySelector('.game-content')).toHaveAttribute('inert');
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
    const view = await mount(win.moves);
    fireEvent.click(cell(win.cell));
    expect(screen.getByRole('alertdialog', { name: 'You win' })).toBeInTheDocument();
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
