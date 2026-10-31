/**
 * Overtake through its root, as a player meets it (docs/OVERTAKE_RULES.md §2,
 * §3, §7, §9–§11): Quick Rules, the home, a race from `ready` to the result
 * card, pause and the ways a race stops by itself, every input path, the
 * statistics and the doors out.
 *
 * The board runs for real on a stubbed 2D context (jsdom has none) with
 * jsdom's own frames silenced, so `__otFrame` is the loop's only clock and
 * every frame here is one the test handed it (ui/test-driver.ts). jsdom has
 * no matchMedia, which reads as Reduced Motion: the result card is there on
 * the finishing frame, with no 900 ms beat to wait out.
 *
 * What this cannot see (§16「確かめないこと」): layout — whether the board and
 * the buttons fit 360×640 with the web's ad reserve is measured by hand —
 * and the feel of any control on a real finger.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReviewStateForTesting, resetReviewForTesting } from '@/services/review';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d } from '@/test/lifecycle';
import {
  BUMP_LOCK_STEPS,
  FULL_SPEED,
  MIN_TARGET_SPEED,
  ROLLING_START_SPEED,
  SUB,
} from '../game/constants';
import { INPUT_TUNING, laneStepPx, TAP_BRAKE_STEPS } from '../game/input';
import { OvertakeProvider, useOvertake, type OvertakeContextValue } from '../state/GameContext';
import { OT_STORAGE_KEYS, type Prefs, type Progress, type Stats } from '../storage/schemas';
import { OvertakeRoot, OvertakeScreens } from './OvertakeRoot';
import { canvasEl, driveToFinish, hasBoard, layOutCanvas, pump, raceState } from './test-driver';

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

const PLAYER_START_X = 152;

let restores: Array<() => void> = [];

beforeEach(() => {
  restores = [stubCanvas2d(), stubAnimationFrames(), layOutCanvas()];
  resetReviewForTesting();
});

afterEach(async () => {
  cleanup();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  for (const restore of restores.reverse()) restore();
  vi.useRealTimers();
  deviceStore.clear();
});

/** Lets the local reads, and the saves they trigger, resolve. */
async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

function store(key: string, value: unknown) {
  deviceStore.set(key, JSON.stringify(value));
}

function taughtAlready() {
  store(OT_STORAGE_KEYS.flags, { schemaVersion: 1, tutorialCompleted: true });
}

function stored<T>(key: string): T | null {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
}

async function launch() {
  const onExit = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <OvertakeRoot onExit={onExit} />
    </SettingsProvider>,
  );
  await settle();
  return { onExit, view };
}

/** Home → the frontier's `ready`. */
async function openRace(level = 1) {
  taughtAlready();
  if (level > 1) store(OT_STORAGE_KEYS.progress, { schemaVersion: 1, highestUnlocked: level });
  const launched = await launch();
  fireEvent.click(screen.getByRole('button', { name: `Level ${level}` }));
  expect(hasBoard()).toBe(true);
  return launched;
}

const boardLabel = () =>
  screen.getByRole('img', { name: /^Road Weave, level/ }).getAttribute('aria-label') ?? '';
const topButton = (name: RegExp | string) => screen.getByRole('button', { name });
const pad = (name: string) =>
  within(screen.getByRole('group', { name: 'Driving buttons' })).getByRole('button', { name });
const raceRow = () => document.querySelector('.ot-race-row')?.textContent ?? '';
const announced = () => document.querySelector('.ot-live')?.textContent ?? '';
const targetPx = () => raceState().player.target / SUB;
/** How far a held ← → / ◀ ▶ moves the target in `steps` race steps: 440 px/s (§3). */
const steerPx = (steps: number) => (steps * 440) / 120;

function pressSpace(target: Window | Element = window) {
  fireEvent.keyDown(target, { key: ' ', code: 'Space' });
}

/** Space, then the frame that takes the loop's first time (it steps from the next). */
function go() {
  pressSpace();
  pump(1);
}

/** The provider and screens with a probe, for flows that need an ending on demand. */
function mountScreens(
  options: { progress?: number; controls?: Prefs['controls']; stats?: Stats } = {},
) {
  let api!: OvertakeContextValue;
  function Probe() {
    api = useOvertake();
    return null;
  }
  const progress: Progress = { schemaVersion: 1, highestUnlocked: options.progress ?? 1 };
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <OvertakeProvider
        initialStats={options.stats ?? { schemaVersion: 1, played: 0, totalPlaySeconds: 0 }}
        initialFlags={{ schemaVersion: 1, tutorialCompleted: true }}
        initialProgress={progress}
        initialPrefs={{ schemaVersion: 1, controls: options.controls ?? 'drag' }}
        onExit={vi.fn()}
      >
        <Probe />
        <OvertakeScreens />
      </OvertakeProvider>
    </SettingsProvider>,
  );
  return () => api;
}

