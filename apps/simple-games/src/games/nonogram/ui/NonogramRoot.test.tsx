import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession, PAINTED } from '../game';
import { NG_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { LONG_PRESS_MS } from './components/NonoBoard';
import { NonogramRoot } from './NonogramRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to read
 * back what a save actually wrote has to stand behind both.
 */
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

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NonogramRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [NG_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Nonogram board/ });
const cellAt = (row: number, col: number) =>
  within(board()).getByRole('button', { name: new RegExp(`row ${row}, column ${col}$`) });
const markAt = (row: number, col: number) => cellAt(row, col).getAttribute('aria-label') ?? '';

/** A pretend cell, in CSS pixels. Level 1 is a 5×5 (§6). */
const CELL_PX = 40;
const LEVEL_ONE_SIZE = 5;

/**
 * jsdom lays nothing out, so a drag is measured against a rectangle handed to
 * the cell grid by force. Gutters are left out of it on purpose: the board
 * divides the rectangle by the size, which is the same approximation.
 */
function giveCellsALayout(size = LEVEL_ONE_SIZE): void {
  const cells = board().querySelector('.nono-cells');
  const side = CELL_PX * size;
  vi.spyOn(cells as Element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: side,
    height: side,
    right: side,
    bottom: side,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/** The middle of one cell, so rounding cannot pick a neighbour. */
const pointAt = (row: number, col: number) => ({
  clientX: CELL_PX * (col - 1 + 0.5),
  clientY: CELL_PX * (row - 1 + 0.5),
});

type Coord = readonly [row: number, col: number];

/**
 * One finger: press on the first cell, travel through the rest, lift on the
 * last. The click a real gesture leaves behind is fired too — every drag here
 * therefore also proves it does not act a second time. That click carries the
 * click count a browser gives it (`detail`), which is how the board tells it
 * apart from a keyboard activation (§3).
 */
function drag(path: readonly Coord[], pointerId = 1): void {
  const origin = cellAt(...path[0]!);
  fireEvent.pointerDown(origin, { pointerId, ...pointAt(...path[0]!) });
  for (const step of path.slice(1)) {
    fireEvent.pointerMove(origin, { pointerId, ...pointAt(...step) });
  }
  fireEvent.pointerUp(origin, { pointerId, ...pointAt(...path[path.length - 1]!) });
  fireEvent.click(origin, { detail: 1 });
}

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NonogramRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

/** Lets the local reads and the saves they trigger resolve (they are promises,
 * not timers, so this works under fake timers too). */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

/** Total play seconds as they survive on disk, across every board size. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(NG_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.size5.totalPlaySeconds + stats.size10.totalPlaySeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('backgrounding (§10)', () => {
  // Play five minutes, background the app, let Android kill it, come back: the
  // board returns, and so must the five minutes. The session save alone cannot
  // carry them — `activate` treats a restored session's elapsedSeconds as
  // already counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(NG_STORAGE_KEYS.flags, tutorialDone[NG_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once: the restored five are neither
      // lost nor booked a second time.
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Numbers are runs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Cross out what cannot be')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Satisfy every line')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is a 5×5: twenty-five cells, all blank.
    expect(within(board()).getAllByRole('button')).toHaveLength(25);
    expect(within(board()).getAllByRole('button', { name: /^Blank/ })).toHaveLength(25);
  });
});

describe('playing (§2, §3)', () => {
  it('paints on tap, and the same tap takes it back', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(cellAt(1, 1));
    expect(cellAt(1, 1).getAttribute('aria-label')).toMatch(/^Painted/);
    await user.click(cellAt(1, 1));
    expect(cellAt(1, 1).getAttribute('aria-label')).toMatch(/^Blank/);
  });

  it('crosses on tap while X mode is on, and shows the mode on the toggle', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const toggle = screen.getByRole('button', { name: 'X Mode' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(cellAt(2, 3));
    expect(cellAt(2, 3).getAttribute('aria-label')).toMatch(/^Crossed/);
  });

  it('solves level 1 by painting its solution, and celebrates once (§2)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The level is deterministic (§6), so the test can know the answer the
    // same way every player's device does.
    const truth = createLevelSession(1);
    for (let index = 0; index < truth.solution.length; index++) {
      if (truth.solution[index] !== PAINTED) continue;
      const row = Math.floor(index / truth.size) + 1;
      const col = (index % truth.size) + 1;
      await user.click(cellAt(row, col));
    }

    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
  });
});

describe('drag strokes (issue #108)', () => {
  it('paints every cell the finger crosses, and the click that follows adds nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    drag([
      [1, 1],
      [1, 2],
      [1, 3],
    ]);

    expect(markAt(1, 1)).toMatch(/^Painted/);
    expect(markAt(1, 2)).toMatch(/^Painted/);
    expect(markAt(1, 3)).toMatch(/^Painted/);
    // The cell the stroke began on is painted once, not painted and undone.
    expect(markAt(1, 4)).toMatch(/^Blank/);
  });

  it('fills the cells a flick skipped over, not just the ones it landed on', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    // One move, four cells: the whole run is painted, gaps included.
    drag([
      [3, 1],
      [3, 5],
    ]);

    for (let col = 1; col <= 5; col++) expect(markAt(3, col)).toMatch(/^Painted/);
  });

  it('erases a run when the stroke starts on a painted cell', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    drag([
      [2, 1],
      [2, 2],
      [2, 3],
    ]);
    expect(markAt(2, 2)).toMatch(/^Painted/);

    drag([
      [2, 1],
      [2, 2],
      [2, 3],
    ]);
    for (let col = 1; col <= 3; col++) expect(markAt(2, col)).toMatch(/^Blank/);
  });

  it('crosses a run while X mode is on, and erases one it starts on', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    await user.click(screen.getByRole('button', { name: 'X Mode' }));
    giveCellsALayout();

    drag([
      [4, 2],
      [4, 3],
      [4, 4],
    ]);
    for (let col = 2; col <= 4; col++) expect(markAt(4, col)).toMatch(/^Crossed/);

    drag([
      [4, 2],
      [4, 3],
      [4, 4],
    ]);
    for (let col = 2; col <= 4; col++) expect(markAt(4, col)).toMatch(/^Blank/);
  });

  it('leaves a cell as the stroke set it when the same stroke comes back over it', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    drag([
      [1, 1],
      [1, 2],
      [1, 1],
      [1, 2],
    ]);

    expect(markAt(1, 1)).toMatch(/^Painted/);
    expect(markAt(1, 2)).toMatch(/^Painted/);
  });

  it('paints only the part of its path that was on the board', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    const origin = cellAt(1, 1);
    fireEvent.pointerDown(origin, { pointerId: 1, ...pointAt(1, 1) });
    // Off the grid entirely, then back onto a cell two rows down.
    fireEvent.pointerMove(origin, { pointerId: 1, clientX: -400, clientY: -400 });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(3, 1) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(3, 1) });
    fireEvent.click(origin, { detail: 1 });

    expect(markAt(1, 1)).toMatch(/^Painted/);
    expect(markAt(3, 1)).toMatch(/^Painted/);
  });

  it('keeps what a cancelled stroke had written, and takes taps afterwards', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    const origin = cellAt(5, 1);
    fireEvent.pointerDown(origin, { pointerId: 1, ...pointAt(5, 1) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(5, 2) });
    // The system takes the gesture away — a call, a system gesture, a pinch.
    fireEvent.pointerCancel(origin, { pointerId: 1, ...pointAt(5, 2) });

    expect(markAt(5, 1)).toMatch(/^Painted/);
    expect(markAt(5, 2)).toMatch(/^Painted/);

    // The board is not stuck in a stroke: the next tap is an ordinary tap.
    await user.click(cellAt(5, 3));
    expect(markAt(5, 3)).toMatch(/^Painted/);
    await user.click(cellAt(5, 1));
    expect(markAt(5, 1)).toMatch(/^Blank/);
  });

  it('keeps every cell when two moves land in one render', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    // Both moves inside one act(): React coalesces the two updates, which is
    // what a slow device does with two pointer moves in one frame. The second
    // move must build on the first, not on the board it replaced.
    const origin = cellAt(4, 1);
    fireEvent.pointerDown(origin, { pointerId: 1, ...pointAt(4, 1) });
    act(() => {
      fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(4, 2) });
      fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(4, 3) });
    });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(4, 3) });
    fireEvent.click(origin, { detail: 1 });

    for (let col = 1; col <= 3; col++) expect(markAt(4, col)).toMatch(/^Painted/);
  });

  it('is still a tap when the press never leaves its cell', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    // A tremor inside one cell, then a release: one toggle, from the click.
    const origin = cellAt(2, 2);
    fireEvent.pointerDown(origin, { pointerId: 1, ...pointAt(2, 2) });
    fireEvent.pointerMove(origin, { pointerId: 1, clientX: CELL_PX * 1.6, clientY: CELL_PX * 1.6 });
    fireEvent.pointerUp(origin, { pointerId: 1, clientX: CELL_PX * 1.6, clientY: CELL_PX * 1.6 });
    fireEvent.click(origin, { detail: 1 });

    expect(markAt(2, 2)).toMatch(/^Painted/);
  });

  it('crosses on a long press, and the click that follows does not paint over it', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    vi.useFakeTimers();
    try {
      // Held past the timer, then let go without moving. The click a release
      // leaves behind names the same cell, and painting on it would take the
      // cross the player just watched appear straight back off.
      const origin = cellAt(5, 5);
      fireEvent.pointerDown(origin, { pointerId: 1, ...pointAt(5, 5) });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(5, 5) });
      fireEvent.click(origin, { detail: 1 });
    } finally {
      vi.useRealTimers();
    }

    expect(markAt(5, 5)).toMatch(/^Crossed/);
  });

  it('crosses on a long press, and carries on crossing if the finger then moves', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    vi.useFakeTimers();
    try {
      const origin = cellAt(1, 1);
      fireEvent.pointerDown(origin, { pointerId: 1, ...pointAt(1, 1) });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      expect(markAt(1, 1)).toMatch(/^Crossed/);

      // Still held: the drag continues what the long press started rather
      // than painting over it.
      fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(1, 2) });
      fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(1, 2) });
      fireEvent.click(origin, { detail: 1 });

      expect(markAt(1, 1)).toMatch(/^Crossed/);
      expect(markAt(1, 2)).toMatch(/^Crossed/);
    } finally {
      vi.useRealTimers();
    }
  });
});

/* The right button is the second mark without the mode (§3, issue #112). The
   event orders below are the browsers' own: Windows raises the context menu
   after the button comes back up and macOS raises it on the way down, but
   neither delivers a click for the right button — while macOS's ctrl+click
   raises the menu from the primary button and does deliver one. */
describe('right click (§3, issue #112)', () => {
  /**
   * Raises the context menu and insists it was cancelled — a cancelled
   * contextmenu is the whole of "no browser menu over the board" (§3).
   * fireEvent hands back what dispatchEvent returned, which is false exactly
   * when something called preventDefault on it.
   */
  function contextMenu(target: HTMLElement, init: Record<string, unknown>) {
    expect(fireEvent.contextMenu(target, init)).toBe(false);
  }

  /** A right click as a browser delivers it. No click event ever follows one. */
  function rightClick(cell: HTMLElement) {
    fireEvent.pointerDown(cell, { button: 2, pointerType: 'mouse' });
    contextMenu(cell, { button: 2 });
    fireEvent.pointerUp(cell, { button: 2, pointerType: 'mouse' });
  }

  /** macOS ctrl+click: the primary button raises the menu, and a click follows. */
  function ctrlClick(cell: HTMLElement) {
    fireEvent.pointerDown(cell, { button: 0, pointerType: 'mouse', ctrlKey: true });
    contextMenu(cell, { button: 0, ctrlKey: true });
    fireEvent.pointerUp(cell, { button: 0, pointerType: 'mouse', ctrlKey: true });
    fireEvent.click(cell, { button: 0, ctrlKey: true, detail: 1 });
  }

  it('crosses a blank cell, takes the cross back off, and never paints', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    rightClick(cellAt(1, 1));
    expect(markAt(1, 1)).toMatch(/^Crossed/);

    // A second one takes it back: one right click is one action, never two.
    rightClick(cellAt(1, 1));
    expect(markAt(1, 1)).toMatch(/^Blank/);
  });

  it('crosses over paint, the way the tap and the long press do (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(cellAt(2, 2));
    expect(markAt(2, 2)).toMatch(/^Painted/);

    rightClick(cellAt(2, 2));
    expect(markAt(2, 2)).toMatch(/^Crossed/);
  });

  it('still crosses in X mode: the button means one thing (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    await user.click(screen.getByRole('button', { name: 'X Mode' }));

    // X mode swaps what the tap and the long press do; the right button does
    // not follow it there, or a right click would mean two different things.
    rightClick(cellAt(3, 3));
    expect(markAt(3, 3)).toMatch(/^Crossed/);
    rightClick(cellAt(3, 3));
    expect(markAt(3, 3)).toMatch(/^Blank/);
  });

  it('acts once when the button is held down (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    vi.useFakeTimers();
    try {
      // Windows raises the menu only once the button comes back up. A long
      // press armed on the way down would therefore cross on its own timer and
      // the menu would take the cross straight back off — so none is armed.
      fireEvent.pointerDown(cellAt(4, 4), { button: 2, pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 20));
      fireEvent.pointerUp(cellAt(4, 4), { button: 2, pointerType: 'mouse' });
      contextMenu(cellAt(4, 4), { button: 2 });
    } finally {
      vi.useRealTimers();
    }
    expect(markAt(4, 4)).toMatch(/^Crossed/);
  });

  it('acts once when a click follows the menu (macOS ctrl+click)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    ctrlClick(cellAt(5, 5));
    // The menu crossed it; the click that came after must not paint it as well.
    expect(markAt(5, 5)).toMatch(/^Crossed/);

    ctrlClick(cellAt(5, 5));
    expect(markAt(5, 5)).toMatch(/^Blank/);
  });

  it('draws nothing when the right button is held and dragged (issue #108)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    const origin = cellAt(1, 1);
    fireEvent.pointerDown(origin, {
      button: 2,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(1, 1),
    });
    contextMenu(origin, { button: 2 });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(1, 2) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(1, 3) });
    fireEvent.pointerUp(origin, {
      button: 2,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(1, 3),
    });

    // The one cell the menu crossed, and nothing along the way.
    expect(markAt(1, 1)).toMatch(/^Crossed/);
    expect(markAt(1, 2)).toMatch(/^Blank/);
    expect(markAt(1, 3)).toMatch(/^Blank/);
  });

  it('paints nothing over the cross when a ctrl+click then drags (issue #108)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    giveCellsALayout();

    // The primary button did arm a stroke on the way down, so the menu has to
    // drop it: a hand that moves before letting go must not paint over the
    // cross it just asked for.
    const origin = cellAt(2, 1);
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerType: 'mouse',
      ctrlKey: true,
      pointerId: 1,
      ...pointAt(2, 1),
    });
    contextMenu(origin, { button: 0, ctrlKey: true });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(2, 2) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(2, 2) });

    expect(markAt(2, 1)).toMatch(/^Crossed/);
    expect(markAt(2, 2)).toMatch(/^Blank/);
  });

  it('keeps the cross a touch long press just made (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    vi.useFakeTimers();
    try {
      // Chrome on Android raises a context menu of its own at the end of a
      // long press, later than the 450ms that crossed the cell. Crossing there
      // as well would take the cross straight back off, on every long press a
      // touch player makes.
      fireEvent.pointerDown(cellAt(3, 1), { button: 0, pointerType: 'touch', pointerId: 1 });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
      expect(markAt(3, 1)).toMatch(/^Crossed/);

      contextMenu(cellAt(3, 1), { button: 0 });
      fireEvent.pointerUp(cellAt(3, 1), { button: 0, pointerType: 'touch', pointerId: 1 });
    } finally {
      vi.useRealTimers();
    }
    expect(markAt(3, 1)).toMatch(/^Crossed/);
  });

  it('leaves the keyboard its own turn on the cell it just crossed', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const target = cellAt(4, 1);
    rightClick(target);
    expect(markAt(4, 1)).toMatch(/^Crossed/);

    // A right click leaves no click behind on most platforms, so nothing comes
    // to clear what it handled. The next Enter is not that click, and must not
    // be mistaken for it — a keyboard player would just see the cell ignore
    // them. userEvent gives it the empty click count a real key press has.
    target.focus();
    await user.keyboard('{Enter}');
    expect(markAt(4, 1)).toMatch(/^Painted/);
  });

  it('opens no browser menu over the board, cells or not (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The gaps between cells are a target too: crossing fast with the right
    // button, a click that misses by a pixel would otherwise open the native
    // menu over the board the player is reading.
    contextMenu(board(), { button: 2 });
    contextMenu(board().querySelector('.nono-cells') as HTMLElement, { button: 2 });
    contextMenu(cellAt(1, 1), { button: 2 });
  });
});

