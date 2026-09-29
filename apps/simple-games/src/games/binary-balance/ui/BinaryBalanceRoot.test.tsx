/**
 * The game as a player meets it (docs/BINARY_BALANCE_RULES.md §2, §4, §8,
 * §9, §10, §11, §12): three steps of Quick Rules and straight into a board, a
 * tap that cycles, rules that are shown the moment they break, a hint that
 * explains without playing, a solve that says so once — and neither a clock,
 * a streak, nor an undo anywhere on the screen.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { BN_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { BinaryBalanceRoot } from './BinaryBalanceRoot';

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
      <BinaryBalanceRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [BN_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /^Binary Balance board/ });
const cells = () => within(board()).getAllByRole('button');
const cellAt = (row: number, col: number) =>
  within(board()).getByRole('button', { name: new RegExp(`row ${row}, column ${col}(,|$)`) });
const labelOf = (cell: HTMLElement) => cell.getAttribute('aria-label') ?? '';

/** The first cell the player may tap: givens are disabled buttons (§4). */
const firstOpenCell = () => cells().find((cell) => !(cell as HTMLButtonElement).disabled)!;

/** Three open cells side by side in one row, as [row, col] of the first. */
function openRun(size: number): [number, number] {
  const all = cells() as HTMLButtonElement[];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col + 2 < size; col++) {
      const at = row * size + col;
      if (!all[at]!.disabled && !all[at + 1]!.disabled && !all[at + 2]!.disabled) {
        return [row + 1, col + 1];
      }
    }
  }
  throw new Error('no open run of three');
}