describe('first run: Quick Rules (§10)', () => {
  it('teaches in three steps, step 2 in the words of the control in use, then opens Level 1 ready', async () => {
    await launch();
    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Change lanes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Drag on mapping B (what ships, §3): ▼, not the finger's pull.
    expect(screen.getByText(/hold ▼ to ease off/)).toBeInTheDocument();
    expect(screen.queryByText(/pull your finger/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/three cars running at their own pace/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();

    expect(stored(OT_STORAGE_KEYS.flags)).toEqual({ schemaVersion: 1, tutorialCompleted: true });
    expect(boardLabel()).toBe('Road Weave, level 1: ready');
    expect(raceRow()).toContain('Touch to start');
    // Opening a level is not a race yet (§9).
    expect(stored(OT_STORAGE_KEYS.stats)).toBeNull();
  });

  it('says ▼ in step 2 for Buttons', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.prefs, { schemaVersion: 1, controls: 'buttons' });
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'How to Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/hold ▼ to ease off/)).toBeInTheDocument();
    expect(screen.queryByText(/pull your finger/)).toBeNull();
  });

  it('never calls the other cars rivals or opponents, and promises nothing', async () => {
    await launch();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      seen.push(document.querySelector('.tutorial-card')?.textContent ?? '');
      if (i < 2) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    const text = seen.join(' ');
    expect(text).not.toMatch(/rival|opponent|versus|\bvs\b|pace car|rank/i);
    // No promise about money, ads, the network, or what is kept (§12).
    expect(text).not.toMatch(
      /free|offline|online|\bads?\b|advert|purchase|buy|pay|subscri|privacy|delete|saved?\b/i,
    );
  });
});

