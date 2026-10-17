/**
 * Snake through its real screens (docs/SNAKE_RULES.md §2, §5, §6, §10–§13):
 * first run, the four input paths, Pause / Resume / Restart, background and
 * return, the result card, resuming a save, and what a corrupt save does.
 *
 * The tick is a real `setTimeout` chain in the provider, so these tests fake
 * the clock and move it by hand (docs/ARCHITECTURE.md「CI / リリース」: a
 * product timer is never waited on in real time). With the clock faked, a
 * board that moves nothing is also a board with nothing scheduled — which is
 * checked directly with `vi.getTimerCount()`.
 *
 * Saves go to Capacitor Preferences (mocked onto `deviceStore` below), and
 * every launch reads the same store, the way a player's phone does.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sounds } from '@/services/sound';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  BOARD_SIZE,
  cellAt,
  colOf,
  createSession,
  drawFood,
  INITIAL_BODY,
  MAX_SCORE,
  newSeedToken,
  pause,
  rowOf,
  snakeSeed,
  start,
  tick,
  TICK_MS,
  turn,
  type SnakeSession,
} from '../game';
import { cyclePilot, cycleSuccessors } from '../game/test-helpers';
import { toPersisted } from '../storage/gamePersistence';
import { SN_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { SnakeRoot } from './SnakeRoot';

const { deviceStore, writes } = vi.hoisted(() => ({
  deviceStore: new Map<string, string>(),
  /** Every key written, in order — what "never on a tick" is measured against. */
  writes: [] as string[],
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      writes.push(key);
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

const NORMAL = TICK_MS.normal;

/** Lets the local reads, and the saves they trigger, resolve (promises, not timers). */
async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

/** Moves the faked clock; every tick that falls due lands inside. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function taughtAlready() {
  deviceStore.set(
    SN_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
}

function storeRun(session: SnakeSession) {
  const record = toPersisted(session, 1);
  if (record === null) throw new Error('not a run worth saving');
  deviceStore.set(SN_STORAGE_KEYS.game, JSON.stringify(record));
}

async function launch(options: { entry?: 'shortcut'; onRender?: () => void } = {}) {
  const onExit = vi.fn();
  const tree = (
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      {/* A home-screen shortcut is the shell telling the root which door it used (issue #113). */}
      {options.entry === 'shortcut' ? (
        <SnakeRoot onExit={onExit} entry="shortcut" />
      ) : (
        <SnakeRoot onExit={onExit} />
      )}
    </SettingsProvider>
  );
  render(
    options.onRender ? (
      <Profiler id="snake" onRender={options.onRender}>
        {tree}
      </Profiler>
    ) : (
      tree
    ),
  );
  await settle();
  return { onExit };
}

/** The app goes to background (or comes back). */
function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const board = () => screen.getByRole('img', { name: /^Snake board/ });
const boardState = () => board().getAttribute('aria-label') ?? '';

/** The head's cell, read off the drawing. */
function head(): { row: number; col: number } {
  const shape = document.querySelector('.sn-head-shape');
  if (!shape) throw new Error('no head on the board');
  return {
    row: Math.floor(Number(shape.getAttribute('y'))),
    col: Math.floor(Number(shape.getAttribute('x'))),
  };
}

function foodCell(): number {
  const food = document.querySelector('.sn-food');
  if (!food) return -1;
  return cellAt(Number(food.getAttribute('cy')) - 0.5, Number(food.getAttribute('cx')) - 0.5);
}

const length = () => document.querySelectorAll('.sn-segment').length + 1;
const scoreShown = () => document.querySelector('.sn-score-value')?.textContent ?? '';
const announced = () => document.querySelector('.sn-live')?.textContent ?? '';
/** The line under the score in the top bar: the best and the speed, or "Paused". */
const topLine = () => document.querySelector('.sn-sub')?.textContent ?? '';
const pad = (name: string) =>
  within(screen.getByRole('group', { name: 'Controls' })).getByRole('button', { name });
/** The cross's middle button, whatever it is called right now. */
const toggle = () => document.querySelector<HTMLButtonElement>('.sn-pad-toggle')!;

/**
 * Nothing is laid over the board (§13): the box the board sits in holds the
 * board alone, so no part of it — the food, a coil, the chosen heading — can
 * be under anything while the run waits.
 */
function expectWholeBoardInView() {
  const wrap = document.querySelector('.sn-stage-wrap');
  expect(wrap).not.toBeNull();
  expect([...wrap!.children].map((child) => child.className)).toEqual(['sn-stage']);
  expect(document.querySelector('.sn-card, .sn-card-layer')).toBeNull();
}

