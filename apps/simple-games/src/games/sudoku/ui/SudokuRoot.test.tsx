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

/** The suspended level board's own clock, as it survives on disk (§11). */
function storedLevelSeconds(): number {
  const raw = deviceStore.get(SD_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

/** Total play seconds as they survive on disk, across every tier. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(SD_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
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

/**
 * A pinned home-screen shortcut, and what Sudoku does about it (issue #113).
 * The shell says only which door was used; every decision below is this
 * game's, taken from its own three save slots (§11).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut() {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SudokuRoot onExit={vi.fn()} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(SD_STORAGE_KEYS.flags, tutorialDone[SD_STORAGE_KEYS.flags]!);
  }

  const board = () => screen.queryByRole('group', { name: 'Sudoku grid' });
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SudokuRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens a suspended daily just as readily as a level', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    // The daily is the slot most easily forgotten: it is not the one the home
    // screen leads with, and a rule that counted only two of the three would
    // both miss this board and mistake a level+daily pair for a single answer.
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens a suspended free board too, and is not confused by a save it cannot read', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();
    // A level record that is not a record at all. It must not count as a
    // second suspended game — a save nobody can read is not a game somebody
    // was playing, and treating it as one would turn every corrupt record
    // into a shortcut that stopped working (§11: 壊れた保存データは読み捨てる).
    deviceStore.set(SD_STORAGE_KEYS.game, '{"schemaVersion":1,"mode":"lev');

    launchFromShortcut();
    await settle();

    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Free Play')).toBeInTheDocument();
  });

  it('opens the home screen when the only save is one it cannot read', async () => {
    taughtAlready();
    deviceStore.set(SD_STORAGE_KEYS.game, 'not json at all');

    launchFromShortcut();
    await settle();

    // Fail-safe, and the game still runs: broken local data does not stop a
    // launch, it only means there is nothing to come back to.
    expect(board()).not.toBeInTheDocument();
    expect(home()).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — nothing was chosen for
    // the player, and nothing was thrown away either.
    expect(board()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(board()).not.toBeInTheDocument();
    expect(home()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launch();
    await settle();

    expect(board()).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();
    deviceStore.delete(SD_STORAGE_KEYS.flags);

    launchFromShortcut();

    // Quick Rules first: a shortcut is not a way past them (§13).
    expect(await screen.findByText('1-9, once each')).toBeInTheDocument();
    expect(board()).not.toBeInTheDocument();
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
   * total comes out right while the player's five minutes are quietly gone
   * from the board they are still playing.
   */
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
      expect(board()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, on a board that still knows it
      // has been played for eight.
      expect(storedPlaySeconds()).toBe(8);
      expect(storedLevelSeconds()).toBe(8);
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
