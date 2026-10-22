/**
 * Bounce Up through its root, as a player meets it (docs/BOUNCE_UP_RULES.md
 * §4–§7): Quick Rules, the home and its width choice, a run from `ready` to
 * the result card, pause and the ways a run stops by itself, every input
 * path with the pointer contract, the one booking path, and the doors out.
 *
 * The board runs for real on a stubbed 2D context (jsdom has none) with
 * jsdom's own frames silenced, so `__boFrame` is the loop's only clock and
 * every frame here is one the test handed it (ui/test-driver.ts) — one fixed
 * step each. jsdom has no matchMedia, which reads as Reduced Motion: the
 * result card is there on the falling frame, with no 900 ms beat to wait
 * out. The play clock reads `Date.now`, which these tests hold still and
 * move by hand; with `Math.random` held as well (`holdEntropy`), the seeds,
 * and so the towers climbed, are the same on every run.
 *
 * What this cannot see (§10「確かめないこと」): layout — whether the board
 * fits 360×640 with the web's ad reserve, and the `any-pointer: coarse`
 * split of ◀ ▶ — and the feel of any control on a real finger.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d } from '@/test/lifecycle';
import { LEAD_MAX, RUN_SPEED } from '../game/constants';
import { BO_STORAGE_KEYS, type Prefs, type Stats } from '../storage/schemas';
import { BounceUpRoot } from './BounceUpRoot';
import {
  Finger,
  canvasEl,
  climbTo,
  fallOff,
  hasBoard,
  holdEntropy,
  layOutCanvas,
  pump,
  runState,
} from './test-driver';

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

let restores: Array<() => void> = [];
/** The play clock's `Date.now`, moved by hand. */
let wallMs = 1_700_000_000_000;

beforeEach(() => {
  wallMs = 1_700_000_000_000;
  const clockSpy = vi.spyOn(Date, 'now').mockImplementation(() => wallMs);
  restores = [
    stubCanvas2d(),
    stubAnimationFrames(),
    layOutCanvas(),
    holdEntropy(),
    () => clockSpy.mockRestore(),
  ];
});

afterEach(async () => {
  cleanup();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  for (const restore of restores.reverse()) restore();
  deviceStore.clear();
});

/** Lets the local reads, and the saves they trigger, resolve. */
async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

function store(key: string, value: unknown) {
  deviceStore.set(key, JSON.stringify(value));
}

function stored<T>(key: string): T | null {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
}

function taughtAlready() {
  store(BO_STORAGE_KEYS.flags, { schemaVersion: 1, tutorialCompleted: true });
}

async function launch() {
  const onExit = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BounceUpRoot onExit={onExit} />
    </SettingsProvider>,
  );
  await settle();
  return { onExit, view };
}

/** Home → a `ready` board at the home's width. */
async function openRun() {
  taughtAlready();
  const launched = await launch();
  fireEvent.click(screen.getByRole('button', { name: /^Start Climbing/ }));
  expect(hasBoard()).toBe(true);
  return launched;
}

/** A finger down on the board (which starts a `ready` run) and the frame that takes the time. */
function startWithFinger(): Finger {
  const finger = new Finger();
  finger.down();
  pump(1);
  return finger;
}

const topButton = (name: RegExp | string) => screen.getByRole('button', { name });
const pad = (name: string) =>
  within(screen.getByRole('group', { name: 'Move buttons' })).getByRole('button', { name });
const stateLine = () => document.querySelector('.bo-state')?.textContent ?? '';
const scoreText = () => document.querySelector('.bo-score')?.textContent ?? '';
const boardLabel = () =>
  screen.getByRole('img', { name: /^Bounce Up board/ }).getAttribute('aria-label') ?? '';
const statsNow = () => stored<Stats>(BO_STORAGE_KEYS.stats);