function storedRun(): PersistedGame | null {
  const raw = deviceStore.get(SN_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
}

function storedStats(): Stats | null {
  const raw = deviceStore.get(SN_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

/** The opening snake moved `moves` cells right — the food kept off row 6 so nothing is eaten. */
function quietSeed(): string {
  for (let i = 0; ; i++) {
    const seed = `snake-ui-${i}`;
    if (rowOf(drawFood(seed, 0, INITIAL_BODY)) !== 6) return seed;
  }
}

function pausedAfter(moves: number, seed = quietSeed(), speed: SnakeSession['speed'] = 'normal') {
  let session = start(createSession(seed, speed));
  for (let i = 0; i < moves; i++) session = tick(session).session;
  return pause(session);
}

/**
 * A seed whose first food lies on row 6 ahead of the opening head, so moving
 * straight on eats it — and whose second food is on neither row 6 nor row 5,
 * so a run that goes on right after the point, or turns up once and then
 * right, eats nothing more on its way to the wall.
 */
function eatSeed(): string {
  for (let i = 0; ; i++) {
    const seed = `snake-ui-eat-${i}`;
    const food = drawFood(seed, 0, INITIAL_BODY);
    if (rowOf(food) !== 6 || colOf(food) <= 4) continue;
    const ate = tick(
      Array.from({ length: colOf(food) - 5 }).reduce<SnakeSession>(
        (run) => tick(run).session,
        start(createSession(seed)),
      ),
    ).session;
    if (ate.score === 1 && rowOf(ate.food) !== 6 && rowOf(ate.food) !== 5) return seed;
  }
}

/** Paused one cell short of the first food of `eatSeed`: Resume eats it. */
function pausedBeforeFood(seed = eatSeed()): SnakeSession {
  const food = drawFood(seed, 0, INITIAL_BODY);
  let session = start(createSession(seed));
  while (session.body[0]! + 1 !== food) session = tick(session).session;
  return pause(session);
}

beforeEach(() => {
  vi.useFakeTimers();
  writes.length = 0;
});

afterEach(async () => {
  cleanup();
  // An unmount writes the run it was showing (§11), through a promise chain:
  // let that land before the store is wiped, or it lands in the next test.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  vi.useRealTimers();
  vi.restoreAllMocks();
  deviceStore.clear();
});

describe('first run (§12)', () => {
  it('teaches in three pictured steps, then opens a ready board that waits', async () => {
    await launch();

    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Turn' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /about to turn up/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Eat' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Don’t crash' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /hit the wall/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();

    // The board is there before anything moves (§2): the opening snake,
    // its first food — the whole board, nothing laid over it — Start in the
    // cross, and nothing scheduled at all.
    expect(boardState()).toBe('Snake board, 14 by 14: ready to start');
    expect(head()).toEqual({ row: 6, col: 4 });
    expect(length()).toBe(3);
    expect(foodCell()).toBeGreaterThanOrEqual(0);
    expectWholeBoardInView();
    expect(pad('Start')).toBeInTheDocument();
    // No record yet: the speed alone, never "best 0" (§10).
    expect(topLine()).toBe('Normal');
    expect(vi.getTimerCount()).toBe(0);
    advance(5_000);
    expect(head()).toEqual({ row: 6, col: 4 });

    // The Quick Rules are remembered.
    expect(JSON.parse(deviceStore.get(SN_STORAGE_KEYS.flags)!)).toMatchObject({
      tutorialCompleted: true,
    });
  });
});

describe('Start, and the tick (§6, §13)', () => {
  it('moves one cell per interval only after Start', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    expect(boardState()).toMatch(/moving$/);
    expect(announced()).toBe('Started');
    // The first move is one interval after Start, not on the press.
    expect(head()).toEqual({ row: 6, col: 4 });
    advance(NORMAL - 1);
    expect(head()).toEqual({ row: 6, col: 4 });
    advance(1);
    expect(head()).toEqual({ row: 6, col: 5 });
    advance(NORMAL * 3);
    expect(head()).toEqual({ row: 6, col: 8 });
    // One timer, chained — never a stack of them.
    expect(vi.getTimerCount()).toBe(1);
  });

  it('starts on a direction too, heading that way from the first tick (§5)', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    advance(NORMAL);
    expect(head()).toEqual({ row: 5, col: 4 });
  });

  it('ignores straight back on a ready board and keeps waiting', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    // Left is straight back over the opening snake's neck: its button says so.
    expect(pad('Left')).toHaveAttribute('aria-disabled', 'true');
    expect(pad('Up')).not.toHaveAttribute('aria-disabled');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.pointerDown(pad('Left'), { pointerId: 1 });
    advance(NORMAL * 4);
    expect(boardState()).toMatch(/ready to start$/);
    expect(head()).toEqual({ row: 6, col: 4 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts a play when the board first moves, not when it is opened (§10)', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(storedStats()?.normal.played ?? 0).toBe(0);
    // Nothing was started, so nothing was saved either.
    expect(storedRun()).toBeNull();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await settle();
    expect(storedStats()?.normal.played).toBe(1);
  });
});

describe('the keyboard (§13)', () => {
  it('steers with W A S D by key position', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.keyDown(window, { key: 'w', code: 'KeyW' });
    advance(NORMAL);
    expect(head()).toEqual({ row: 5, col: 4 });
    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    advance(NORMAL);
    expect(head()).toEqual({ row: 5, col: 3 });
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    advance(NORMAL);
    expect(head()).toEqual({ row: 6, col: 3 });
  });

  it('pauses and resumes with Space and P, and a held key does not repeat', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    // The middle button names the keys that do what it does.
    expect(toggle()).toHaveAttribute('aria-keyshortcuts', 'Space P');
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(boardState()).toMatch(/moving$/);
    advance(NORMAL);
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });
    expect(boardState()).toMatch(/paused$/);
    // A repeat of the same key changes nothing.
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP', repeat: true });
    expect(boardState()).toMatch(/paused$/);
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(boardState()).toMatch(/moving$/);
  });

  it('leaves Space to a focused button, so one press starts the run once', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    const start = pad('Start');
    start.focus();
    expect(document.activeElement).toBe(start);
    // The game does not answer the Space a focused button is about to
    // answer itself — or the run would start here and the button's own
    // click would pause it again.
    expect(fireEvent.keyDown(start, { key: ' ', code: 'Space' })).toBe(true);
    expect(boardState()).toMatch(/ready to start$/);
    // The browser's activation of the focused button: one start.
    fireEvent.click(start);
    expect(boardState()).toMatch(/moving$/);
    advance(NORMAL);
    expect(head()).toEqual({ row: 6, col: 5 });
    await settle();
    expect(storedStats()!.normal.played).toBe(1);
  });

  it('a held arrow does not repeat a turn, and arrows never scroll the page', async () => {
    taughtAlready();
    storeRun(pausedAfter(2));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    fireEvent.click(pad('Resume'));
    const from = head();
    // Swallowed (the default is prevented) but not played: a repeat is a
    // held key, never a press.
    expect(fireEvent.keyDown(window, { key: 'ArrowUp', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(window, { key: 's', code: 'KeyS', repeat: true })).toBe(false);
    advance(NORMAL);
    expect(head()).toEqual({ row: from.row, col: from.col + 1 });
    // A real press is played, and its default prevented too.
    expect(fireEvent.keyDown(window, { key: 'ArrowDown' })).toBe(false);
    advance(NORMAL);
    expect(head()).toEqual({ row: from.row + 1, col: from.col + 1 });
    // A key the game does not use passes through untouched.
    expect(fireEvent.keyDown(window, { key: 'Tab' })).toBe(true);
  });
});