describe('the home (§7, §11)', () => {
  it('Play opens the frontier, and the Levels chip says how far up the hundred', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.progress, { schemaVersion: 1, highestUnlocked: 37 });
    await launch();
    expect(screen.getByRole('button', { name: /Levels\s*36\/100/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Level 37' }));
    expect(boardLabel()).toBe('Road Weave, level 37: ready');
  });

  it('once all hundred are won, Play stays on Level 100 and the chip says 100/100', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.progress, { schemaVersion: 1, highestUnlocked: 101 });
    await launch();
    expect(screen.getByRole('button', { name: /Levels\s*100\/100/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Level 100' })).toBeInTheDocument();
  });

  it('a corrupt frontier is the default, not a guess', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.progress, { schemaVersion: 1, highestUnlocked: 512 });
    await launch();
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Levels\s*0\/100/ })).toBeInTheDocument();
  });

  it('the level picker replays a cleared level and keeps the ones ahead shut', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.progress, { schemaVersion: 1, highestUnlocked: 4 });
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Levels/ }));
    expect(screen.getByRole('button', { name: 'Level 5, locked' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Level 2' }));
    expect(boardLabel()).toBe('Road Weave, level 2: ready');
  });

  it('Drag is chosen without asking; Buttons is kept in ot.prefs and brings ◀ ▼ ▶', async () => {
    taughtAlready();
    await launch();
    const group = screen.getByRole('group', { name: 'Controls' });
    expect(within(group).getByRole('button', { name: 'Drag' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // A race opens without a choice made.
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
    expect(
      within(screen.getByRole('group', { name: 'Driving buttons' })).getAllByRole('button'),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Controls' })).getByRole('button', {
        name: 'Buttons',
      }),
    );
    await settle();
    expect(stored(OT_STORAGE_KEYS.prefs)).toEqual({ schemaVersion: 1, controls: 'buttons' });
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
    expect(
      within(screen.getByRole('group', { name: 'Driving buttons' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Steer left', 'Ease off', 'Steer right']);
  });

  it('exits to the collection from its home', async () => {
    taughtAlready();
    const { onExit } = await launch();
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('ready, and the start (§2)', () => {
  it('nothing moves in ready, however many frames pass, and nothing is laid over the board', async () => {
    await openRace();
    pump(60);
    expect(raceState().status).toBe('ready');
    expect(raceState().step).toBe(0);
    expect([...document.querySelector('.ot-body')!.children].map((c) => c.className)).toEqual([
      'ot-board',
      'ot-pad ot-pad-drag',
    ]);
    expect(topButton('Retry same board')).toBeDisabled();
  });

  it('a press on the board starts every car rolling at 240, and counts one race', async () => {
    await openRace();
    fireEvent.pointerDown(canvasEl(), { pointerId: 1, clientX: 180, clientY: 400, button: 0 });
    await settle();
    expect(boardLabel()).toBe('Road Weave, level 1: running');
    expect(raceState().player.w).toBe(ROLLING_START_SPEED);
    expect(raceState().rivals.map((r) => r.car.w)).toEqual([240, 240, 240]);
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.played).toBe(1);
    pump(10);
    expect(raceState().step).toBeGreaterThan(0);
    expect(raceState().player.r).toBeGreaterThan(-90 * SUB);
  });

  it('Space starts too; so does the ▶ in the top bar', async () => {
    await openRace();
    go();
    expect(boardLabel()).toMatch(/running$/);
    fireEvent.click(topButton('Retry same board'));
    expect(boardLabel()).toMatch(/ready$/);
    fireEvent.click(topButton('Start'));
    expect(boardLabel()).toMatch(/running$/);
  });

  it('the buttons under the board do not start a race (§2)', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.prefs, { schemaVersion: 1, controls: 'buttons' });
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
    for (const name of ['Steer left', 'Ease off', 'Steer right']) {
      const button = pad(name);
      fireEvent.pointerDown(button, { pointerId: 3, button: 0 });
      fireEvent.pointerUp(button, { pointerId: 3 });
      fireEvent.click(button, { detail: 1 });
      fireEvent.click(button, { detail: 0 });
    }
    expect(boardLabel()).toMatch(/ready$/);
  });

  it('leaves Space to a focused button: one press is one action', async () => {
    await openRace();
    const retry = topButton('Retry same board');
    fireEvent.click(topButton('Start'));
    const home = topButton('Home');
    home.focus();
    pressSpace(home);
    // The game did not answer it: still running, not paused or restarted.
    expect(boardLabel()).toMatch(/running$/);
    expect(retry).toBeEnabled();
  });
});

describe('the race row and the top bar (§11)', () => {
  it('the place is read in words and its digits are hidden from the reader; nothing is live', async () => {
    await openRace();
    const place = document.querySelector('.ot-place');
    expect(place).not.toBeNull();
    expect(place?.hasAttribute('aria-label')).toBe(false);
    expect(place?.closest('[aria-live], [role="status"]')).toBeNull();
    const words = within(place as HTMLElement).getByText('Place 3 of 4');
    expect(words).toHaveClass('visually-hidden');
    const digits = place?.querySelector('[aria-hidden="true"]');
    expect(digits?.textContent).toBe('3/4');
  });

  it('in ready the three rings stand apart with their digits, the dot on a lane of its own', async () => {
    await openRace();
    const rings = [...document.querySelectorAll<HTMLElement>('.ot-progress-rival')];
    expect(rings.map((ring) => ring.textContent)).toEqual(['1', '2', '3']);
    const left = rings.map((ring) => Number.parseFloat(ring.style.left));
    // All four start level: the rings are spread a ring's width apart, in digit order.
    expect(left[1]! - left[0]!).toBeGreaterThanOrEqual(16 - 1e-6);
    expect(left[2]! - left[1]!).toBeGreaterThanOrEqual(16 - 1e-6);
    expect(left[0]).toBeGreaterThanOrEqual(0);
    expect(document.querySelectorAll('.ot-progress-player')).toHaveLength(1);
  });

  it('▶ and ❚❚ are sized like the shared icons beside them', async () => {
    await openRace();
    const mark = () => topButton(/Start|Pause|Resume/).querySelector('svg');
    expect(mark()?.getAttribute('width')).toBe('1em');
    expect(mark()?.getAttribute('height')).toBe('1em');
    go();
    expect(topButton('Pause').querySelector('svg')?.getAttribute('width')).toBe('1em');
  });
});

describe('pause, and the ways a race stops by itself (§2)', () => {
  it('❚❚ stops the race: no step on any frame, the row says so, nothing over the board', async () => {
    await openRace();
    go();
    pump(10);
    fireEvent.click(topButton('Pause'));
    expect(boardLabel()).toMatch(/paused$/);
    expect(raceRow()).toContain('Paused');
    const step = raceState().step;
    pump(60);
    expect(raceState().step).toBe(step);
    expect(document.querySelector('.overlay')).toBeNull();
    // Resume is the player's: ▶, then the race moves on from where it was.
    fireEvent.click(topButton('Resume'));
    pump(5);
    expect(raceState().step).toBeGreaterThan(step);
  });

  it('P and Esc pause; a held key repeating does not toggle anything', async () => {
    await openRace();
    go();
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });
    expect(boardLabel()).toMatch(/paused$/);
    fireEvent.keyDown(window, { key: ' ', code: 'Space', repeat: true });
    expect(boardLabel()).toMatch(/paused$/);
    go();
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP', repeat: true });
    expect(boardLabel()).toMatch(/running$/);
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(boardLabel()).toMatch(/paused$/);
    // Enter resumes, like Space.
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(boardLabel()).toMatch(/running$/);
  });

  it('a press on a paused board resumes it, and that finger steers from there', async () => {
    await openRace();
    go();
    pump(4);
    fireEvent.click(topButton('Pause'));
    const canvas = canvasEl();
    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 100, clientY: 400, button: 0 });
    expect(boardLabel()).toMatch(/running$/);
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 125, clientY: 400 });
    pump(2);
    expect(targetPx()).toBeCloseTo(PLAYER_START_X + 25 * INPUT_TUNING.gain, 5);
  });

  it('hidden pauses a moving race; visible again leaves it paused', async () => {
    await openRace();
    go();
    pump(10);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Reflect.deleteProperty(document, 'visibilityState');
    expect(boardLabel()).toMatch(/paused$/);
    const step = raceState().step;
    pump(30);
    expect(raceState().step).toBe(step);
  });

  it('a blur pauses a moving race and drops what was held; focus moves nothing', async () => {
    await openRace();
    go();
    fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });
    pump(6);
    expect(targetPx()).toBeLessThan(PLAYER_START_X);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(boardLabel()).toMatch(/paused$/);
    // ← was still down when the window lost focus, and its keyup went
    // elsewhere: after the resume the target holds still.
    go();
    pump(2);
    const held = targetPx();
    pump(10);
    expect(targetPx()).toBe(held);
  });
});