async function startEasy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Easy/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BinaryBalanceRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store a launch reads, entered by the other door (issue #113). */
function launchFromShortcut(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BinaryBalanceRoot onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return onExit;
}

/** Lets the local reads and the saves they trigger resolve. */
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
  const raw = deviceStore.get(BN_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

/** The board on screen, read from what the game itself saved (§11). */
function savedGame(): { solution: string; givens: string } {
  return JSON.parse(deviceStore.get(BN_STORAGE_KEYS.game)!) as {
    solution: string;
    givens: string;
  };
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('backgrounding (§11)', () => {
  // Play five seconds, background the app, let Android kill it, come back: the
  // board returns, and so must the five seconds — counted once.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(BN_STORAGE_KEYS.flags, tutorialDone[BN_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books nothing when a suspended game is opened and left unresumed', async () => {
    deviceStore.set(BN_STORAGE_KEYS.flags, tutorialDone[BN_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
      act(() => vi.advanceTimersByTime(7_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(7);

      for (const _visit of [1, 2]) {
        cleanup();
        launch();
        await settle();
        background();
        await settle();
        expect(storedPlaySeconds()).toBe(7);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut (issue #113). The shell says only which door
 * was used; every decision below is this game's, from its own two slots.
 */
describe('a home-screen shortcut', () => {
  const taughtAlready = () =>
    deviceStore.set(BN_STORAGE_KEYS.flags, tutorialDone[BN_STORAGE_KEYS.flags]!);
  const boardOrNull = () => screen.queryByRole('group', { name: /^Binary Balance board/ });
  const homeScreen = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  async function suspendEasy(user: ReturnType<typeof userEvent.setup>) {
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();
  }

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    await suspendEasy(user);

    launchFromShortcut();
    await settle();
    expect(boardOrNull()).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(homeScreen()).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    await suspendEasy(user);

    const onExit = launchFromShortcut();
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(homeScreen()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when both slots are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();
    expect(boardOrNull()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();
    expect(boardOrNull()).not.toBeInTheDocument();
    expect(homeScreen()).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§12)', async () => {
    launchFromShortcut();
    expect(await screen.findByText('Never three in a row')).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });
});

describe('first run (§12)', () => {
  it('shows Quick Rules and starts a board right after', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Never three in a row')).toBeInTheDocument();
    // The figure is drawn with the board's own shapes, never characters (§1).
    expect(document.querySelectorAll('.tutorial-example svg').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Half and half')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Follow the links')).toBeInTheDocument();
    expect(document.querySelector('.tutorial-example')).toHaveTextContent(/=.*×/);
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // The remembered difficulty starts at Easy: a 6×6, thirty-six cells.
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(cells()).toHaveLength(36);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
  });
});

describe('home (§10)', () => {
  it('offers three boards and the daily, no level list, and hands control back', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /^Easy.*6×6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Medium.*6×6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hard.*6×6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    expect(screen.queryByText(/^Levels$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('asks before replacing a suspended board with another difficulty (§11)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: /^Medium/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the board in progress?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
  });

  it('starts the daily at medium, a 6×6', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(cells()).toHaveLength(36);
  });

  it('asks before another day replaces a suspended daily, and resumes the same day (§11)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    const open = firstOpenCell();
    const openLabel = labelOf(open).replace(/^Empty, /, '');
    await user.click(open);
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: /Past Dailies/ }));
    const days = () =>
      within(document.querySelector('.daily-list') as HTMLElement).getAllByRole('button');
    expect(days()[0]).toHaveTextContent(/Today.*Resume/);

    await user.click(days()[1]!);
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(days()[0]).toHaveTextContent(/Today.*Resume/);

    // Today again: a resume, which replaces nothing and asks nothing.
    await user.click(days()[0]!);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Sun, ${openLabel}` })).toBeInTheDocument();
  });
});

describe('playing (§2, §4, §9)', () => {
  it('cycles a cell empty → sun → moon → empty under the same tap', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);

    const cell = firstOpenCell();
    expect(labelOf(cell)).toMatch(/^Empty/);
    await user.click(cell);
    expect(labelOf(cell)).toMatch(/^Sun/);
    expect(cell.querySelector('svg .bn-sun')).not.toBeNull();
    await user.click(cell);
    expect(labelOf(cell)).toMatch(/^Moon/);
    expect(cell.querySelector('svg .bn-moon')).not.toBeNull();
    await user.click(cell);
    expect(labelOf(cell)).toMatch(/^Empty/);
  });

  it('keeps the givens fixed, and reads every link aloud on its cell (§4, §13)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    await settle();

    const fixed = cells().filter((cell) => (cell as HTMLButtonElement).disabled);
    expect(fixed.length).toBeGreaterThan(0);
    for (const cell of fixed) expect(labelOf(cell)).toMatch(/^Fixed (sun|moon)/);

    const linkCount = document.querySelectorAll('.bn-link').length;
    expect(linkCount).toBeGreaterThan(0);
    const spoken = cells()
      .map(labelOf)
      .join(' ')
      .match(/(same as|different from) the cell/g);
    expect(spoken).toHaveLength(linkCount);
  });

  it('tints marks that break a rule, and says so in the label (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    const [row, col] = openRun(6);
    for (const offset of [0, 1, 2]) {
      await user.click(cellAt(row, col + offset));
      await user.click(cellAt(row, col + offset));
    }
    for (const offset of [0, 1, 2]) {
      expect(labelOf(cellAt(row, col + offset))).toMatch(/breaks a rule$/);
    }
  });

  it('solves the board by placing its marks, and says so once (§2)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    await settle();

    // The game saved the board it dealt, answer included (§11): that is how
    // this test knows the marks without reaching past the UI.
    const { solution, givens } = savedGame();
    for (let index = 0; index < 36; index++) {
      if (givens[index] !== '.') continue;
      const cell = cellAt(Math.floor(index / 6) + 1, (index % 6) + 1);
      await user.click(cell);
      if (solution[index] === '1') await user.click(cell);
    }

    expect(board().classList.contains('bn-board-solved')).toBe(true);
    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    const actions = within(screen.getByRole('alertdialog')).getAllByRole('button');
    // The same board first, then a new one (§10).
    expect(actions[0]).toHaveTextContent('Retry same board');
    expect(actions[1]).toHaveTextContent('New board');
  });

  it('restarts the same board from a clean slate after asking', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    const cell = firstOpenCell();
    const name = labelOf(cell).replace(/^Empty, /, '');
    await user.click(cell);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: `Empty, ${name}` })).toBeInTheDocument();
  });

  it('keeps a suspended board, marks and all, across a relaunch (§11)', async () => {
    const user = userEvent.setup();
    deviceStore.set(BN_STORAGE_KEYS.flags, tutorialDone[BN_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    const cell = firstOpenCell();
    const name = labelOf(cell).replace(/^Empty, /, '');
    await user.click(cell);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    expect(screen.getByRole('button', { name: `Sun, ${name}` })).toBeInTheDocument();
  });
});

describe('hints (§8)', () => {
  it('offers a hint with the line that proves it, and never writes a mark', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);

    const before = cells().map(labelOf);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    // A fresh, randomly seeded Easy board: the first step may be any of T1–T3,
    // but every sentence names the outlined cell and the mark it proves.
    expect(screen.getByRole('status')).toHaveTextContent(/outlined cell.*a (sun|moon)/);
    expect(cells().map(labelOf)).toEqual(before);
    expect(document.querySelectorAll('.bn-cell-hint')).toHaveLength(1);
    expect(document.querySelectorAll('.bn-cell-reason').length).toBeGreaterThan(0);
  });

  it('points at a broken rule first', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    const [row, col] = openRun(6);
    for (const offset of [0, 1, 2]) await user.click(cellAt(row, col + offset));
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent('The highlighted cells break a rule.');
  });

  it('H asks for the hint, same as the button (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent(/outlined/);
  });

  it('H does nothing while the Retry dialog is open (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(screen.getByRole('alertdialog', { name: 'Retry same board' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h' });
    expect(document.querySelector('.toast')).toBeNull();
    expect(
      document.querySelectorAll('.bn-cell-hint, .bn-cell-support, .bn-cell-reason'),
    ).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent(/outlined/);
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no undo — every tap already cycles back round (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports per-difficulty facts on the statistics screen, and no streak (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getByRole('heading', { name: 'Easy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hard' })).toBeInTheDocument();
    expect(screen.getByText('Days solved')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