describe('a burst of presses never turns the snake straight back (§5)', () => {
  /** A run moving right, mid-board, a few cells in. */
  async function movingRight() {
    taughtAlready();
    storeRun(pausedAfter(2));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    fireEvent.click(pad('Resume'));
    advance(NORMAL);
    return head();
  }

  it('keys: up then left inside one tick is a U-turn over two ticks, not a crash into the neck', async () => {
    const start = await movingRight();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row - 1, col: start.col });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row - 1, col: start.col - 1 });
    expect(boardState()).toMatch(/moving$/);
  });

  it('keys: straight back, alone or after its opposite, is dropped', async () => {
    const start = await movingRight();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row, col: start.col + 1 });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row - 1, col: start.col + 1 });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row - 2, col: start.col + 1 });
    expect(boardState()).toMatch(/moving$/);
  });

  it('buttons: the same burst through the on-screen cross', async () => {
    const start = await movingRight();
    fireEvent.pointerDown(pad('Down'), { pointerId: 1 });
    fireEvent.pointerDown(pad('Left'), { pointerId: 2 });
    fireEvent.pointerDown(pad('Up'), { pointerId: 3 });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row + 1, col: start.col });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row + 1, col: start.col - 1 });
    advance(NORMAL);
    expect(head()).toEqual({ row: start.row, col: start.col - 1 });
    expect(boardState()).toMatch(/moving$/);
  });

  it('keys and buttons mixed, many presses in one tick: no two moves in a row are opposite', async () => {
    await movingRight();
    const presses: (() => void)[] = [
      () => fireEvent.keyDown(window, { key: 'ArrowUp' }),
      () => fireEvent.pointerDown(pad('Left'), { pointerId: 7 }),
      () => fireEvent.keyDown(window, { key: 'ArrowRight' }),
      () => fireEvent.pointerDown(pad('Down'), { pointerId: 8 }),
      () => fireEvent.keyDown(window, { key: 'ArrowLeft' }),
    ];
    const cells = [head()];
    for (let round = 0; round < 3; round++) {
      for (const press of presses) press();
      for (let i = 0; i < 4; i++) {
        advance(NORMAL);
        if (!/moving$/.test(boardState())) break;
        cells.push(head());
      }
      if (!/moving$/.test(boardState())) break;
    }
    // The snake can still die of a wall here, never of its own neck.
    expect(boardState()).not.toMatch(/game over$/);
    for (let i = 2; i < cells.length; i++) {
      expect(cells[i]).not.toEqual(cells[i - 2]);
    }
  });
});