describe('Drag (§3 — mode B, the shipped default; mode A is OvertakeRoot.modeA.test.tsx)', () => {
  async function steering() {
    await openRace();
    const canvas = canvasEl();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 180, clientY: 400, button: 0 });
    // The frame that takes the loop's first time; the next one steps.
    pump(1);
    return canvas;
  }

  it('the car follows the finger 1.2 times over, from wherever the board was touched', async () => {
    const canvas = await steering();
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 230, clientY: 400 });
    pump(2);
    expect(targetPx()).toBeCloseTo(PLAYER_START_X + 50 * 1.2, 5);
    // The physics only ever sees whole 1/120 px units (§1).
    expect(Number.isInteger(raceState().player.target)).toBe(true);
  });

  it('the drag steers but its pull eases nothing off; a second finger still does', async () => {
    const canvas = await steering();
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 190, clientY: 520 });
    pump(16);
    expect(targetPx()).toBeCloseTo(PLAYER_START_X + 12, 5);
    expect(raceState().player.w).toBe(FULL_SPEED);
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 60, clientY: 200, button: 0 });
    pump(20);
    expect(raceState().player.w).toBe(MIN_TARGET_SPEED);
  });

  it('a second finger is the hardest brake and never takes the steering', async () => {
    const canvas = await steering();
    pump(16);
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 60, clientY: 200, button: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 300, clientY: 200 });
    pump(20);
    expect(raceState().player.w).toBe(MIN_TARGET_SPEED);
    expect(targetPx()).toBe(PLAYER_START_X);
    // The steering finger still steers.
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 160, clientY: 400 });
    pump(1);
    expect(targetPx()).toBeCloseTo(PLAYER_START_X - 24, 5);
    // The second finger lifted: the throttle comes back.
    fireEvent.pointerUp(canvas, { pointerId: 2 });
    pump(10);
    expect(raceState().player.w).toBeGreaterThan(MIN_TARGET_SPEED);
  });

  it('a cancelled steering finger ends the drag where the car is; the next press anchors afresh', async () => {
    const canvas = await steering();
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 200, clientY: 400 });
    pump(1);
    const left = targetPx();
    fireEvent.pointerCancel(canvas, { pointerId: 1 });
    // The cancelled finger is no longer heard.
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 320, clientY: 400 });
    pump(1);
    expect(targetPx()).toBe(left);
    // A fresh press is a fresh anchor: no jump to where the finger lands.
    fireEvent.pointerDown(canvas, { pointerId: 5, clientX: 40, clientY: 300, button: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 5, clientX: 50, clientY: 300 });
    pump(1);
    expect(targetPx()).toBeCloseTo(left + 12, 5);
  });

  it('a cancelled second finger lets the brake go', async () => {
    const canvas = await steering();
    pump(16);
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 60, clientY: 200, button: 0 });
    pump(10);
    const braked = raceState().player.w;
    fireEvent.pointerCancel(canvas, { pointerId: 2 });
    pump(10);
    expect(raceState().player.w).toBeGreaterThan(braked);
  });

  it('a right mouse button is not a finger', async () => {
    await openRace();
    fireEvent.pointerDown(canvasEl(), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 2,
      clientX: 180,
      clientY: 400,
    });
    expect(boardLabel()).toMatch(/ready$/);
  });

  it('▼ held eases off from its press; a cancel or a lost capture lets go', async () => {
    const canvas = await steering();
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    pump(16);
    const down = pad('Ease off');
    fireEvent.pointerDown(down, { pointerId: 9, button: 0 });
    pump(20);
    expect(raceState().player.w).toBe(MIN_TARGET_SPEED);
    fireEvent.pointerCancel(down, { pointerId: 9 });
    pump(5);
    expect(raceState().player.w).toBeGreaterThan(MIN_TARGET_SPEED);
    fireEvent.pointerDown(down, { pointerId: 10, button: 0 });
    pump(5);
    const braking = raceState().player.w;
    fireEvent.lostPointerCapture(down, { pointerId: 10 });
    pump(5);
    expect(raceState().player.w).toBeGreaterThan(braking);
  });

  it('a key then the finger: the finger takes the car from where the key left it', async () => {
    const canvas = await steering();
    fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
    pump(3);
    fireEvent.keyUp(window, { key: 'ArrowRight', code: 'ArrowRight' });
    const keyed = targetPx();
    expect(keyed).toBeGreaterThan(PLAYER_START_X);
    // The first move re-anchors; only the next one steers.
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 100, clientY: 400 });
    pump(1);
    expect(targetPx()).toBe(keyed);
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 110, clientY: 400 });
    pump(1);
    expect(targetPx()).toBeCloseTo(keyed + 12, 5);
  });
});

