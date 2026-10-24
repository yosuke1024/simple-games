/**
 * The resource-release contract at the board itself (docs/GAME_LIFECYCLE.md,
 * docs/OVERTAKE_RULES.md §11「描画とループ」): the registry-wide sweep in
 * src/test/lifecycle.test.tsx mounts this game on its Quick Rules and never
 * reaches the board — jsdom's canvas has no 2D context, and the board stops
 * at its canvas guard. Here the context is stubbed, so the loop really runs,
 * on jsdom's real animation frames (the question is whether every frame
 * that was requested got cancelled), and the game is unmounted while the
 * race runs, while it is paused, on a board still waiting in `ready`, and
 * on the result card. After each, nothing the game registered may be alive:
 * the animation frame, the key / visibility / blur / resize listeners, the
 * ResizeObserver, the result beat's timer, and the dev seams `__otFrame` /
 * `__otState`.
 *
 * jsdom has no ResizeObserver; a stand-in that counts the live ones is
 * installed for these tests, so the board takes its observer path.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  stubAnimationFrames,
  stubCanvas2d,
  stubMatchMedia,
  trackResources,
} from '@/test/lifecycle';
import { OT_STORAGE_KEYS } from '../storage/schemas';
import { OvertakeRoot } from './OvertakeRoot';
import { canvasEl, driveToFinish, layOutCanvas, raceState } from './test-driver';

const tutorialDone = {
  [OT_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** Live ResizeObservers: observing and not yet disconnected. */
const liveObservers = new Set<object>();

class CountingResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {
    liveObservers.add(this);
  }
  unobserve() {}
  disconnect() {
    liveObservers.delete(this);
  }
}

let restores: Array<() => void> = [];

beforeEach(() => {
  liveObservers.clear();
  const original = (window as { ResizeObserver?: unknown }).ResizeObserver;
  (window as { ResizeObserver?: unknown }).ResizeObserver = CountingResizeObserver;
  restores = [
    stubCanvas2d(),
    stubMatchMedia(),
    layOutCanvas(),
    () => {
      (window as { ResizeObserver?: unknown }).ResizeObserver = original;
    },
  ];
});

afterEach(() => {
  cleanup();
  for (const restore of restores.reverse()) restore();
});

function mount() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <OvertakeRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
    </SettingsProvider>,
  );
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const seamsPresent = () => '__otFrame' in window || '__otState' in window;

/** Mount, open Level 1, start it with a press, and let jsdom's real frames move it. */
async function startRace() {
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Level 1' }));
  // The seam appears only past the canvas guard — without it this would be
  // testing an idle board.
  expect(seamsPresent()).toBe(true);
  // The board's and the progress strip's (it spreads its rings by the track's width).
  expect(liveObservers.size).toBe(2);
  fireEvent.pointerDown(canvasEl(), { pointerId: 1, clientX: 180, clientY: 400, button: 0 });
  await wait(120);
  expect(raceState().step).toBeGreaterThan(0);
  return view;
}

async function warmUp() {
  // First-use module singletons (the sound service's visibilitychange,
  // Capacitor's web shims) are the shell's lifetime, not the game's.
  const view = await startRace();
  view.unmount();
}

function expectAllReleased(tracker: ReturnType<typeof trackResources>) {
  tracker.assertReleased();
  expect(liveObservers.size).toBe(0);
  // The seams hold the whole frame closure: they go with the board.
  expect(seamsPresent()).toBe(false);
}

it('releases everything when unmounted mid-race', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await startRace();
    view.unmount();
    expectAllReleased(tracker);
  } finally {
    tracker.restore();
  }
});

it('releases everything when unmounted while paused — and a paused race asks for no frame', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await startRace();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    const step = raceState().step;
    await wait(120);
    expect(raceState().step).toBe(step);
    view.unmount();
    expectAllReleased(tracker);
  } finally {
    tracker.restore();
  }
});

it('releases everything when unmounted on a board still waiting in ready', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Level 1' }));
    expect(seamsPresent()).toBe(true);
    await wait(80);
    expect(raceState().step).toBe(0);
    view.unmount();
    expectAllReleased(tracker);
  } finally {
    tracker.restore();
  }
});

it('releases everything when unmounted on the result card, and during the beat before it', async () => {
  await warmUp();
  const restoreFrames = stubAnimationFrames();
  const tracker = trackResources();
  try {
    // During the 900 ms beat (matchMedia says no Reduced Motion): the reveal's
    // timer is pending, and the unmount must clear it.
    const first = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Level 1' }));
    driveToFinish();
    expect(raceState().status).toBe('finished');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    first.unmount();
    expectAllReleased(tracker);

    // And on the card itself.
    const second = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Level 1' }));
    driveToFinish();
    expect(await screen.findByRole('alertdialog', {}, { timeout: 2_000 })).toBeInTheDocument();
    second.unmount();
    expectAllReleased(tracker);
  } finally {
    tracker.restore();
    restoreFrames();
  }
});
