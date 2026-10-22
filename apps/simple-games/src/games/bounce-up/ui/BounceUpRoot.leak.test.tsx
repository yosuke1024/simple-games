/**
 * The resource-release contract at the board itself (docs/GAME_LIFECYCLE.md,
 * docs/BOUNCE_UP_RULES.md §7): the registry-wide sweep in
 * src/test/lifecycle.test.tsx mounts this game on its Quick Rules and never
 * reaches the board — jsdom's canvas has no 2D context, and the board stops
 * at its canvas guard. Here the context is stubbed, so the loop really runs,
 * and the game is unmounted while the run climbs, while it is paused, on a
 * board still waiting in `ready`, and on the result card. After each, nothing
 * the game registered may be alive: the animation frame, the key / visibility
 * / blur / resize listeners, the ResizeObserver, the result beat's timer, and
 * the dev seams `__boFrame` / `__boState`.
 *
 * The frames are a queue this file runs by hand (`queueAnimationFrames`): the
 * board still requests and cancels every frame through the real API, and the
 * frames it gets do run — the question is whether every frame that was
 * requested got cancelled — but no test waits on jsdom's 16 ms timer, which
 * under a loaded machine need not fire twice in any given stretch. The clock
 * and the entropy are held, so the towers are the same on every run.
 *
 * jsdom has no ResizeObserver; a stand-in that counts the live ones is
 * installed for these tests, so the board takes its observer path.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubCanvas2d, stubMatchMedia, trackResources } from '@/test/lifecycle';
import { BO_STORAGE_KEYS } from '../storage/schemas';
import { BounceUpRoot } from './BounceUpRoot';
import {
  Finger,
  climbTo,
  fallOff,
  holdEntropy,
  layOutCanvas,
  pump,
  queueAnimationFrames,
  runState,
  type FrameQueue,
} from './test-driver';

const tutorialDone = {
  [BO_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
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
let frames: FrameQueue;

beforeEach(() => {
  liveObservers.clear();
  const original = (window as { ResizeObserver?: unknown }).ResizeObserver;
  (window as { ResizeObserver?: unknown }).ResizeObserver = CountingResizeObserver;
  frames = queueAnimationFrames();
  const clockSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  restores = [
    stubCanvas2d(),
    stubMatchMedia(),
    layOutCanvas(),
    holdEntropy(),
    () => clockSpy.mockRestore(),
    () => frames.restore(),
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
      <BounceUpRoot onExit={() => undefined} kv={createMemoryKV(tutorialDone)} />
    </SettingsProvider>,
  );
}

const seamsPresent = () => '__boFrame' in window || '__boState' in window;

async function openBoard() {
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: /^Start Climbing/ }));
  // The seam appears only past the canvas guard — without it this would be
  // testing an idle board.
  expect(seamsPresent()).toBe(true);
  expect(liveObservers.size).toBe(1);
  return view;
}

/** Open a board, start it with a press, and run three frames: one takes the time, two step. */
async function startRun() {
  const view = await openBoard();
  new Finger().down();
  expect(frames.pending()).toBe(1);
  frames.run(3);
  expect(runState().tick).toBe(2);
  // The loop asked for its next frame, and that is the one an unmount must cancel.
  expect(frames.pending()).toBe(1);
  return view;
}

async function warmUp() {
  // First-use module singletons (the sound service's visibilitychange,
  // Capacitor's web shims) are the shell's lifetime, not the game's.
  const view = await startRun();
  view.unmount();
}

function expectAllReleased(tracker: ReturnType<typeof trackResources>) {
  tracker.assertReleased();
  expect(liveObservers.size).toBe(0);
  // The seams hold the whole frame closure: they go with the board.
  expect(seamsPresent()).toBe(false);
}

// Every test here mounts the whole game at least twice, and the first one in
// the file also pays jsdom's and React's cold start; the result-card test
// hands the board over a thousand frames one at a time and waits for the
// result beat's own 900 ms timer, which must really fire. All of that is
// bounded work, on frames the test hands out; this timeout is room for a
// loaded machine (several suites on few cores), not a limit the work needs.
const LEAK_TEST_TIMEOUT_MS = 20_000;

it(
  'releases everything when unmounted mid-run',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await startRun();
      view.unmount();
      expectAllReleased(tracker);
    } finally {
      tracker.restore();
    }
  },
  LEAK_TEST_TIMEOUT_MS,
);

it(
  'releases everything when unmounted while paused — and a paused run asks for no frame',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await startRun();
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      // Pausing cancelled the frame the loop had asked for, and asked for none.
      expect(frames.pending()).toBe(0);
      const tick = runState().tick;
      frames.run(10);
      expect(runState().tick).toBe(tick);
      view.unmount();
      expectAllReleased(tracker);
    } finally {
      tracker.restore();
    }
  },
  LEAK_TEST_TIMEOUT_MS,
);

it(
  'releases everything when unmounted on a board still waiting in ready',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await openBoard();
      // A board in `ready` runs no loop: no frame is asked for until the first press.
      expect(frames.pending()).toBe(0);
      frames.run(10);
      expect(runState().tick).toBe(0);
      view.unmount();
      expectAllReleased(tracker);
    } finally {
      tracker.restore();
    }
  },
  LEAK_TEST_TIMEOUT_MS,
);

it(
  'releases everything when unmounted on the result card, and during the beat before it',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      // The queue is never run here: the driver pumps the board through its dev
      // seam, one step a frame, so the seam is the loop's only clock.
      // During the 900 ms beat (matchMedia says no Reduced Motion): the reveal's
      // timer is pending, and the unmount must clear it.
      const first = await openBoard();
      const finger = new Finger();
      finger.down();
      pump(1);
      climbTo(finger, 8);
      fallOff(finger);
      expect(runState().status).toBe('over');
      expect(screen.queryByRole('alertdialog')).toBeNull();
      first.unmount();
      expectAllReleased(tracker);

      // And on the card itself.
      const second = await openBoard();
      const again = new Finger(2);
      again.down();
      pump(1);
      climbTo(again, 8);
      fallOff(again);
      expect(await screen.findByRole('alertdialog', {}, { timeout: 2_000 })).toBeInTheDocument();
      second.unmount();
      expectAllReleased(tracker);
    } finally {
      tracker.restore();
    }
  },
  LEAK_TEST_TIMEOUT_MS,
);
