/**
 * The game as a player meets it (docs/MINESWEEPER_RULES.md §3, §4, §6, §7):
 * three steps of Quick Rules and straight into a board, a first tap that opens
 * a region, flag mode as a real alternative to long-pressing, a hint that
 * explains without playing — and neither a clock, a streak, nor an undo
 * anywhere on the screen.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { cellCount, PRESETS } from '../game';
import { MS_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { LONG_PRESS_MS } from './components/MinesBoard';
import { MinesweeperRoot } from './MinesweeperRoot';

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

function renderMinesweeper(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MinesweeperRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [MS_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /^Minefield/ });
const cells = () => within(board()).getAllByRole('button');
const shutCells = () =>
  cells().filter((cell) => cell.getAttribute('aria-label')!.startsWith('Unopened'));
const cellAt = (row: number, col: number) =>
  within(board()).getByRole('button', { name: new RegExp(`row ${row}, column ${col}$`) });

/** Starts an easy board and returns once the empty minefield is on screen. */
async function startEasy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Easy/ }));
  return board();
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MinesweeperRoot onExit={vi.fn()} />
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

/** The suspended difficulty board's own clock, as it survives on disk (§10). */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(MS_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

/** Total play seconds as they survive on disk, across every difficulty. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(MS_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  // Play five minutes, background the app, let Android kill it, come back: the
  // board returns, and so must the five minutes. The session save alone cannot
  // carry them — `activate` treats a restored session's elapsedSeconds as
  // already counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(MS_STORAGE_KEYS.flags, tutorialDone[MS_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      // Nothing is timed before the first tap (§4), so open a square first.
      fireEvent.click(cellAt(5, 5));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));

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
 * A pinned home-screen shortcut, and what Minesweeper does about it (issue
 * #113). The shell says only which door was used; every decision below is this
 * game's own, taken from its two save slots (§8, §10).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut(onExit: () => void = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <MinesweeperRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(MS_STORAGE_KEYS.flags, tutorialDone[MS_STORAGE_KEYS.flags]!);
  }

  const minefield = () => screen.queryByRole('group', { name: /^Minefield/ });
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  /** Suspends an Easy board: started, then left the way the back arrow leaves it. */
  async function suspendEasy(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  /** Suspends today's daily alongside whatever the difficulty slot holds. */
  async function suspendDaily(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  it('opens the one suspended board straight onto the minefield', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendEasy(user);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(minefield()).toBeInTheDocument();
    // The board it left off on, named in the topbar — not a fresh one.
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  it('opens a suspended daily on the daily board, not an empty difficulty slot', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendDaily(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // The other slot is the one this game defaults to, and it is empty here.
    expect(minefield()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendEasy(user);
    cleanup();

    const onExit = vi.fn();
    launchFromShortcut(onExit);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the board
    // was reached through: the way in did not add a screen to undo.
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when both slots are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendEasy(user);
    await suspendDaily(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — nothing was chosen for
    // the player, and nothing was thrown away either.
    expect(minefield()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(minefield()).not.toBeInTheDocument();
    expect(home()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendEasy(user);
    cleanup();

    launch();
    await settle();

    expect(minefield()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules (§11)', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendEasy(user);
    cleanup();
    // A cleared or unreadable flags record reads back as "not taught yet" while
    // the board survives. A shortcut is not a way past Quick Rules either.
    deviceStore.delete(MS_STORAGE_KEYS.flags);

    launchFromShortcut();
    await settle();

    expect(screen.getByText('A number counts mines')).toBeInTheDocument();
    expect(minefield()).not.toBeInTheDocument();
  });

  /**
   * The counterpart of the backgrounding test above: resuming at mount seeds
   * the same two clocks `activate` does, so the seconds already played are
   * neither lost nor counted again.
   *
   * Both numbers are read, and that is the point. The statistics alone cannot
   * see the worse of the two mistakes: with NEITHER clock seeded the errors
   * cancel — `withElapsed` writes the board's own clock back DOWN to the
   * seconds since mount, and the booking then adds exactly that many — so the
   * total comes out right while the player's five seconds are quietly gone
   * from the board they are still playing.
   */
  it('does not lose or double-book the resumed board’s play seconds', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      // Nothing is timed before the first tap (§4), so open a square first.
      fireEvent.click(cellAt(5, 5));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedBoardSeconds()).toBe(5);

      // The process dies here; the shortcut is the next thing that happens.
      cleanup();
      launchFromShortcut();
      await settle();
      expect(minefield()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, on a board that still knows it
      // has been played for eight.
      expect(storedPlaySeconds()).toBe(8);
      expect(storedBoardSeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts a board right after (§11)', async () => {
    const user = userEvent.setup();
    renderMinesweeper();

    expect(await screen.findByText('A number counts mines')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Flag what you are sure of')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Open the rest to win')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(cells()).toHaveLength(cellCount(PRESETS.easy));
    // Every free action is available from the very first move (brand promise).
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Flag mode' })).toBeEnabled();
  });
});

describe('home (§8)', () => {
  it('offers three boards and the daily, and no level list', async () => {
    const user = userEvent.setup();
    const { onExit } = renderMinesweeper(tutorialDone);

    expect(await screen.findByRole('button', { name: /^Easy/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Medium/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hard/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    // §8, §13: Minesweeper has no progression, so there is nothing to list.
    expect(screen.queryByText(/^Levels$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('names the board size and the mine count on each choice (§1)', async () => {
    renderMinesweeper(tutorialDone);
    expect(await screen.findByRole('button', { name: /9×9 · 10 mines/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /12×12 · 25 mines/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /14×18 · 50 mines/ })).toBeInTheDocument();
  });
});

describe('the first tap (§4)', () => {
  it('opens a region, and every square starts shut', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);

    expect(shutCells()).toHaveLength(cellCount(PRESETS.easy));
    expect(screen.getByText(/first tap is always safe/i)).toBeInTheDocument();

    await user.click(cellAt(5, 5));

    // The tap was safe and its neighbours were clear, so a region opened —
    // at minimum the tapped cell and its eight neighbours.
    const opened = cellCount(PRESETS.easy) - shutCells().length;
    expect(opened).toBeGreaterThanOrEqual(9);
    expect(cellAt(5, 5).getAttribute('aria-label')).toMatch(/^Empty/);
    // The mine counter starts at the full count; no mine has been flagged.
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

describe('flag mode (§3)', () => {
  it('makes a plain tap plant and lift a flag, and a normal tap open again', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    const label = target.getAttribute('aria-label')!;

    await user.click(screen.getByRole('button', { name: 'Flag mode' }));
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
    // The counter is board information: one flag down, one fewer to find (§6).
    expect(screen.getByText('9')).toBeInTheDocument();

    await user.click(target);
    expect(target.getAttribute('aria-label')).toBe(label);

    await user.click(screen.getByRole('button', { name: 'Flag mode' }));
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(target);
    expect(target.getAttribute('aria-label')).not.toMatch(/^(Unopened|Flagged)/);
  });

  it('is not the only way: a long press flags too', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(target, { button: 0, pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 20));
      fireEvent.pointerUp(target, { button: 0, pointerType: 'touch' });
      fireEvent.click(target, { button: 0, detail: 1 });
    } finally {
      vi.useRealTimers();
    }
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
  });

  it('takes a flag back the same way, without opening the square', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    const label = target.getAttribute('aria-label')!;
    const shut = shutCells().length;

    /** One long press, and the click the finger leaves behind on the way up. */
    const longPress = () => {
      vi.useFakeTimers();
      try {
        fireEvent.pointerDown(target, { button: 0, pointerType: 'touch' });
        act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 20));
        fireEvent.pointerUp(target, { button: 0, pointerType: 'touch' });
        fireEvent.click(target, { button: 0, detail: 1 });
      } finally {
        vi.useRealTimers();
      }
    };

    longPress();
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
    // Lifting the flag leaves a plain shut square, which the trailing click
    // would open if the long press did not already own this press.
    longPress();
    expect(target.getAttribute('aria-label')).toBe(label);
    expect(shutCells()).toHaveLength(shut);
  });
});

/* The right button is what every desktop Minesweeper taught (§3, issue #111).
   The event orders below are the browsers' own: Windows raises the context menu
   after the button comes back up and macOS raises it on the way down, but
   neither delivers a click for the right button — while macOS's ctrl+click
   raises the menu from the primary button and does deliver one. */
describe('right click (§3, issue #111)', () => {
  /**
   * Raises the context menu and insists it was cancelled — a cancelled
   * contextmenu is the whole of "no browser menu over the board" (§3).
   * fireEvent hands back what dispatchEvent returned, which is false exactly
   * when something called preventDefault on it.
   */
  function contextMenu(cell: HTMLElement, init: Record<string, unknown>) {
    expect(fireEvent.contextMenu(cell, init)).toBe(false);
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

  it('plants a flag, lifts it again, and never opens the square', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    const label = target.getAttribute('aria-label')!;
    const shut = shutCells().length;

    rightClick(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
    // One flag down, one fewer mine to find (§6) — and nothing was opened.
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(shutCells()).toHaveLength(shut - 1);

    // A second one takes it back: one right click is one action, never two.
    rightClick(target);
    expect(target.getAttribute('aria-label')).toBe(label);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(shutCells()).toHaveLength(shut);
  });

  it("leaves an open number alone — chording stays the tap's (§3)", async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const open = cells().find((cell) => /mines nearby/.test(cell.getAttribute('aria-label')!))!;
    const label = open.getAttribute('aria-label')!;
    const shut = shutCells().length;

    rightClick(open);
    // No flag on a number, and no neighbours opened behind the player's back.
    expect(open.getAttribute('aria-label')).toBe(label);
    expect(shutCells()).toHaveLength(shut);
  });

  it('still flags in flag mode: the button means one thing (§3)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));
    await user.click(screen.getByRole('button', { name: 'Flag mode' }));

    const target = shutCells()[0]!;
    const shut = shutCells().length;

    // Flag mode gives the long press the open — the right button does not
    // follow it there, or a right click would mean two different things.
    rightClick(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
    expect(shutCells()).toHaveLength(shut - 1);
  });

  it('still flags in flag mode turned on by the keyboard (issue #115)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const target = shutCells()[0]!;
    const shut = shutCells().length;

    // The F key only flips the same mode the button flips — right click
    // still plants a flag regardless (§3), whichever input turned it on.
    rightClick(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
    expect(shutCells()).toHaveLength(shut - 1);
  });

  it('acts once when the button is held down (§3)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    vi.useFakeTimers();
    try {
      // Windows raises the menu only once the button comes back up. A long
      // press armed on the way down would therefore flag on its own timer and
      // the menu would take the flag straight back off — so none is armed.
      fireEvent.pointerDown(target, { button: 2, pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 20));
      fireEvent.pointerUp(target, { button: 2, pointerType: 'mouse' });
      fireEvent.contextMenu(target, { button: 2 });
    } finally {
      vi.useRealTimers();
    }
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
  });

  it('acts once when a click follows the menu (macOS ctrl+click)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    const shut = shutCells().length;

    ctrlClick(target);
    // The menu flagged it; the click that came after must not open it as well.
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
    expect(shutCells()).toHaveLength(shut - 1);
  });

  it('lifts a flag without opening what was under it (macOS ctrl+click)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    const label = target.getAttribute('aria-label')!;
    const shut = shutCells().length;

    ctrlClick(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);

    // The dangerous direction: the menu takes the flag off, and the click that
    // follows would find an unflagged square to open if it were let through.
    ctrlClick(target);
    expect(target.getAttribute('aria-label')).toBe(label);
    expect(shutCells()).toHaveLength(shut);
  });

  it('answers a mouse on a touchscreen laptop (§3)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    // A finger first: the context menu a touch raises is ignored. The mouse
    // that follows must not inherit that — both inputs live on one machine.
    fireEvent.pointerDown(target, { button: 0, pointerType: 'touch' });
    fireEvent.pointerUp(target, { button: 0, pointerType: 'touch' });

    rightClick(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
  });

  it('holds the flag while the button stays down (macOS ctrl+click)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    vi.useFakeTimers();
    try {
      // The primary button raises the menu on the way down, so a long press is
      // armed underneath it. Held past the long press, that timer would flag a
      // second time and undo the flag the menu just planted.
      fireEvent.pointerDown(target, { button: 0, pointerType: 'mouse', ctrlKey: true });
      contextMenu(target, { button: 0, ctrlKey: true });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 20));
      fireEvent.pointerUp(target, { button: 0, pointerType: 'mouse', ctrlKey: true });
      fireEvent.click(target, { button: 0, ctrlKey: true, detail: 1 });
    } finally {
      vi.useRealTimers();
    }
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
  });

  it('leaves the keyboard its own turn on the square it just flagged', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    rightClick(target);
    rightClick(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Unopened/);

    // A right click leaves no click behind on most platforms, so nothing comes
    // to clear what it handled. The next Enter is not that click, and must not
    // be mistaken for it — a keyboard player would just see the square ignore
    // them. userEvent gives it the empty click count a real key press has.
    target.focus();
    await user.keyboard('{Enter}');
    expect(target.getAttribute('aria-label')).not.toMatch(/^(Unopened|Flagged)/);
  });

  it('lets the touch long press keep its flag (§3)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const target = shutCells()[0]!;
    vi.useFakeTimers();
    try {
      // Chrome on Android raises a context menu of its own at the end of a long
      // press. The long press has already flagged by then, so handling that one
      // as a right click would take the flag straight back off.
      fireEvent.pointerDown(target, { button: 0, pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 20));
      // Cancelled here as well: the menu is stopped before the touch is let go.
      contextMenu(target, { button: 0 });
      fireEvent.pointerUp(target, { button: 0, pointerType: 'touch' });
      fireEvent.click(target, { button: 0, detail: 1 });
    } finally {
      vi.useRealTimers();
    }
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);
  });
});

describe('hint (§7)', () => {
  it('marks a safe square and its reason without opening anything', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const before = shutCells().length;
    await user.click(screen.getByRole('button', { name: 'Hint' }));

    // A sentence, and a marked square that is still shut: a hint explains, it
    // does not play (§7).
    expect(screen.getByRole('status').textContent).toMatch(/safe/i);
    const marked = board().querySelector('.mines-cell-hint')!;
    expect(marked).not.toBeNull();
    expect(marked.getAttribute('aria-label')).toMatch(/^Unopened/);
    expect(board().querySelectorAll('.mines-cell-reason').length).toBeGreaterThan(0);
    expect(shutCells()).toHaveLength(before);
  });
});