describe('the swipe (§13)', () => {
  async function readyBoard() {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    return board();
  }

  it('enters the turn as soon as the finger has travelled 24px, before it lifts', async () => {
    const stage = await readyBoard();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 103, clientY: 80 });
    expect(boardState()).toMatch(/ready to start$/);
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 104, clientY: 75 });
    // Up, by the longer axis — and the run has started, the finger still down.
    expect(boardState()).toMatch(/moving$/);
    advance(NORMAL);
    expect(head()).toEqual({ row: 5, col: 4 });
    // The same finger keeps going: a turn right, measured from where the
    // first one fired.
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 130, clientY: 76 });
    advance(NORMAL);
    expect(head()).toEqual({ row: 5, col: 5 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 130, clientY: 76 });
  });

  it('a drag shorter than the threshold is no turn', async () => {
    const stage = await readyBoard();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100, clientY: 77 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 100, clientY: 77 });
    expect(boardState()).toMatch(/ready to start$/);
  });

  it('a cancel before the threshold enters nothing, and the board still hears the next swipe', async () => {
    const stage = await readyBoard();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100, clientY: 90 });
    fireEvent.pointerCancel(stage, { pointerId: 1 });
    // The cancelled finger's later moves belong to nobody.
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100, clientY: 40 });
    expect(boardState()).toMatch(/ready to start$/);

    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 100, clientY: 130 });
    advance(NORMAL);
    expect(head()).toEqual({ row: 7, col: 4 });
  });

  it('measures only the finger that pressed last', async () => {
    const stage = await readyBoard();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 200, clientY: 200 });
    // The first finger travels far, but it is not the one being measured.
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100, clientY: 20 });
    expect(boardState()).toMatch(/ready to start$/);
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 200, clientY: 240 });
    advance(NORMAL);
    expect(head()).toEqual({ row: 7, col: 4 });
  });

  it('a swipe across a paused board chooses the next heading, and does not resume', async () => {
    taughtAlready();
    storeRun(pausedAfter(2));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    const before = head();
    const stage = board();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100, clientY: 60 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 100, clientY: 60 });
    expect(boardState()).toMatch(/paused$/);
    expect(announced()).toBe('Next turn: Up');
    expect(document.querySelector('.sn-pending')).not.toBeNull();
    advance(NORMAL * 5);
    expect(head()).toEqual(before);
  });
});

describe('Pause and Resume (§6)', () => {
  it('stops the snake, schedules nothing, and moves again one interval after Resume', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    advance(NORMAL * 2);
    fireEvent.click(pad('Pause'));
    expect(boardState()).toMatch(/paused$/);
    expect(announced()).toMatch(/^Paused\. Score \d+$/);
    // Said in the top bar, in words — the board stays whole (§13).
    expect(topLine()).toBe('Paused');
    expectWholeBoardInView();
    const stopped = head();
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(head()).toEqual(stopped);

    fireEvent.click(pad('Resume'));
    expect(announced()).toBe('Resumed');
    // The best and the speed again (the random first food may have been eaten).
    expect(topLine()).toMatch(/Normal$/);
    advance(NORMAL - 1);
    expect(head()).toEqual(stopped);
    advance(1);
    expect(head()).toEqual({ row: stopped.row, col: stopped.col + 1 });
  });

  it('saves on Pause — never on a tick', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    await settle();
    // The start itself books the play (§10) — and from there on, nothing at
    // all is written while the snake moves: neither the run nor the stats.
    expect(writes).toEqual([SN_STORAGE_KEYS.stats]);
    writes.length = 0;
    advance(NORMAL * 4);
    await settle();
    expect(writes).toEqual([]);
    expect(storedRun()).toBeNull();
    fireEvent.click(pad('Pause'));
    await settle();
    expect(storedRun()).toMatchObject({ ticks: 4, speed: 'normal' });
    expect(writes).toContain(SN_STORAGE_KEYS.game);
  });

  it('shows and announces the heading chosen while paused, and takes it first on Resume (§5)', async () => {
    taughtAlready();
    storeRun(pausedAfter(2));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    const stopped = head();
    expect(document.querySelector('.sn-pending')).toBeNull();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.querySelector('.sn-pending')).not.toBeNull();
    expect(announced()).toBe('Next turn: Down');
    // Straight on cancels the choice; straight back is not one.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.querySelector('.sn-pending')).toBeNull();
    expect(announced()).toBe('Next turn cleared');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.querySelector('.sn-pending')).toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(announced()).toBe('Next turn: Up');
    advance(NORMAL * 5);
    expect(head()).toEqual(stopped);

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    advance(NORMAL);
    expect(head()).toEqual({ row: stopped.row - 1, col: stopped.col });
  });

  it('lays nothing over the board while paused, wherever the snake lies', async () => {
    taughtAlready();
    // A long snake (the cycle pilot to 40 points) coiled over most rows.
    const pilot = cyclePilot(cycleSuccessors());
    let session = start(createSession(quietSeed()));
    while (session.score < 40) session = tick(turn(session, pilot(session))).session;
    storeRun(pause(session));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    expect(boardState()).toMatch(/paused$/);
    expectWholeBoardInView();
    // Every cell of the snake and the food is drawn on the board.
    expect(length()).toBe(session.body.length);
    expect(foodCell()).toBe(session.food);
    // Start / Resume lives in the cross, not on the board.
    expect(pad('Resume')).toBeInTheDocument();
  });
});