describe('Buttons (§3)', () => {
  async function buttonsRace() {
    taughtAlready();
    store(OT_STORAGE_KEYS.prefs, { schemaVersion: 1, controls: 'buttons' });
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
  }

  it('the board only starts and resumes: a drag steers nothing and a second finger brakes nothing', async () => {
    await buttonsRace();
    const canvas = canvasEl();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 180, clientY: 400, button: 0 });
    expect(boardLabel()).toMatch(/running$/);
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 500 });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 40, clientY: 300, button: 0 });
    pump(40);
    expect(targetPx()).toBe(PLAYER_START_X);
    expect(raceState().player.w).toBeGreaterThan(300);
  });

  it('◀ held moves the target at 440 px/s and stops on release, cancel or a lost capture', async () => {
    await buttonsRace();
    go();
    const left = pad('Steer left');
    fireEvent.pointerDown(left, { pointerId: 4, button: 0 });
    let step = raceState().step;
    pump(3);
    // Three frames of 1/30 s at 440 px/s of race time (about twelve steps).
    expect(targetPx()).toBeCloseTo(PLAYER_START_X - steerPx(raceState().step - step), 5);
    expect(PLAYER_START_X - targetPx()).toBeGreaterThan(steerPx(10) - 1e-9);
    fireEvent.pointerCancel(left, { pointerId: 4 });
    const stopped = targetPx();
    pump(3);
    expect(targetPx()).toBe(stopped);
    fireEvent.pointerDown(left, { pointerId: 5, button: 0 });
    pump(1);
    fireEvent.lostPointerCapture(left, { pointerId: 5 });
    const after = targetPx();
    pump(3);
    expect(targetPx()).toBe(after);
    // A release from another pointer does not end this one's hold.
    const right = pad('Steer right');
    fireEvent.pointerDown(right, { pointerId: 6, button: 0 });
    fireEvent.pointerUp(right, { pointerId: 99 });
    step = raceState().step;
    pump(3);
    expect(targetPx()).toBeCloseTo(after + steerPx(raceState().step - step), 5);
    expect(targetPx() - after).toBeGreaterThan(steerPx(10) - 1e-9);
    fireEvent.pointerUp(right, { pointerId: 6 });
  });

  it('the click a press leaves is spent; a keyboard click is one lane', async () => {
    await buttonsRace();
    go();
    const right = pad('Steer right');
    // A tap spans frames: the hold moved the target, and its click is spent.
    fireEvent.pointerDown(right, { pointerId: 8, button: 0 });
    pump(1);
    fireEvent.pointerUp(right, { pointerId: 8 });
    const pressed = targetPx();
    expect(pressed).toBeGreaterThan(PLAYER_START_X);
    fireEvent.click(right, { detail: 1 });
    pump(1);
    expect(targetPx()).toBe(pressed);
    // Some engines report a touch tap's click with detail 0: the press it
    // follows still spends it.
    fireEvent.pointerDown(right, { pointerId: 9, button: 0 });
    pump(1);
    fireEvent.pointerUp(right, { pointerId: 9 });
    const pressedAgain = targetPx();
    fireEvent.click(right, { detail: 0 });
    pump(1);
    expect(targetPx()).toBe(pressedAgain);
    // A keyboard (or assistive) activation: no press, detail 0 — one lane.
    fireEvent.keyDown(right, { key: 'Enter' });
    fireEvent.click(right, { detail: 0 });
    pump(1);
    expect(targetPx()).toBeCloseTo(pressedAgain + laneStepPx(3), 5);
  });

  it('a press and release inside one frame moved nothing, so its click is the one-step action', async () => {
    await buttonsRace();
    go();
    const right = pad('Steer right');
    // A synthetic or assistive double-tap: down, up and click together.
    fireEvent.pointerDown(right, { pointerId: 20, button: 0 });
    fireEvent.pointerUp(right, { pointerId: 20 });
    fireEvent.click(right, { detail: 0 });
    pump(1);
    expect(targetPx()).toBeCloseTo(PLAYER_START_X + laneStepPx(3), 5);
    // The same with a click that reports its press (detail 1), on ◀.
    const lane = targetPx();
    const left = pad('Steer left');
    fireEvent.pointerDown(left, { pointerId: 21, button: 0 });
    fireEvent.pointerUp(left, { pointerId: 21 });
    fireEvent.click(left, { detail: 1 });
    pump(1);
    expect(targetPx()).toBeCloseTo(lane - laneStepPx(3), 5);
    // ▼: half a second of the hardest brake.
    pump(40);
    const before = raceState().player.w;
    const down = pad('Ease off');
    fireEvent.pointerDown(down, { pointerId: 22, button: 0 });
    fireEvent.pointerUp(down, { pointerId: 22 });
    fireEvent.click(down, { detail: 0 });
    pump(TAP_BRAKE_STEPS / 4);
    expect(raceState().player.w).toBeLessThan(before);
  });

  it('a cancelled press leaves no mark: the next assistive click acts, keydown or not', async () => {
    await buttonsRace();
    go();
    const right = pad('Steer right');
    fireEvent.pointerDown(right, { pointerId: 30, button: 0 });
    pump(1);
    fireEvent.pointerCancel(right, { pointerId: 30 });
    const cancelled = targetPx();
    fireEvent.click(right, { detail: 0 });
    pump(1);
    expect(targetPx()).toBeCloseTo(cancelled + laneStepPx(3), 5);
    // A capture lost before any pointerup: the same (on ◀, to stay on the road).
    const left = pad('Steer left');
    fireEvent.pointerDown(left, { pointerId: 31, button: 0 });
    pump(1);
    fireEvent.lostPointerCapture(left, { pointerId: 31 });
    const lost = targetPx();
    fireEvent.click(left, { detail: 0 });
    pump(1);
    expect(targetPx()).toBeCloseTo(lost - laneStepPx(3), 5);
    // The browser's own order after a release — up, lost capture, click —
    // still spends that click.
    fireEvent.pointerDown(right, { pointerId: 32, button: 0 });
    pump(1);
    fireEvent.pointerUp(right, { pointerId: 32 });
    fireEvent.lostPointerCapture(right, { pointerId: 32 });
    const released = targetPx();
    fireEvent.click(right, { detail: 0 });
    pump(1);
    expect(targetPx()).toBe(released);
  });

  it('a keyboard click on ▼ eases off for half a second of race time', async () => {
    await buttonsRace();
    go();
    pump(40);
    const before = raceState().player.w;
    const down = pad('Ease off');
    fireEvent.click(down, { detail: 0 });
    // 60 steps is 15 frames of four.
    pump(TAP_BRAKE_STEPS / 4);
    const slowed = raceState().player.w;
    expect(slowed).toBeLessThan(before);
    pump(20);
    expect(raceState().player.w).toBeGreaterThan(slowed);
  });
});