describe('what the game screen refuses to show', () => {
  it('has no undo, no clock and no streak (§6, §7)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    // §7: there is no undo. The free help is Hint, and the free second chance
    // is the same board again from the result card.
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    // §6: the clock runs, but never on screen.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('keeps statistics free of streaks as well (§9)', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Win rate')).toHaveLength(3);
    expect(screen.getByText('Days cleared')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('the board a screen reader hears (§12)', () => {
  it('names every square by state and position', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);

    expect(board()).toHaveAccessibleName('Minefield, 9 columns by 9 rows');
    expect(cellAt(1, 1).getAttribute('aria-label')).toBe('Unopened, row 1, column 1');

    await user.click(cellAt(5, 5));
    const labels = cells().map((cell) => cell.getAttribute('aria-label')!);
    // Every label says what the square is and where it is — never just "button".
    for (const label of labels) {
      expect(label).toMatch(/row \d+, column \d+$/);
      expect(label).toMatch(/^(Unopened|Flagged|Empty|Mine|\d+ mines nearby)/);
    }
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Hint and Flag mode buttons also produce, never a
   keyboard-only behaviour (issues #93, #115). */
describe('keyboard (issue #93)', () => {
  it('H asks for the hint, same as the Hint button', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status').textContent).toMatch(/safe/i);
  });

  // F toggles flag mode (issue #115): the same one-shot action the Flag mode
  // button triggers, proven both by the button's own state and by what a tap
  // on the board does next.
  it('F toggles flag mode, same as the button', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('status').textContent).toContain(
      'A tap plants a flag; a long press opens.',
    );

    // The mode is not just a label: a plain click on a shut cell now flags
    // it, the same board change the button's own click produces.
    const target = shutCells()[0]!;
    await user.click(target);
    expect(target.getAttribute('aria-label')).toMatch(/^Flagged/);

    // Upper case, as Shift or Caps Lock delivers it.
    fireEvent.keyDown(window, { key: 'F' });
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // H still works after F was pressed: the two keys do not interfere.
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status').textContent).toMatch(/safe/i);
  });

  // Held keys act once, never once per repeat frame (the same rule H already
  // follows): a long-held F must not flap the mode back and forth.
  it('a held F toggles once — repeats are swallowed, not replayed', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));
    const toggle = screen.getByRole('button', { name: 'Flag mode' });

    // The initial press turns flag mode on...
    fireEvent.keyDown(window, { key: 'f' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // ...and the browser's repeated keydown while the key stays held must not
    // flap it back off. fireEvent hands back what dispatchEvent returned,
    // which is false exactly when the handler called preventDefault — proof
    // the repeat was swallowed here rather than left for the browser.
    expect(fireEvent.keyDown(window, { key: 'f', repeat: true })).toBe(false);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves F to a field it is typed into, and to the browser with a modifier', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'f' });
    document.body.removeChild(input);
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // fireEvent hands back what dispatchEvent returned: true means nothing
    // called preventDefault, so the browser keeps Ctrl/Cmd+F for itself.
    expect(fireEvent.keyDown(window, { key: 'f', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(window, { key: 'f', metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(window, { key: 'f', altKey: true })).toBe(true);
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('goes quiet while the restart dialog is up', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('goes quiet once the board is finished', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));
    await settle();

    // Find a still-shut mine from the saved board (the first tap's region is
    // guaranteed safe, so the mines are all outside it) and open it to lose.
    const raw = deviceStore.get(MS_STORAGE_KEYS.game)!;
    const { mines } = JSON.parse(raw) as { mines: string };
    const idx = mines.indexOf('1');
    const row = Math.floor(idx / PRESETS.easy.width) + 1;
    const col = (idx % PRESETS.easy.width) + 1;
    await user.click(cellAt(row, col));
    await screen.findByRole('alertdialog', { name: 'Mine opened' });

    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('button', { name: 'Flag mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
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
    deviceStore.set(MS_STORAGE_KEYS.flags, tutorialDone[MS_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      fireEvent.click(cellAt(5, 5));

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