describe('background and return (§6, §11)', () => {
  it('pauses and saves a moving run when hidden, and stays paused when it comes back', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    advance(NORMAL * 3);

    setVisibility('hidden');
    await settle();
    expect(boardState()).toMatch(/paused$/);
    expect(storedRun()).toMatchObject({ ticks: 3 });
    const stopped = head();

    setVisibility('visible');
    expect(boardState()).toMatch(/paused$/);
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(head()).toEqual(stopped);
    // Nothing that arrives right after the return moves it on its own.
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    advance(NORMAL * 3);
    expect(head()).toEqual(stopped);
  });

  it('pauses and saves when the window loses focus, and focus coming back moves nothing', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    advance(NORMAL * 2);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await settle();
    expect(boardState()).toMatch(/paused$/);
    expect(storedRun()).toMatchObject({ ticks: 2 });
    const stopped = head();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    advance(NORMAL * 5);
    expect(head()).toEqual(stopped);
    expect(vi.getTimerCount()).toBe(0);
    // A stopped run has nothing to lose to a blur: no second write.
    writes.length = 0;
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await settle();
    expect(writes).toEqual([]);
  });

  it('books only the seconds spent moving (§10)', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    // A second of moving right (six cells; the wall is nine away), then a
    // long pause, which is not play time.
    advance(1_000);
    fireEvent.click(pad('Pause'));
    advance(30_000);
    setVisibility('hidden');
    await settle();
    expect(storedRun()!.elapsedSeconds).toBe(1);
    expect(storedStats()!.normal.totalPlaySeconds).toBe(1);
  });

  it('keeps the part-second through Home and back (§10)', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    // 0.6 s right, Home, back, a turn down chosen, 0.6 s more: 1.2 s in all.
    advance(600);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    // Written floored (§11) …
    expect(storedRun()!.elapsedSeconds).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.click(pad('Resume'));
    advance(600);
    fireEvent.click(pad('Pause'));
    await settle();
    // … but the clock kept the fraction, so the two 0.6 s make a second.
    expect(storedRun()!.elapsedSeconds).toBe(1);
    expect(storedStats()!.normal.totalPlaySeconds).toBe(1);
  });
});

describe('leaving without a button (§11)', () => {
  it('an unmount mid-run writes the run as the paused run it becomes, and books its seconds', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(pad('Start'));
    advance(1_050);
    // The shell takes the game down (the web's own Back, say): no Home, no Pause.
    cleanup();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    const saved = storedRun();
    expect(saved).toMatchObject({ ticks: 7, elapsedSeconds: 1, speed: 'normal' });
    // Running is not a choice of heading: nothing queued is written as one.
    expect(saved).not.toHaveProperty('next');
    expect(storedStats()!.normal).toMatchObject({ played: 1, totalPlaySeconds: 1 });

    // The next launch offers it back, paused, where it stopped.
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    expect(boardState()).toMatch(/paused$/);
    expect(head()).toEqual({ row: 6, col: 11 });
  });
});