function key(type: 'down' | 'up', init: { key: string; code: string; repeat?: boolean }) {
  if (type === 'down') fireEvent.keyDown(window, init);
  else fireEvent.keyUp(window, init);
}
const RIGHT = { key: 'ArrowRight', code: 'ArrowRight' };
const LEFT = { key: 'ArrowLeft', code: 'ArrowLeft' };
const SPACE = { key: ' ', code: 'Space' };

describe('Quick Rules and the home', () => {
  it('opens on three illustrated steps, then a Normal ready board one tap from play', async () => {
    await launch();
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    expect(document.querySelector('canvas.bo-figure')).not.toBeNull();
    expect(screen.getByText(/press ← →/)).toBeInTheDocument();
    fireEvent.click(topButton('Next'));
    fireEvent.click(topButton('Next'));
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    fireEvent.click(topButton('Start Playing'));
    await settle();
    expect(stored(BO_STORAGE_KEYS.flags)).toEqual({ schemaVersion: 1, tutorialCompleted: true });
    expect(hasBoard()).toBe(true);
    expect(runState().status).toBe('ready');
    expect(runState().width).toBe('normal');
    expect(stateLine()).toContain('Slide on the board');
  });

  it('keeps the width choice for the next run, and nothing else changes', async () => {
    taughtAlready();
    await launch();
    const wide = topButton('Wide');
    expect(topButton('Normal')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(wide);
    await settle();
    expect(wide).toHaveAttribute('aria-pressed', 'true');
    expect(stored<Prefs>(BO_STORAGE_KEYS.prefs)).toEqual({ schemaVersion: 1, width: 'wide' });
    fireEvent.click(topButton(/^Start Climbing/));
    expect(runState().width).toBe('wide');
    // Wide platforms are 96 px: the chain platforms of a Wide run say so.
    expect(runState().platforms.filter((p) => p.segment > 0)[0]!.width).toBe(96 * 120);
  });

  it('reads a stored Wide choice and the per-width records on the home and Statistics', async () => {
    taughtAlready();
    store(BO_STORAGE_KEYS.prefs, { schemaVersion: 1, width: 'wide' });
    store(BO_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      played: 3,
      best: { normal: 40, wide: 77 },
      total: { normal: 60, wide: 90 },
      totalPlaySeconds: 125,
    });
    await launch();
    expect(topButton('Wide')).toHaveAttribute('aria-pressed', 'true');
    expect(topButton(/^Start Climbing/)).toHaveTextContent('Best 77');
    fireEvent.click(topButton('Statistics'));
    const sections = document.querySelectorAll('.stats-section');
    expect(sections[0]!.textContent).toContain('Normal');
    expect(sections[0]!.textContent).toContain('40');
    expect(sections[0]!.textContent).toContain('60');
    expect(sections[1]!.textContent).toContain('77');
    expect(sections[1]!.textContent).toContain('90');
    expect(sections[2]!.textContent).toContain('3');
  });

  it('falls back to the defaults on corrupt records and still plays', async () => {
    deviceStore.set(BO_STORAGE_KEYS.flags, '{"schemaVersion":1,"tutorialCompleted":true}');
    deviceStore.set(BO_STORAGE_KEYS.prefs, '{"schemaVersion":1,"width":"huge"}');
    deviceStore.set(BO_STORAGE_KEYS.stats, '{not json');
    await launch();
    expect(topButton('Normal')).toHaveAttribute('aria-pressed', 'true');
    expect(topButton(/^Start Climbing/).textContent).not.toMatch(/Best/);
    fireEvent.click(topButton(/^Start Climbing/));
    expect(runState().width).toBe('normal');
  });
});

