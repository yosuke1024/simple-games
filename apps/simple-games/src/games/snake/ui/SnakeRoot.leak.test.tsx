/**
 * The resource-release contract at the board itself (docs/GAME_LIFECYCLE.md,
 * docs/SNAKE_RULES.md §13「描画とループ」): the registry-wide sweep in
 * src/test/lifecycle.test.tsx mounts this game on its Quick Rules and never
 * starts a run, so it never sees the tick. Here the run really moves — on
 * jsdom's real timers, not faked ones, because the question is whether every
 * timer that was set got cleared — and the game is unmounted mid-run, while
 * paused, and on a board still waiting for Start. After each, nothing the
 * game registered may be alive: the chained tick timeout, the window key
 * listener, the document visibility listener.
 *
 * There is no requestAnimationFrame loop and no dev seam in this game to
 * check for; `trackResources` would report a frame left requested all the
 * same.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { SN_STORAGE_KEYS } from '../storage/schemas';
import { SnakeRoot } from './SnakeRoot';

afterEach(cleanup);

const tutorialDone = {
  [SN_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

function mount() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SnakeRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
    </SettingsProvider>,
  );
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const boardState = () =>
  screen.getByRole('img', { name: /^Snake board/ }).getAttribute('aria-label') ?? '';

const headCol = () =>
  Math.floor(Number(document.querySelector('.sn-head-shape')?.getAttribute('x') ?? -1));

const control = (name: string) =>
  within(screen.getByRole('group', { name: 'Controls' })).getByRole('button', { name });

/** Mount, open a board, start it, and let it move for real. */
async function startRun() {
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'New Game' }));
  fireEvent.click(control('Start'));
  // Two Normal ticks and a bit: the chain has set and cleared real timers.
  await wait(350);
  // Without movement this test would be checking an idle board.
  expect(boardState()).toMatch(/moving$/);
  expect(headCol()).toBeGreaterThan(4);
  return view;
}

async function warmUp() {
  // First-use module singletons (the sound service's visibilitychange,
  // Capacitor's web shims) are the shell's lifetime, not the game's.
  const view = await startRun();
  view.unmount();
}

it('stops the tick and drops its listeners when unmounted mid-run', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await startRun();
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('leaves nothing behind when unmounted while paused', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await startRun();
    fireEvent.click(control('Pause'));
    expect(boardState()).toMatch(/paused$/);
    const stopped = headCol();
    await wait(350);
    // Paused means paused: the head has not moved in the real time that passed.
    expect(headCol()).toBe(stopped);
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('leaves nothing behind when unmounted on a board that never started', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'New Game' }));
    expect(boardState()).toMatch(/ready to start$/);
    await wait(200);
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('leaves nothing behind when unmounted on the result card', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await startRun();
    // Straight on into the right-hand wall: nine moves at Normal.
    await wait(1_600);
    expect(await screen.findByRole('alertdialog', { name: 'Game over' })).toBeInTheDocument();
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