describe('Restart (§6)', () => {
  it('pauses the run while the question is open, and Cancel leaves it paused', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    // Nothing to restart on a board that never moved.
    expect(screen.getByRole('button', { name: 'Retry same board' })).toBeDisabled();
    fireEvent.click(pad('Start'));
    advance(NORMAL * 2);
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(boardState()).toMatch(/paused$/);
    expect(board().closest('[inert]')).not.toBeNull();
    const stopped = head();
    // The board behind the question does not hear the keyboard.
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    advance(NORMAL * 4);
    expect(head()).toEqual(stopped);

    // Both continuations are offered, as on the result card.
    expect(within(dialog).getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(board().closest('[inert]')).toBeNull();
    expect(boardState()).toMatch(/paused$/);
    // Focus goes back to the ↻ that asked, not to <body>.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry same board' }));
    advance(NORMAL * 4);
    expect(head()).toEqual(stopped);
  });

  it('Retry same board: the same opening, ready, and the thrown-away run does not come back', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    const firstFood = foodCell();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    advance(NORMAL * 3);
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    await settle();

    expect(boardState()).toMatch(/ready to start$/);
    expect(head()).toEqual({ row: 6, col: 4 });
    expect(foodCell()).toBe(firstFood);
    expect(storedRun()).toBeNull();
    // The ↻ is disabled on a ready board, so focus lands on Start.
    expect(document.activeElement).toBe(pad('Start'));

    // Leave without moving: no Continue, and no shortcut back into it.
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
    cleanup();
    await launch({ entry: 'shortcut' });
    expect(screen.queryByRole('img', { name: /^Snake board/ })).not.toBeInTheDocument();
    // (Its name carries the record once there is one: the random first food
    // can lie in the three cells the run went down.)
    expect(screen.getByRole('button', { name: /^New Game/ })).toBeInTheDocument();
  });

  it('Retry same board books the score of the run it throws away (§10)', async () => {
    taughtAlready();
    storeRun(pausedBeforeFood());
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    fireEvent.click(pad('Resume'));
    advance(NORMAL);
    expect(scoreShown()).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    await settle();
    expect(boardState()).toMatch(/ready to start$/);
    expect(scoreShown()).toBe('0');
    expect(storedStats()!.normal).toMatchObject({ bestScore: 1, cleared: 0 });
    expect(storedRun()).toBeNull();
    // The new board knows the record it is measured against.
    expect(topLine()).toBe('Best 1 · Normal');
  });

  it('New Game from the ↻: a fresh seed at the preferred speed, the old run booked and gone', async () => {
    taughtAlready();
    deviceStore.set(SN_STORAGE_KEYS.prefs, JSON.stringify({ schemaVersion: 1, speed: 'slow' }));
    const seed = eatSeed();
    storeRun(pausedBeforeFood(seed));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    fireEvent.click(pad('Resume'));
    advance(NORMAL);
    expect(scoreShown()).toBe('1');
    // The entropy is pinned, so the fresh seed's first food is known — and
    // chosen so that it is not the old seed's.
    const oldFood = drawFood(seed, 0, INITIAL_BODY);
    let fixed = 0.25;
    const freshFood = () =>
      drawFood(snakeSeed(newSeedToken(Date.now(), () => fixed)), 0, INITIAL_BODY);
    while (freshFood() === oldFood) fixed += 0.1;
    vi.spyOn(Math, 'random').mockReturnValue(fixed);
    const expected = freshFood();

    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'New Game' }),
    );
    await settle();
    expect(boardState()).toMatch(/ready to start$/);
    expect(foodCell()).toBe(expected);
    expect(storedStats()!.normal).toMatchObject({ bestScore: 1 });
    expect(storedRun()).toBeNull();
    expect(document.activeElement).toBe(pad('Start'));
    // The preference's speed, as the home's New Game.
    expect(topLine()).toBe('Slow');
    fireEvent.click(pad('Start'));
    advance(TICK_MS.slow - 1);
    expect(head()).toEqual({ row: 6, col: 4 });
    advance(1);
    expect(head()).toEqual({ row: 6, col: 5 });
  });
});