describe('ready → running', () => {
  it('stands still until the first input, and counts the run once when it moves', async () => {
    await openRun();
    pump(30);
    expect(runState().status).toBe('ready');
    expect(runState().tick).toBe(0);
    expect(statsNow()).toBeNull();
    expect(boardLabel()).toContain('waiting for your first move');

    startWithFinger();
    pump(10);
    expect(runState().status).toBe('running');
    expect(runState().tick).toBe(10);
    await settle();
    expect(statsNow()!.played).toBe(1);
    expect(boardLabel()).toContain('climbing');

    // A pause and a resume are not a new run.
    fireEvent.click(topButton('Pause'));
    fireEvent.click(topButton('Resume'));
    await settle();
    expect(statsNow()!.played).toBe(1);
  });

  it('starts on ← → as well, and on Space', async () => {
    await openRun();
    key('down', LEFT);
    pump(1);
    expect(runState().status).toBe('running');
    key('up', LEFT);
    fireEvent.click(topButton('Climb again'));
    expect(runState().status).toBe('ready');
    key('down', SPACE);
    expect(runState().status).toBe('running');
  });

  it('shows the score as text in the top bar while it climbs', async () => {
    await openRun();
    expect(scoreText()).toContain('0');
    startWithFinger();
    pump(50);
    // The apex of one bounce off the floor: 157 px, 15 points (§4).
    expect(scoreText()).toMatch(/15$/);
  });
});

describe('the keys', () => {
  it('move at full speed while held, stop the step they are let go, and cancel each other', async () => {
    await openRun();
    key('down', RIGHT);
    pump(1); // the frame that takes the time
    const x0 = runState().x;
    pump(4);
    expect(runState().x).toBe(x0 + 4 * RUN_SPEED);
    key('up', RIGHT);
    pump(3);
    expect(runState().x).toBe(x0 + 4 * RUN_SPEED);

    key('down', { key: 'a', code: 'KeyA' });
    key('down', { key: 'd', code: 'KeyD' });
    pump(3);
    expect(runState().x).toBe(x0 + 4 * RUN_SPEED);
    key('up', { key: 'd', code: 'KeyD' });
    pump(2);
    expect(runState().x).toBe(x0 + 2 * RUN_SPEED);
    key('up', { key: 'a', code: 'KeyA' });
  });

  it('pause on P and Esc, resume on Space only — never on an arrow — and leave Space to a focused button', async () => {
    await openRun();
    startWithFinger();
    key('down', { key: 'p', code: 'KeyP' });
    expect(runState().status).toBe('paused');
    expect(stateLine()).toContain('Paused');
    key('down', RIGHT);
    pump(5);
    expect(runState().status).toBe('paused');
    key('up', RIGHT);

    const retry = topButton('Climb again');
    fireEvent.keyDown(retry, SPACE);
    expect(runState().status).toBe('paused');

    key('down', SPACE);
    expect(runState().status).toBe('running');
    key('down', { key: 'Escape', code: 'Escape' });
    expect(runState().status).toBe('paused');
    key('down', { ...SPACE, repeat: true });
    expect(runState().status).toBe('paused');
  });
});

describe('the drag', () => {
  it('moves the target 1:1 with the finger, and the body follows at full speed', async () => {
    await openRun();
    const finger = startWithFinger();
    const x0 = runState().x;
    finger.move(10 * 120); // 10 px
    pump(1);
    expect(runState().x).toBe(x0 + RUN_SPEED);
    pump(1);
    expect(runState().x).toBe(x0 + 10 * 120);
    pump(3);
    expect(runState().x).toBe(x0 + 10 * 120);
    finger.up();
  });

  it('never lets a second finger take the steering, and ends the gesture on pointercancel', async () => {
    await openRun();
    const finger = startWithFinger();
    const x0 = runState().x;
    const canvas = canvasEl();
    fireEvent.pointerDown(canvas, { pointerId: 9, pointerType: 'touch', clientX: 20, button: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 9, clientX: 80 });
    pump(3);
    expect(runState().x).toBe(x0);

    fireEvent.pointerCancel(canvas, { pointerId: 7 });
    finger.move(20 * 120);
    pump(5);
    expect(runState().x).toBe(x0);

    // The board is free again: the next finger steers.
    const next = new Finger(11);
    next.down();
    next.move(5 * 120);
    pump(2);
    expect(runState().x).toBe(x0 + 5 * 120);
  });

  it('resumes a paused run on a press of the board, and the paused run drops the finger', async () => {
    await openRun();
    const finger = startWithFinger();
    fireEvent.click(topButton('Pause'));
    const x0 = runState().x;
    finger.move(30 * 120);
    pump(3);
    expect(runState().x).toBe(x0);
    expect(runState().status).toBe('paused');

    const again = new Finger(12);
    again.down();
    expect(runState().status).toBe('running');
    pump(4);
    // The movement made while paused was never handed to a step.
    expect(runState().x).toBe(x0);
  });
});

