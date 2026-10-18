/**
 * The resource-release contract mid-play (docs/GAME_LIFECYCLE.md). The
 * registry-wide sweep in src/test/lifecycle.test.tsx mounts the game on its
 * home and nowhere else; this one closes it from the places where something
 * is running — the play clock on the board with a drag held and a hint shown,
 * and the beat between the clear and its card (motion allowed, so the reveal
 * timer is really pending). Nothing may survive either.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import {
  BOARD_SIZE,
  createDailySession,
  localDateString,
  slide,
  slideRange,
  solve,
  type Board,
  type Slide,
} from '../game';
import { UB_STORAGE_KEYS } from '../storage/schemas';
import { UnblockPuzzleRoot } from './UnblockPuzzleRoot';

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

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

const tutorialDone = createMemoryKV({
  [UB_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
});

function mount() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <UnblockPuzzleRoot onExit={() => undefined} kv={tutorialDone} />
    </SettingsProvider>,
  );
}

const settle = () => act(async () => undefined);

/** Opens today's daily: the one board a test can know before it is dealt. */
async function openDaily() {
  fireEvent.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
  await settle();
}

/** The cell a tap lands on to slide `move.block` to `move.to`. */
function destinationCell(board: Board, move: Slide): number {
  const block = board.blocks[move.block]!;
  const position = board.positions[move.block]!;
  const end = move.to < position ? move.to : move.to + block.length - 1;
  return block.orientation === 'h' ? block.lane * BOARD_SIZE + end : end * BOARD_SIZE + block.lane;
}

/** On the daily, a hint shown and a drag held — then the game closes. */
async function closeMidDrag() {
  const view = mount();
  await openDaily();
  const grid = document.querySelector('.ub-grid') as HTMLElement;
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 300,
    height: 300,
    right: 300,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
  // A block with room to move, pressed in its first cell and pulled 35px the
  // way it has room. Which way that is belongs to the day's board: on some
  // days' dailies (2027-10-31's) no block has room forward at the start.
  const start = createDailySession(localDateString(new Date())).start;
  const index = start.blocks.findIndex((_, i) => {
    const range = slideRange(start, i);
    return range.max > range.min;
  });
  const shape = start.blocks[index]!;
  const horizontal = shape.orientation === 'h';
  const pull = slideRange(start, index).max > start.positions[index]! ? 35 : -35;
  const x = ((horizontal ? start.positions[index]! : shape.lane) + 0.5) * 50;
  const y = ((horizontal ? shape.lane : start.positions[index]!) + 0.5) * 50;
  const block = document.querySelector(`[data-block="${index}"]`) as HTMLElement;
  fireEvent.pointerDown(block, {
    button: 0,
    pointerId: 1,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
  });
  fireEvent.pointerMove(block, {
    pointerId: 1,
    clientX: horizontal ? x + pull : x,
    clientY: horizontal ? y : y + pull,
  });
  expect(block).toHaveClass('ub-block-dragging');
  view.unmount();
}

it('releases the play clock and a held drag when closed mid-board', async () => {
  // Warm-up through the same path: first-use singletons — the shell's sound
  // and Capacitor shims, and the test DOM's own selector engine — are not
  // the game's to release.
  await closeMidDrag();
  await settle();

  const tracker = trackResources();
  try {
    await closeMidDrag();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

/** The daily solved through the tap path, then closed before the card arrives. */
async function closeDuringBeat() {
  const view = mount();
  await openDaily();
  const daily = createDailySession(localDateString(new Date()));
  const result = solve(daily.start, 6000);
  if (result.status !== 'solved') throw new Error('a dealt board must solve');
  let board = daily.start;
  for (const move of result.solution) {
    const button = document.querySelector(`[data-block="${move.block}"]`) as HTMLElement;
    if (button.getAttribute('aria-pressed') !== 'true') fireEvent.click(button, { detail: 1 });
    const cell = document.querySelector(
      `[data-cell="${destinationCell(board, move)}"]`,
    ) as HTMLElement;
    fireEvent.click(cell, { detail: 1 });
    board = slide(board, move)!;
  }
  await settle();
  // Solved, and the card is still waiting for its beat.
  expect(document.querySelector('.ub-board-solved')).not.toBeNull();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  view.unmount();
}

it('releases the beat before the result card when closed during it', async () => {
  // Motion allowed (jsdom has no matchMedia, which reads as "reduce"), so the
  // reveal timer is really pending when the game closes.
  const restoreMedia = stubMatchMedia();
  try {
    await closeDuringBeat();
    await settle();
    const tracker = trackResources();
    try {
      await closeDuringBeat();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  } finally {
    restoreMedia();
  }
});