describe('hints (§7)', () => {
  it('offers a free hint with the line that proves it', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent('The highlighted line decides a square.');
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no undo — every mark is its own undo (§7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports per-size facts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    expect(screen.getByText('5×5')).toBeInTheDocument();
    expect(screen.getByText('10×10')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers both modes and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('free play (§6)', () => {
  it('starts a board at the chosen tier, and resumes it from the home', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Level 1/ });

    // The picker stands on medium until told otherwise; here, hard.
    const picker = screen.getByRole('group', { name: 'Difficulty' });
    await user.click(within(picker).getByRole('button', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: /Free Play/ }));

    // The top bar names the mode and the size — no level number, no clock.
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
    // Hard is level 95's shape: a 10×10, a hundred blank cells.
    expect(within(board()).getAllByRole('button', { name: /^Blank/ })).toHaveLength(100);

    // A mark, then away and back: the board is where it was left.
    await user.click(cellAt(1, 1));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume.*Hard/ })).toBeInTheDocument();
    // The level climb is untouched by a free board.
    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(cellAt(1, 1).getAttribute('aria-label')).toMatch(/^Painted/);
  });

  it('asks before replacing a suspended free board with a new one', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handler (issue #93): this
   checks board state the Hint button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('H asks for the hint, same as the Hint button', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent('The highlighted line decides a square.');
  });
});
