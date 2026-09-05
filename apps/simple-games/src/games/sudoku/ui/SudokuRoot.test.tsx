import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { CELLS } from '../game';
import { SD_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { SudokuRoot } from './SudokuRoot';

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

function renderSudoku(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SudokuRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SudokuRoot onExit={vi.fn()} />
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

/** Total play seconds as they survive on disk, across every tier. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(SD_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(SD_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

const tutorialDone = {
  [SD_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§13)', async () => {
    const user = userEvent.setup();
    renderSudoku();

    expect(await screen.findByText('1-9, once each')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Note what might fit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Stuck? Take a hint')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    expect(within(grid).getAllByRole('button')).toHaveLength(CELLS);
    // Every free action is available from the first move (brand promise).
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('Quick Rules figures', () => {
  it('draws a real 3x3 box, and never one that breaks the rules', async () => {
    const user = userEvent.setup();
    renderSudoku();
    await screen.findByText('1-9, once each');

    for (const step of [0, 1, 2]) {
      const box = document.querySelector('.sudoku-tutorial-box');
      expect(box, `step ${step} has no figure`).not.toBeNull();
      const cells = [...box!.querySelectorAll('.sudoku-tutorial-cell')];
      expect(cells.length === 9 || cells.length === 1).toBe(true);

      // A figure that repeated a digit in one box would teach the wrong rule.
      const digits = cells
        .map((cell) => cell.textContent!.trim())
        .filter((text) => /^\d$/.test(text));
      expect(new Set(digits).size, `step ${step} repeats a digit`).toBe(digits.length);

      if (step < 2) await user.click(screen.getByRole('button', { name: 'Next' }));
    }
  });
});

describe('home', () => {
  it('offers both modes and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderSudoku(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('never shows a clock or a streak anywhere (§10, §12)', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));

    // The top bar carries the mode and the tier, and nothing that ticks.
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0:0\d/)).not.toBeInTheDocument();
  });
});

describe('free play (§9)', () => {
  it('starts a board at the chosen tier, and resumes it from the home', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await screen.findByRole('button', { name: /Level 1/ });

    // The picker stands on medium until told otherwise; here, hard.
    const picker = screen.getByRole('group', { name: 'Difficulty' });
    await user.click(within(picker).getByRole('button', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: /Free Play/ }));

    // The top bar names the mode and the tier — no level number, no clock.
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();

    // A digit, then away and back: the board is where it was left.
    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    const empty = within(grid)
      .getAllByRole('button')
      .find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);
    const pad = screen.getByRole('group', { name: 'Number pad' });
    await user.click(
      within(pad)
        .getAllByRole('button')
        .find((button) => !button.hasAttribute('disabled'))!,
    );
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume.*Hard/ })).toBeInTheDocument();
    // The level climb is untouched by a free board.
    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Sudoku grid' }))
        .getAllByRole('button')
        .some((cell) => cell.getAttribute('aria-label')?.startsWith('Empty')),
    ).toBe(true);
  });

  it('asks before replacing a suspended free board with a new one', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('places a digit into the selected cell', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));

    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    const empty = within(grid)
      .getAllByRole('button')
      .find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);
    expect(empty).toHaveAttribute('aria-pressed', 'true');

    const pad = screen.getByRole('group', { name: 'Number pad' });
    // Any enabled key will do; the cell must then show that digit.
    const key = within(pad)
      .getAllByRole('button')
      .find((button) => !button.hasAttribute('disabled'))!;
    const digit = key.textContent!.replace(/\D/g, '').slice(0, 1);
    await user.click(key);

    const label = empty.getAttribute('aria-label')!;
    expect(label.startsWith(`${digit},`)).toBe(true);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('refuses to overwrite a given cell', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));

    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    const given = within(grid)
      .getAllByRole('button')
      .find((cell) => cell.getAttribute('aria-label')?.includes('given'))!;
    const before = given.getAttribute('aria-label');
    await user.click(given);
    const pad = screen.getByRole('group', { name: 'Number pad' });
    await user.click(
      within(pad)
        .getAllByRole('button')
        .find((button) => !button.hasAttribute('disabled'))!,
    );
    expect(given.getAttribute('aria-label')).toBe(before);
  });

  it('undo takes back the last digit', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));

    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    const empty = within(grid)
      .getAllByRole('button')
      .find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);
    const pad = screen.getByRole('group', { name: 'Number pad' });
    await user.click(
      within(pad)
        .getAllByRole('button')
        .find((button) => !button.hasAttribute('disabled'))!,
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(empty.getAttribute('aria-label')!.startsWith('Empty')).toBe(true);
  });

  it('a hint explains in plain language and does not fill the cell (§5)', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));

    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    const filledBefore = within(grid)
      .getAllByRole('button')
      .filter((cell) => !cell.getAttribute('aria-label')?.startsWith('Empty')).length;

    await user.click(screen.getByRole('button', { name: 'Hint' }));

    // A sentence appears, with no technique name in it.
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/only|rule/i);
    expect(status.textContent).not.toMatch(/single|pointing|claiming|wing/i);
    // The board is unchanged: a hint explains, it does not play.
    const filledAfter = within(grid)
      .getAllByRole('button')
      .filter((cell) => !cell.getAttribute('aria-label')?.startsWith('Empty')).length;
    expect(filledAfter).toBe(filledBefore);
    expect(grid.querySelectorAll('.sudoku-cell-hint').length).toBeGreaterThan(0);
  });

  it('notes mode pencils a candidate instead of an entry', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));

    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    const empty = within(grid)
      .getAllByRole('button')
      .find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);
    await user.click(screen.getByRole('button', { name: 'Notes' }));

    const pad = screen.getByRole('group', { name: 'Number pad' });
    await user.click(within(pad).getByRole('button', { name: /^Note 5$/ }));

    // Still an empty cell as far as the puzzle is concerned.
    expect(empty.getAttribute('aria-label')!.startsWith('Empty')).toBe(true);
    expect(empty.querySelector('.sudoku-notes')).not.toBeNull();
  });
});

describe('backgrounding (§11)', () => {
  // Play five minutes, background the app, let Android kill it, come back: the
  // board returns, and so must the five minutes. The session save alone cannot
  // carry them — `activate` treats a restored session's elapsedSeconds as
  // already counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(SD_STORAGE_KEYS.flags, tutorialDone[SD_STORAGE_KEYS.flags]!);
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

describe('opening a suspended game without resuming (#109)', () => {
  // The board is not the only thing a suspended game carries — the minutes on
  // its clock are the player's too. `syncActiveGame` runs on every background
  // from whichever screen is showing, and it writes this provider's play clock
  // into the session it saves. Open the game, never press Resume, background:
  // a clock that never took the restored board's seconds saves a zero over
  // them, and the board comes back looking untouched.
  it("keeps a suspended board's clock when backgrounded from the game's home", async () => {
    deviceStore.set(SD_STORAGE_KEYS.flags, tutorialDone[SD_STORAGE_KEYS.flags]!);
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

describe('statistics', () => {
  it('reports per-difficulty facts and no streak', async () => {
    const user = userEvent.setup();
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.getAllByText('Average clear')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93):
   every assertion here checks board state the taps also produce, never a
   keyboard-only behaviour. */
describe('keyboard (issue #93)', () => {
  async function startLevel(user: ReturnType<typeof userEvent.setup>) {
    renderSudoku(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));
    const grid = screen.getByRole('group', { name: 'Sudoku grid' });
    return { grid, cells: within(grid).getAllByRole('button') };
  }

  it('first arrow lands centre, then arrows walk and clamp at the edge', async () => {
    const user = userEvent.setup();
    const { cells } = await startLevel(user);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cells[40]).toHaveAttribute('aria-pressed', 'true'); // row 4, col 4

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cells[41]).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(cells[32]).toHaveAttribute('aria-pressed', 'true');

    // Walk to the top edge and keep pressing: the selection stays put.
    for (let i = 0; i < 8; i++) fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(cells[5]).toHaveAttribute('aria-pressed', 'true');
  });

  it('digits place, Backspace erases, Ctrl+Z undoes — same as the taps', async () => {
    const user = userEvent.setup();
    const { cells } = await startLevel(user);
    const empty = cells.find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);

    fireEvent.keyDown(window, { key: '5' });
    expect(empty.getAttribute('aria-label')!.startsWith('5,')).toBe(true);

    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(empty.getAttribute('aria-label')!.startsWith('Empty')).toBe(true);

    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(empty.getAttribute('aria-label')!.startsWith('Empty')).toBe(true);
  });

  it('a held digit key places once — repeats are swallowed, not replayed', async () => {
    const user = userEvent.setup();
    const { cells } = await startLevel(user);
    const empty = cells.find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);

    fireEvent.keyDown(window, { key: '5', repeat: true });
    expect(empty.getAttribute('aria-label')!.startsWith('Empty')).toBe(true);
  });

  it('N pencils notes, H asks for the hint', async () => {
    const user = userEvent.setup();
    const { cells } = await startLevel(user);
    const empty = cells.find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);

    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: '5' });
    expect(empty.getAttribute('aria-label')!.startsWith('Empty')).toBe(true);
    expect(empty.querySelector('.sudoku-notes')).not.toBeNull();

    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('goes quiet while the restart dialog is up', async () => {
    const user = userEvent.setup();
    const { cells } = await startLevel(user);
    const empty = cells.find((cell) => cell.getAttribute('aria-label')?.startsWith('Empty'))!;
    await user.click(empty);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.keyDown(window, { key: '5' });
    expect(empty.getAttribute('aria-label')!.startsWith('Empty')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: '5' });
    expect(empty.getAttribute('aria-label')!.startsWith('5,')).toBe(true);
  });
});