describe('◀ ▶', () => {
  it('move while pressed, and stop on release or on pointercancel', async () => {
    await openRun();
    startWithFinger();
    new Finger().up();
    const right = pad('Move right');
    const x0 = runState().x;
    fireEvent.pointerDown(right, { pointerId: 3, pointerType: 'touch', button: 0 });
    pump(3);
    expect(runState().x).toBe(x0 + 3 * RUN_SPEED);
    fireEvent.pointerCancel(right, { pointerId: 3 });
    pump(3);
    expect(runState().x).toBe(x0 + 3 * RUN_SPEED);

    const left = pad('Move left');
    fireEvent.pointerDown(left, { pointerId: 4, pointerType: 'touch', button: 0 });
    pump(2);
    fireEvent.pointerUp(left, { pointerId: 4 });
    pump(2);
    expect(runState().x).toBe(x0 + RUN_SPEED);
  });

  it('spend the click a press leaves behind, and nudge on a keyboard or assistive click', async () => {
    await openRun();
    startWithFinger();
    new Finger().up();
    const right = pad('Move right');
    fireEvent.pointerDown(right, { pointerId: 5, pointerType: 'touch', button: 0 });
    pump(2);
    fireEvent.pointerUp(right, { pointerId: 5 });
    fireEvent.click(right);
    const afterHold = runState().x;
    pump(6);
    // The hold already moved it; its trailing click added nothing.
    expect(runState().target).toBe(runState().x);
    expect(runState().x).toBe(afterHold);

    // A click no press led to (keyboard, switch access): one nudge of LEAD_MAX.
    const x1 = runState().x;
    fireEvent.click(pad('Move left'));
    pump(10);
    expect(runState().x).toBe(x1 - LEAD_MAX);
  });

  it('do not resume a paused run, but start a ready one', async () => {
    await openRun();
    fireEvent.pointerDown(pad('Move left'), { pointerId: 6, pointerType: 'touch', button: 0 });
    expect(runState().status).toBe('running');
    fireEvent.pointerUp(pad('Move left'), { pointerId: 6 });
    fireEvent.click(topButton('Pause'));
    fireEvent.pointerDown(pad('Move right'), { pointerId: 8, pointerType: 'touch', button: 0 });
    expect(runState().status).toBe('paused');
    fireEvent.pointerUp(pad('Move right'), { pointerId: 8 });
  });
});

describe('a run that stops by itself', () => {
  it('pauses on blur and on a hidden page, books the time, and never resumes by itself', async () => {
    await openRun();
    startWithFinger();
    wallMs += 4_000;
    pump(20);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await settle();
    expect(runState().status).toBe('paused');
    expect(statsNow()!.totalPlaySeconds).toBe(4);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    pump(10);
    expect(runState().status).toBe('paused');

    key('down', SPACE);
    wallMs += 3_000;
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(runState().status).toBe('paused');
    expect(statsNow()!.totalPlaySeconds).toBe(7);
    // Paused time is not play time.
    wallMs += 60_000;
    fireEvent.click(topButton('Home'));
    await settle();
    expect(statsNow()!.totalPlaySeconds).toBe(7);
  });

  it('asks for no frame while paused: the loop is stopped, not idling', async () => {
    await openRun();
    startWithFinger();
    pump(5);
    fireEvent.click(topButton('Pause'));
    const tick = runState().tick;
    pump(30);
    expect(runState().tick).toBe(tick);
  });
});

