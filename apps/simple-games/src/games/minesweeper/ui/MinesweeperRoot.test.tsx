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

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(MS_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
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

  it('leaves an open number alone — chording stays the tap\'s (§3)', async () => {
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

/* Keyboard input is an adapter over the same tap handler (issue #93): this
   checks board state the Hint button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('H asks for the hint, same as the Hint button', async () => {
    const user = userEvent.setup();
    renderMinesweeper(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(5, 5));

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status').textContent).toMatch(/safe/i);
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