describe('the held target keeps to race time (§1, §3)', () => {
  it('a slow frame moves ◀ ▶ and ← → no farther than the steps the car ran', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.prefs, { schemaVersion: 1, controls: 'buttons' });
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
    go();
    const left = pad('Steer left');
    fireEvent.pointerDown(left, { pointerId: 50, button: 0 });
    const before = targetPx();
    let step = raceState().step;
    // A 250 ms frame runs at most six steps (50 ms of race): the target moves
    // that far, not 250 ms of steering (110 px).
    pump(1, 250);
    let ran = raceState().step - step;
    expect(ran).toBeGreaterThan(0);
    expect(ran).toBeLessThanOrEqual(6);
    expect(before - targetPx()).toBeCloseTo(steerPx(ran), 5);
    fireEvent.pointerUp(left, { pointerId: 50 });
    fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
    const keyed = targetPx();
    step = raceState().step;
    pump(1, 250);
    ran = raceState().step - step;
    expect(ran).toBeLessThanOrEqual(6);
    expect(targetPx() - keyed).toBeCloseTo(steerPx(ran), 5);
    fireEvent.keyUp(window, { key: 'ArrowRight', code: 'ArrowRight' });
  });
});

describe('keys (§3)', () => {
  it('W A S D by position, arrows by name; all of them kept from scrolling the page', async () => {
    await openRace();
    go();
    // An AZERTY board's Q sits where A does.
    const a = fireEvent.keyDown(window, { key: 'q', code: 'KeyA' });
    expect(a).toBe(false);
    const step = raceState().step;
    pump(3);
    fireEvent.keyUp(window, { key: 'q', code: 'KeyA' });
    // 440 px/s of race time: three frames of about four steps.
    expect(targetPx()).toBeCloseTo(PLAYER_START_X - steerPx(raceState().step - step), 5);
    expect(PLAYER_START_X - targetPx()).toBeGreaterThan(steerPx(10) - 1e-9);
    for (const [key, code] of [
      ['ArrowUp', 'ArrowUp'],
      ['ArrowDown', 'ArrowDown'],
      ['w', 'KeyW'],
      ['s', 'KeyS'],
    ] as const) {
      expect(fireEvent.keyDown(window, { key, code })).toBe(false);
      fireEvent.keyUp(window, { key, code });
    }
  });

  it('↓ / S held is the hardest brake', async () => {
    await openRace();
    go();
    pump(40);
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    pump(60);
    expect(raceState().player.w).toBe(MIN_TARGET_SPEED);
    fireEvent.keyUp(window, { key: 's', code: 'KeyS' });
    pump(20);
    expect(raceState().player.w).toBeGreaterThan(MIN_TARGET_SPEED);
  });

  it('steering keys do nothing in ready', async () => {
    await openRace();
    fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });
    go();
    pump(5);
    expect(targetPx()).toBe(PLAYER_START_X);
  });
});