describe('the end of a run, and the one booking path', () => {
  it('falls to the result card with the facts, books the height once, and retries at the same width', async () => {
    taughtAlready();
    store(BO_STORAGE_KEYS.prefs, { schemaVersion: 1, width: 'wide' });
    store(BO_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      played: 1,
      best: { normal: 0, wide: 20 },
      total: { normal: 0, wide: 20 },
      totalPlaySeconds: 10,
    });
    await launch();
    fireEvent.click(topButton(/^Start Climbing/));
    const finger = startWithFinger();
    climbTo(finger, 8);
    wallMs += 12_000;
    fallOff(finger);
    finger.up();
    await settle();

    const run = runState();
    expect(run.status).toBe('over');
    const score = Math.floor(run.maxHeight / 1200);
    expect(score).toBeGreaterThan(20);
    const card = screen.getByRole('alertdialog', { name: `Reached ${score}` });
    expect(within(card).getByText('Wide')).toBeInTheDocument();
    // The best moved from 20 to this run's score: the difference is said.
    expect(card.querySelector('.result-delta')?.textContent).toBe(`+${score - 20}`);
    expect(document.querySelector('.bo-live')?.textContent).toContain(`Score ${score}`);
    expect(statsNow()).toEqual({
      schemaVersion: 1,
      played: 2,
      best: { normal: 0, wide: score },
      total: { normal: 0, wide: 20 + score },
      totalPlaySeconds: 22,
    });

    fireEvent.click(within(card).getByRole('button', { name: 'Climb again' }));
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(runState().status).toBe('ready');
    expect(runState().width).toBe('wide');
    // Nothing booked twice on the way to the next run.
    expect(statsNow()!.total.wide).toBe(20 + score);
  });

  it('books a run left half-way (best and total), and only its growth after a background', async () => {
    await openRun();
    const finger = startWithFinger();
    climbTo(finger, 4);
    const before = Math.floor(runState().maxHeight / 1200);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await settle();
    expect(statsNow()!.best.normal).toBe(before);
    expect(statsNow()!.total.normal).toBe(before);

    finger.up();
    const again = new Finger(21);
    again.down();
    pump(1);
    climbTo(again, 8);
    fallOff(again);
    await settle();
    const final = Math.floor(runState().maxHeight / 1200);
    expect(final).toBeGreaterThan(before);
    expect(statsNow()!.best.normal).toBe(final);
    // Not before + final: the second booking added only the growth.
    expect(statsNow()!.total.normal).toBe(final);
  });

  it('↻ retries at once with no question, booking the run it throws away', async () => {
    await openRun();
    const finger = startWithFinger();
    climbTo(finger, 3);
    const score = Math.floor(runState().maxHeight / 1200);
    const seed = runState().seed;
    fireEvent.click(topButton('Climb again'));
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(runState().status).toBe('ready');
    expect(runState().seed).not.toBe(seed);
    expect(statsNow()!.best.normal).toBe(score);
    expect(statsNow()!.total.normal).toBe(score);
  });

  it('← home ends the run after booking it; the browser’s Back (unmount) books once too', async () => {
    const { view } = await openRun();
    startWithFinger();
    wallMs += 5_000;
    pump(60);
    fireEvent.click(topButton('Home'));
    await settle();
    expect(screen.getByRole('button', { name: /^Start Climbing/ })).toBeInTheDocument();
    expect(statsNow()!.totalPlaySeconds).toBe(5);
    expect(statsNow()!.best.normal).toBe(15);

    fireEvent.click(topButton(/^Start Climbing/));
    startWithFinger();
    wallMs += 3_000;
    pump(10);
    view.unmount();
    await settle();
    expect(statsNow()!.totalPlaySeconds).toBe(8);
    expect(statsNow()!.played).toBe(2);

    // Mounting again books nothing more.
    await launch();
    await settle();
    expect(statsNow()!.totalPlaySeconds).toBe(8);
  });
});