describe('the end of a run (§4, §10)', () => {
  it('a wall: the × on the head, the result card, the slot removed, no key heard', async () => {
    taughtAlready();
    // Two cells from the right wall, facing it.
    storeRun(pausedAfter(7));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    expect(storedRun()).not.toBeNull();
    fireEvent.click(pad('Resume'));
    advance(NORMAL * 3);
    await settle();

    expect(boardState()).toMatch(/game over$/);
    expect(document.querySelector('.sn-crash')).not.toBeNull();
    const card = screen.getByRole('alertdialog', { name: 'Game over' });
    expect(within(card).getByText('The snake hit the wall.')).toBeInTheDocument();
    expect(within(card).getByText('Length')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Share/ })).toBeInTheDocument();
    expect(announced()).toBe('Game over: the snake hit the wall. Score 0');
    expect(board().closest('[inert]')).not.toBeNull();
    expect(storedRun()).toBeNull();
    // A finished run schedules nothing and hears no key. (The card's
    // autofocus leaves jsdom one 0ms selection timer of its own; let it go.)
    advance(NORMAL * 4);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(boardState()).toMatch(/game over$/);

    fireEvent.click(within(card).getByRole('button', { name: 'Retry same board' }));
    expect(boardState()).toMatch(/ready to start$/);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // The card's button went with the card: focus goes to Start, not <body>.
    expect(document.activeElement).toBe(pad('Start'));
  });

  it('a crash with points books the best at that speed; a restored run is not a new play', async () => {
    taughtAlready();
    const select = vi.spyOn(sounds, 'select');
    const gameOver = vi.spyOn(sounds, 'gameOver');
    const clear = vi.spyOn(sounds, 'clear');
    storeRun(pausedBeforeFood());
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    fireEvent.click(pad('Resume'));
    advance(NORMAL);
    expect(scoreShown()).toBe('1');
    // Eating is the one short sound; a turn is silent.
    expect(select).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    advance(NORMAL);
    expect(select).toHaveBeenCalledTimes(1);
    expect(gameOver).not.toHaveBeenCalled();
    // On to the right-hand wall.
    advance(NORMAL * BOARD_SIZE);
    await settle();
    expect(boardState()).toMatch(/game over$/);
    expect(gameOver).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();

    const card = screen.getByRole('alertdialog', { name: 'Game over' });
    expect(within(card).getByText(/New best at Normal/)).toBeInTheDocument();
    // Booked: the best is the run's score, and the play was counted when
    // the run began — in the launch that saved it, not again on its resume.
    expect(storedStats()!.normal).toMatchObject({ played: 0, bestScore: 1, cleared: 0 });
    expect(storedRun()).toBeNull();

    // The card's other way on: a fresh board at once.
    fireEvent.click(within(card).getByRole('button', { name: 'New Game' }));
    expect(boardState()).toMatch(/ready to start$/);
    expect(scoreShown()).toBe('0');
    expect(document.activeElement).toBe(pad('Start'));
  });

  it('a full board: cleared, counted, shared as completed', async () => {
    taughtAlready();
    const clear = vi.spyOn(sounds, 'clear');
    const gameOver = vi.spyOn(sounds, 'gameOver');
    // The cycle pilot to one food short of full, then on until the last food
    // is the cell straight ahead of the head.
    const pilot = cyclePilot(cycleSuccessors());
    let session = start(createSession('snake-ui-full'));
    while (session.score < MAX_SCORE - 1) session = tick(turn(session, pilot(session))).session;
    for (;;) {
      const next = turn(session, pilot(session));
      const ahead = tick(next).session;
      if (ahead.status === 'cleared') break;
      session = ahead;
    }
    const nextDirection = pilot(session);
    storeRun(pause(session));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    expect(scoreShown()).toBe(String(MAX_SCORE - 1));
    if (nextDirection !== session.direction) {
      fireEvent.keyDown(window, {
        key: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[
          nextDirection
        ],
      });
    }
    fireEvent.click(pad('Resume'));
    advance(NORMAL);
    await settle();

    expect(boardState()).toMatch(/board filled$/);
    expect(foodCell()).toBe(-1);
    const card = screen.getByRole('alertdialog', { name: 'Board filled' });
    expect(within(card).getByText(String(BOARD_SIZE * BOARD_SIZE))).toBeInTheDocument();
    expect(storedStats()!.normal).toMatchObject({ cleared: 1, bestScore: MAX_SCORE });
    expect(storedRun()).toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(gameOver).not.toHaveBeenCalled();
  });
});