describe('the frame (§1, §6, §11)', () => {
  it('runs at most six steps however long the frame — so at most six decisions for the three others', async () => {
    await openRace();
    go();
    pump(1);
    const before = raceState().step;
    pump(1, 1_000);
    expect(raceState().step - before).toBeLessThanOrEqual(6);
  });

  it('a Bump locks the steering, then the finger takes over from where the car is', async () => {
    await openRace();
    const canvas = canvasEl();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 180, clientY: 400, button: 0 });
    // Straight on at x = 152 runs into the first traffic in lane 1 (§6, the Idler).
    let frames = 0;
    while (raceState().player.bumps === 0 && frames < 2_000) {
      pump(1);
      frames += 1;
    }
    expect(raceState().player.bumps).toBe(1);
    // The finger travels during the lock …
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 400 });
    pump(Math.ceil(BUMP_LOCK_STEPS / 4) + 1);
    // … and once the lock is over the target is the car's own, not the finger's travel.
    const released = targetPx();
    expect(released).toBe(raceState().player.x / SUB);
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 310, clientY: 400 });
    pump(1);
    expect(targetPx()).toBeCloseTo(released + 12, 5);
  });
});

describe('Retry, Next, Levels (§2, §8)', () => {
  it('↻ is the instant retry: no question, the same course, ready', async () => {
    await openRace();
    go();
    pump(20);
    fireEvent.click(topButton('Retry same board'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boardLabel()).toBe('Road Weave, level 1: ready');
    expect(raceState().step).toBe(0);
    expect(raceState().player.r).toBe(-90 * SUB);
    // The retried race counts when it moves, not before.
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.played).toBe(1);
    go();
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.played).toBe(2);
  });

  it('first place: the card states the fact, Next leads, the frontier moves, the review counter counts', async () => {
    await openRace();
    const reviewBefore = getReviewStateForTesting().gamesCompleted;
    expect(announced()).toBe('');
    driveToFinish();
    await settle();

    const result = raceState();
    expect(result.status).toBe('finished');
    expect(result.place).toBe(1);
    const card = screen.getByRole('alertdialog', { name: 'Level 1 cleared' });
    expect(within(card).getByText('1/4')).toBeInTheDocument();
    expect(card.textContent).toContain(`Bumps${result.player.bumps}`);
    const buttons = within(card)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(buttons.slice(0, 3)).toEqual(['Next Level', 'Retry same board', 'Levels']);
    expect(within(card).getByRole('button', { name: 'Next Level' })).toHaveFocus();
    // Nothing on the card is a clock or praise (§11).
    expect(card.textContent).not.toMatch(/\d+:\d\d|nice|great|well done|awesome|congrat/i);
    expect(stored<Progress>(OT_STORAGE_KEYS.progress)).toEqual({
      schemaVersion: 1,
      highestUnlocked: 2,
    });
    expect(getReviewStateForTesting().gamesCompleted).toBe(reviewBefore + 1);
    expect(announced()).toBe(`Place 1 of 4. Bumps ${result.player.bumps}.`);
    // From the finishing step on, the board hears no key (§3).
    expect(fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' })).toBe(true);
    go();
    expect(raceState().status).toBe('finished');

    fireEvent.click(within(card).getByRole('button', { name: 'Next Level' }));
    expect(boardLabel()).toBe('Road Weave, level 2: ready');
  });

  it('second to fourth: Retry leads, no Next, the frontier stays, no review count', async () => {
    const api = mountScreens({ progress: 5 });
    act(() => api().startLevel(5));
    act(() => api().play());
    const reviewBefore = getReviewStateForTesting().gamesCompleted;
    act(() => api().finishRace(3, 2));
    await settle();
    const card = screen.getByRole('alertdialog', { name: 'Level 5 — 3/4' });
    expect(within(card).queryByRole('button', { name: 'Next Level' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Retry same board' })).toHaveFocus();
    expect(card.textContent).not.toMatch(/lost|fail|nice|great/i);
    expect(api().progress.highestUnlocked).toBe(5);
    expect(getReviewStateForTesting().gamesCompleted).toBe(reviewBefore);
    expect(announced()).toBe('Place 3 of 4. Bumps 2.');
    fireEvent.click(within(card).getByRole('button', { name: 'Levels' }));
    expect(screen.getByRole('heading', { name: 'Select Level' })).toBeInTheDocument();
    expect(api().session).toBeNull();
  });

  it('first place on Lv100 offers no Next, and the frontier says all cleared', async () => {
    const api = mountScreens({ progress: 100 });
    act(() => api().startLevel(100));
    act(() => api().play());
    act(() => api().finishRace(1, 0));
    await settle();
    const card = screen.getByRole('alertdialog', { name: 'Level 100 cleared' });
    expect(within(card).queryByRole('button', { name: 'Next Level' })).toBeNull();
    expect(api().progress.highestUnlocked).toBe(101);
  });

  it('a level that is not open falls back to the frontier', async () => {
    const api = mountScreens({ progress: 3 });
    act(() => api().startLevel(9));
    expect(api().session?.level).toBe(3);
  });

  it('a finish outside a running race is ignored', async () => {
    const api = mountScreens({ progress: 3 });
    act(() => api().startLevel(3));
    act(() => api().finishRace(1, 0));
    expect(api().lastResult).toBeNull();
    expect(api().progress.highestUnlocked).toBe(3);
  });
});

describe('the play clock (§9)', () => {
  function useClock() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'));
  }
  const pass = (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000);

  it('counts running only — not ready, not paused — and ← books it on the way home', async () => {
    useClock();
    await openRace();
    pass(30); // ready
    go();
    pass(12);
    fireEvent.click(topButton('Pause'));
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(12);
    pass(40); // paused
    go();
    pass(5);
    fireEvent.click(topButton('Home'));
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)).toEqual({
      schemaVersion: 1,
      played: 1,
      totalPlaySeconds: 17,
    });
    // The provider stayed; only the board went.
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeInTheDocument();
    expect(hasBoard()).toBe(false);
  });

  it('the browser’s Back (an unmount) books the race once, and a remount books nothing more', async () => {
    useClock();
    const { view } = await openRace();
    go();
    pass(9);
    view.unmount();
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)).toEqual({
      schemaVersion: 1,
      played: 1,
      totalPlaySeconds: 9,
    });
    pass(20);
    const again = await launch();
    pass(20);
    again.view.unmount();
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(9);
  });

  it('a hidden page books what ran and pauses; a later exit adds only what ran after', async () => {
    useClock();
    await openRace();
    go();
    pass(4);
    fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(4);
    expect(boardLabel()).toMatch(/paused$/);
    pass(60); // in the background
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Reflect.deleteProperty(document, 'visibilityState');
    expect(boardLabel()).toMatch(/paused$/);
    // ← was held when the page went: dropped, so the resumed target holds still.
    go();
    pump(2);
    const held = targetPx();
    pump(10);
    expect(targetPx()).toBe(held);
    pass(3);
    fireEvent.click(topButton('Retry same board'));
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(7);
    pass(50);
    fireEvent.click(topButton('Home'));
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(7);
  });

  it('a blur books what ran, and a later exit adds only what ran after', async () => {
    useClock();
    await openRace();
    go();
    pass(4);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(4);
    go();
    pass(3);
    fireEvent.click(topButton('Retry same board'));
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(7);
    // The fresh race starts its own clock at zero.
    pass(50);
    fireEvent.click(topButton('Home'));
    await settle();
    expect(stored<Stats>(OT_STORAGE_KEYS.stats)?.totalPlaySeconds).toBe(7);
  });

  it('the finish books the race and the result card adds nothing', async () => {
    useClock();
    const api = mountScreens();
    act(() => api().startLevel(1));
    act(() => api().play());
    pass(41);
    act(() => api().finishRace(2, 0));
    pass(30);
    act(() => api().retryRace());
    await settle();
    expect(api().stats).toEqual({ schemaVersion: 1, played: 1, totalPlaySeconds: 41 });
  });

  it('the statistics show races and total time, and no streak', async () => {
    taughtAlready();
    store(OT_STORAGE_KEYS.stats, { schemaVersion: 1, played: 12, totalPlaySeconds: 754 });
    store(OT_STORAGE_KEYS.progress, { schemaVersion: 1, highestUnlocked: 8 });
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    const body = document.querySelector('.stats-body')?.textContent ?? '';
    expect(body).toContain('7/100');
    expect(body).toContain('12');
    expect(body).toMatch(/12:34/);
    expect(body).not.toMatch(/streak|best|rank/i);
  });
});
