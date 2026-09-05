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

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(NG_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
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

/**
 * A pinned home-screen shortcut, and what Nonogram does about it (issue #113).
 * The shell says only which door was used; every decision below is this
 * game's, taken from its own three save slots (§10).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut() {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <NonogramRoot onExit={vi.fn()} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(NG_STORAGE_KEYS.flags, tutorialDone[NG_STORAGE_KEYS.flags]!);
  }

  const anyBoard = () => screen.queryByRole('group', { name: /Nonogram board/ });
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  /** Opens level 1 and steps back off it, which is what suspends it (§10). */
  async function suspendLevelOne(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
  }

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(anyBoard()).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  it('opens a suspended free board too, not the level slot behind it', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();

    // The board reads whichever slot is active, so the resumed mode has to
    // arrive selected — 'level' is empty here, and would render nothing.
    expect(anyBoard()).toBeInTheDocument();
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
  });

  it('opens a suspended daily just as readily as a level', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    // The daily is the slot most easily forgotten: it is not the one the home
    // screen leads with, and a rule that counted only two of the three would
    // both miss this board and mistake a level+daily pair for a single answer.
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();

    expect(anyBoard()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <NonogramRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — nothing was chosen for
    // the player, and nothing was thrown away either.
    expect(anyBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });

  it('counts the daily as one of the two, rather than picking the level', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    await suspendLevelOne(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // A pair is a pair whichever two slots it is made of: the daily is not a
    // lesser board that a level beside it may be assumed to outrank.
    expect(anyBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(anyBoard()).not.toBeInTheDocument();
    expect(home()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    launch();
    await settle();

    expect(anyBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    const user = userEvent.setup();
    // A suspended board AND no Quick Rules behind the player. The two can
    // only meet through "Reset Local Data", which wipes the flags and leaves
    // the saves — but the test has to arrange it, because a launch with an
    // empty store would land on the tutorial whatever the gate said.
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();
    deviceStore.delete(NG_STORAGE_KEYS.flags);

    launchFromShortcut();

    // Quick Rules first: a shortcut is not a way past them (§11).
    expect(await screen.findByText('Numbers are runs')).toBeInTheDocument();
    expect(anyBoard()).not.toBeInTheDocument();
  });

  /** The level slot's elapsed seconds as they survive on disk. */
  function storedLevelSeconds(): number {
    const raw = deviceStore.get(NG_STORAGE_KEYS.game);
    if (raw === undefined) return 0;
    return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
  }

  // The counterpart of the backgrounding test above: resuming at mount seeds
  // the same two clocks `activate` does. Both numbers are checked, because
  // each one is wrong in its own direction and neither shows the other's
  // failure — an unseeded play clock rewrites the session's elapsed time
  // *down* to the seconds since mount (a fabricated best time, §9), while an
  // unseeded booking mark counts the restored seconds into the statistics a
  // second time.
  it('does not lose or double-book the resumed game’s play seconds', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedLevelSeconds()).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(anyBoard()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, on the board and in the statistics, counted
      // once: the restored five are neither lost nor booked again.
      expect(storedLevelSeconds()).toBe(8);
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

  /* Held down and moved, the right button crosses the whole run (issue #130).
     The hard part is the context menu one press owes: macOS raises it on the
     way down, before anyone knows a stroke is coming, and Windows only once
     the button is back up, when the stroke is already over. Both orders have
     to end with the same three crosses standing. */
  describe('right drag (§3, issue #130)', () => {
    /**
     * The right button held across a row. `order` is the browser's own: 'mac'
     * raises the menu on the way down, 'win' after the release. No click ever
     * follows a right release — an auxclick does — so none is fired here.
     * `init` carries how the button arrived, which a pen's barrel changes.
     */
    function rightDrag(
      path: readonly Coord[],
      order: 'mac' | 'win',
      init: Record<string, unknown> = { button: 2, pointerType: 'mouse' },
    ): void {
      const origin = cellAt(...path[0]!);
      const last = path[path.length - 1]!;
      fireEvent.pointerDown(origin, {
        pointerId: 1,
        buttons: 2,
        ...init,
        ...pointAt(...path[0]!),
      });
      if (order === 'mac') contextMenu(origin, { button: 2 });
      for (const step of path.slice(1)) {
        fireEvent.pointerMove(origin, { pointerId: 1, buttons: 2, ...pointAt(...step) });
      }
      fireEvent.pointerUp(origin, { pointerId: 1, button: 2, ...pointAt(...last) });
      if (order === 'win') contextMenu(origin, { button: 2 });
      // What a right release leaves behind, in place of the click the board
      // listens for: fired so every one of these drags also proves that the
      // handler for that click is never reached.
      fireEvent(
        origin,
        new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2, detail: 1 }),
      );
    }

    it('crosses the whole run, and the menu that follows it leaves the run alone', async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      giveCellsALayout();

      // Windows: the menu arrives after the release, when the stroke is gone.
      // Answering it there would take the last cross straight back off.
      rightDrag(
        [
          [1, 1],
          [1, 2],
          [1, 3],
        ],
        'win',
      );

      for (let col = 1; col <= 3; col++) expect(markAt(1, col)).toMatch(/^Crossed/);
      expect(markAt(1, 4)).toMatch(/^Blank/);
    });

    it('crosses the whole run when the menu comes first instead (macOS)', async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      giveCellsALayout();

      // The menu crosses the cell the press began on before the hand has said
      // whether it meant one cross or a run. The stroke then writes that same
      // cell the same way, so the two agree and the origin is not undone.
      rightDrag(
        [
          [2, 1],
          [2, 2],
          [2, 3],
        ],
        'mac',
      );

      for (let col = 1; col <= 3; col++) expect(markAt(2, col)).toMatch(/^Crossed/);
      expect(markAt(2, 4)).toMatch(/^Blank/);
    });

    it('takes a run of crosses back off when it starts on one', async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      giveCellsALayout();

      const run: readonly Coord[] = [
        [3, 1],
        [3, 2],
        [3, 3],
      ];
      rightDrag(run, 'win');
      for (let col = 1; col <= 3; col++) expect(markAt(3, col)).toMatch(/^Crossed/);

      // The same answer a right click on the cell it began on would give: what
      // the stroke writes is decided once, and there it is the erase.
      rightDrag(run, 'win');
      for (let col = 1; col <= 3; col++) expect(markAt(3, col)).toMatch(/^Blank/);
    });

    it('crosses over paint, the way the single right click does (§3)', async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      giveCellsALayout();

      drag([
        [4, 1],
        [4, 2],
        [4, 3],
      ]);
      for (let col = 1; col <= 3; col++) expect(markAt(4, col)).toMatch(/^Painted/);

      rightDrag(
        [
          [4, 1],
          [4, 2],
          [4, 3],
        ],
        'win',
      );
      for (let col = 1; col <= 3; col++) expect(markAt(4, col)).toMatch(/^Crossed/);
    });

    it('still crosses in X mode, and paints not one cell (§3)', async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      await user.click(screen.getByRole('button', { name: 'X Mode' }));
      giveCellsALayout();

      // X mode swaps what the tap and the long press do; the right button does
      // not follow it there, whether it is clicked once or dragged across.
      rightDrag(
        [
          [5, 1],
          [5, 2],
          [5, 3],
        ],
        'win',
      );

      for (let col = 1; col <= 3; col++) expect(markAt(5, col)).toMatch(/^Crossed/);
      expect(within(board()).queryAllByRole('button', { name: /^Painted/ })).toHaveLength(0);
    });

    it('opens no browser menu for a run let go past the end of its row', async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      giveCellsALayout();

      const origin = cellAt(3, 3);
      fireEvent.pointerDown(origin, {
        button: 2,
        buttons: 2,
        pointerType: 'mouse',
        pointerId: 1,
        ...pointAt(3, 3),
      });
      fireEvent.pointerMove(origin, { pointerId: 1, buttons: 2, ...pointAt(3, 4) });
      fireEvent.pointerMove(origin, { pointerId: 1, buttons: 2, ...pointAt(3, 5) });
      // Let go a cell's width past the last column, which is off the board.
      fireEvent.pointerUp(origin, {
        button: 2,
        pointerId: 1,
        clientX: CELL_PX * 5.5,
        clientY: pointAt(3, 5).clientY,
      });

      // The board's own handler covers only the board, so the menu raised out
      // there is the window's to swallow — or the native one opens over the
      // puzzle the player is reading.
      expect(fireEvent.contextMenu(document.body, { button: 2 })).toBe(false);
      for (let col = 3; col <= 5; col++) expect(markAt(3, col)).toMatch(/^Crossed/);
    });

    it('leaves a later menu of its own to cross the cell it lands on', async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      giveCellsALayout();

      // The macOS stroke was never owed a menu — it had one on the way down.
      // A flag left standing here would be spent on the next right click
      // instead, and that one cell would silently do nothing.
      rightDrag(
        [
          [1, 1],
          [1, 2],
        ],
        'mac',
      );

      contextMenu(cellAt(5, 5), { button: 2 });
      expect(markAt(5, 5)).toMatch(/^Crossed/);
    });

    it("crosses the run under a pen's barrel held as the tip comes down", async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);
      giveCellsALayout();

      // Already held when the contact was made, so what changed is the tip:
      // the barrel arrives inside `buttons`, not as the button that moved.
      rightDrag(
        [
          [4, 1],
          [4, 2],
          [4, 3],
        ],
        'win',
        { button: 0, buttons: 3, pointerType: 'pen' },
      );

      for (let col = 1; col <= 3; col++) expect(markAt(4, col)).toMatch(/^Crossed/);
      expect(within(board()).queryAllByRole('button', { name: /^Painted/ })).toHaveLength(0);
    });

    it("crosses on a barrel click, which the pen's own long-press menu may not", async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);

      // Pressed while hovering, the barrel arrives as button 2 — the right
      // button, not the menu a pen tip raises at the end of a long press.
      fireEvent.pointerDown(cellAt(2, 2), { button: 2, buttons: 2, pointerType: 'pen' });
      contextMenu(cellAt(2, 2), { button: 2 });
      fireEvent.pointerUp(cellAt(2, 2), { button: 2, pointerType: 'pen' });

      expect(markAt(2, 2)).toMatch(/^Crossed/);
    });

    it("keeps the cross a pen tip's own long press just made (§3)", async () => {
      const user = userEvent.setup();
      renderGame(tutorialDone);
      await startLevelOne(user);

      vi.useFakeTimers();
      try {
        // The tip alone is unchanged by #130: it still arms a long press, and
        // the menu that press ends in must not take the cross back off.
        fireEvent.pointerDown(cellAt(1, 5), { button: 0, pointerType: 'pen', pointerId: 1 });
        act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
        expect(markAt(1, 5)).toMatch(/^Crossed/);

        contextMenu(cellAt(1, 5), { button: 0 });
        fireEvent.pointerUp(cellAt(1, 5), { button: 0, pointerType: 'pen', pointerId: 1 });
      } finally {
        vi.useRealTimers();
      }
      expect(markAt(1, 5)).toMatch(/^Crossed/);
    });
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

describe('opening a suspended game without resuming (#109)', () => {
  // The board is not the only thing a suspended game carries — the minutes on
  // its clock are the player's too. `syncActiveGame` runs on every background
  // from whichever screen is showing, and it writes this provider's play clock
  // into the session it saves. Open the game, never press Resume, background:
  // a clock that never took the restored board's seconds saves a zero over
  // them, and the board comes back looking untouched.
  it("keeps a suspended board's clock when backgrounded from the game's home", async () => {
    deviceStore.set(NG_STORAGE_KEYS.flags, tutorialDone[NG_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(9_000));
      background();
      await settle();
      expect(storedBoardSeconds()).toBe(9);

      // The process dies here. Relaunch and stop on the game's own home.
      cleanup();
      launch();
      await settle();
      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

      // Away again without ever resuming: the nine seconds are still there.
      background();
      await settle();
      expect(storedBoardSeconds()).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });
});