describe('a suspended run (§11)', () => {
  it('is offered back on the home with its score and speed, and returns paused', async () => {
    taughtAlready();
    storeRun(pausedAfter(3, quietSeed(), 'fast'));
    await launch();
    const resume = screen.getByRole('button', { name: /Resume/ });
    expect(resume).toHaveTextContent('Score 0 · Fast');
    fireEvent.click(resume);
    expect(boardState()).toMatch(/paused$/);
    expect(head()).toEqual({ row: 6, col: 7 });
    expect(topLine()).toBe('Paused');
    advance(5_000);
    expect(head()).toEqual({ row: 6, col: 7 });
    fireEvent.click(pad('Resume'));
    // Its own speed, and no record at it yet: the speed alone.
    expect(topLine()).toBe('Fast');
    // Its own speed, not the preference's.
    advance(TICK_MS.fast);
    expect(head()).toEqual({ row: 6, col: 8 });
  });

  it('a corrupt save lands on the home with nothing to resume — no new run is dealt', async () => {
    taughtAlready();
    deviceStore.set(SN_STORAGE_KEYS.game, '{"schemaVersion":1,"seed":"snake-x","body":"2g2f');
    await launch();
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Snake board/ })).not.toBeInTheDocument();
    expect(storedStats()).toBeNull();
  });

  it('an impossible save lands on the home too, even through a shortcut', async () => {
    taughtAlready();
    const record = toPersisted(pausedAfter(3), 1)!;
    deviceStore.set(SN_STORAGE_KEYS.game, JSON.stringify({ ...record, score: 5 }));
    await launch({ entry: 'shortcut' });
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Snake board/ })).not.toBeInTheDocument();
  });

  it('a new run over it asks first, books its score, and removes it', async () => {
    taughtAlready();
    // Two foods eaten, by the cycle pilot.
    const pilot = cyclePilot(cycleSuccessors());
    let session = start(createSession('snake-ui-replace'));
    while (session.score < 2) session = tick(turn(session, pilot(session))).session;
    storeRun(pause(session));
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start a new game?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start' }));
    await settle();
    expect(boardState()).toMatch(/ready to start$/);
    expect(storedRun()).toBeNull();
    expect(storedStats()!.normal.bestScore).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
  });

  it('a shortcut opens straight onto it, paused; one step back is this game’s home', async () => {
    taughtAlready();
    storeRun(pausedAfter(3));
    const { onExit } = await launch({ entry: 'shortcut' });
    expect(boardState()).toMatch(/paused$/);
    expect(head()).toEqual({ row: 6, col: 7 });
    advance(5_000);
    expect(head()).toEqual({ row: 6, col: 7 });
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('a shortcut still teaches the game first on a launch that never saw Quick Rules', async () => {
    storeRun(pausedAfter(3));
    await launch({ entry: 'shortcut' });
    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
  });

  it('Quick Rules over a run that outlived its flags lead back onto that run, not over it', async () => {
    // `sn.flags` lost, `sn.saveGame` intact: the first-run steps show, and
    // their last button must not throw the run away unasked (§6, §11, §12).
    deviceStore.set(SN_STORAGE_KEYS.flags, 'garbage');
    storeRun(pausedAfter(3));
    await launch();
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(boardState()).toMatch(/paused$/);
    expect(head()).toEqual({ row: 6, col: 7 });
    expect(storedRun()).toMatchObject({ ticks: 3 });
    expect(storedStats()).toBeNull();
    expect(JSON.parse(deviceStore.get(SN_STORAGE_KEYS.flags)!)).toMatchObject({
      tutorialCompleted: true,
    });
    // One tap from moving, as after any first run.
    fireEvent.click(pad('Resume'));
    advance(NORMAL);
    expect(head()).toEqual({ row: 6, col: 8 });
  });

  it('keeps the suspended run’s clock when backgrounded from the home (issue #109)', async () => {
    taughtAlready();
    storeRun({ ...pausedAfter(3), elapsedSeconds: 41 });
    await launch();
    setVisibility('hidden');
    await settle();
    expect(storedRun()!.elapsedSeconds).toBe(41);
    expect(storedStats()?.normal.totalPlaySeconds ?? 0).toBe(0);
  });
});

describe('home and statistics (§7, §10)', () => {
  it('starts at Normal without asking, and remembers a speed once picked', async () => {
    taughtAlready();
    await launch();
    const speeds = screen.getByRole('group', { name: 'Speed' });
    expect(within(speeds).getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(speeds).getByRole('button', { name: 'Fast' }));
    await settle();
    expect(JSON.parse(deviceStore.get(SN_STORAGE_KEYS.prefs)!)).toEqual({
      schemaVersion: 1,
      speed: 'fast',
    });
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(topLine()).toBe('Fast');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    advance(TICK_MS.fast);
    expect(head()).toEqual({ row: 7, col: 4 });

    cleanup();
    await launch();
    expect(
      within(screen.getByRole('group', { name: 'Speed' })).getByRole('button', { name: 'Fast' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('lists the records per speed, and no streak', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    for (const name of ['Slow', 'Normal', 'Fast']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Best score')).toHaveLength(3);
    expect(screen.getAllByText('Boards filled')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('exits to the collection from its home', async () => {
    taughtAlready();
    const { onExit } = await launch();
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('a stopped board draws nothing (§13)', () => {
  it('renders nothing while paused, however long it waits', async () => {
    taughtAlready();
    storeRun(pausedAfter(2));
    const onRender = vi.fn();
    await launch({ onRender });
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    await settle();
    expect(boardState()).toMatch(/paused$/);
    onRender.mockClear();
    advance(20_000);
    expect(onRender).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('renders nothing while ready, however long it waits', async () => {
    taughtAlready();
    const onRender = vi.fn();
    await launch({ onRender });
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await settle();
    expect(boardState()).toMatch(/ready to start$/);
    onRender.mockClear();
    advance(20_000);
    expect(onRender).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the score (§7, §13)', () => {
  it('shows and announces a point when a food is eaten', async () => {
    taughtAlready();
    // Paused one cell before the first food, on row 6: Resume eats it.
    storeRun(pausedBeforeFood());
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    expect(scoreShown()).toBe('0');
    fireEvent.click(pad('Resume'));
    advance(NORMAL);
    expect(scoreShown()).toBe('1');
    expect(length()).toBe(4);
    expect(announced()).toBe('Score 1');
  });
});
