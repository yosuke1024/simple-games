/**
 * The game as a player meets it (docs/CROWN_GRID_RULES.md §2, §4, §6, §9,
 * §11): three steps of Quick Rules and straight into a board, a tap that
 * cycles, a drag that crosses, a hint that explains without playing, a solve
 * that says so once — and neither a clock, a streak, nor an undo anywhere on
 * the screen.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { CG_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { CrownGridRoot } from './CrownGridRoot';

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
      <CrownGridRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [CG_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /^Crown Grid board/ });
const cellAt = (row: number, col: number) =>
  within(board()).getByRole('button', { name: new RegExp(`row ${row}, column ${col}, region`) });
const labelAt = (row: number, col: number) => cellAt(row, col).getAttribute('aria-label') ?? '';

async function startEasy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Easy/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CrownGridRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store a launch reads, entered by the other door (issue #113). */
function launchFromShortcut(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CrownGridRoot onExit={onExit} entry="shortcut" />
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
  const raw = deviceStore.get(CG_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

/** The answer of the board on screen, read from what the game itself saved (§11). */
function savedSolution(): number[] {
  const raw = deviceStore.get(CG_STORAGE_KEYS.game)!;
  return [...(JSON.parse(raw) as { solution: string }).solution].map(Number);
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;
const pointAt = (row: number, col: number) => ({
  clientX: CELL_PX * (col - 1 + 0.5),
  clientY: CELL_PX * (row - 1 + 0.5),
});
function giveCellsALayout(size: number): void {
  const cells = document.querySelector('.cg-cells') as Element;
  const side = CELL_PX * size;
  vi.spyOn(cells, 'getBoundingClientRect').mockReturnValue({
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

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('backgrounding (§11)', () => {
  // Play five seconds, background the app, let Android kill it, come back: the
  // board returns, and so must the five seconds — counted once.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(CG_STORAGE_KEYS.flags, tutorialDone[CG_STORAGE_KEYS.flags]!);
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
    deviceStore.set(CG_STORAGE_KEYS.flags, tutorialDone[CG_STORAGE_KEYS.flags]!);
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
 * A pinned home-screen shortcut, and what Crown Grid does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own two save slots (§9, §11).
 */
describe('a home-screen shortcut', () => {
  const taughtAlready = () =>
    deviceStore.set(CG_STORAGE_KEYS.flags, tutorialDone[CG_STORAGE_KEYS.flags]!);
  const boardOrNull = () => screen.queryByRole('group', { name: /^Crown Grid board/ });
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
    expect(await screen.findByText('One crown each')).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts a board right after (§12)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('One crown each')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Crowns never touch')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Tap and drag')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // The remembered difficulty starts at Easy: a 6×6, thirty-six squares.
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(36);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
  });
});

describe('home (§9)', () => {
  it('offers three boards and the daily, no level list, and hands control back', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /^Easy.*6×6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Medium.*8×8/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hard.*9×9/ })).toBeInTheDocument();
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

  it('starts the daily at medium, an 8×8', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(64);
  });

  it('asks before another day replaces a suspended daily, and resumes the same day (§11)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    // Today's daily, one × in, then home: the daily slot is suspended.
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(cellAt(1, 1));
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: /Past Dailies/ }));
    const days = () =>
      within(document.querySelector('.daily-list') as HTMLElement).getAllByRole('button');
    expect(days()[0]).toHaveTextContent(/Today.*Resume/);

    // Yesterday: a different day, so the suspended board is at stake.
    await user.click(days()[1]!);
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(days()[0]).toHaveTextContent(/Today.*Resume/);

    // Today again: that is a resume, which replaces nothing and asks nothing.
    await user.click(days()[0]!);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(labelAt(1, 1)).toMatch(/^Crossed out/);

    // And confirming another day does replace it, with a clean board.
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Past Dailies/ }));
    await user.click(days()[1]!);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(labelAt(1, 1)).toMatch(/^Empty/);
  });
});

describe('playing (§2, §4)', () => {
  it('cycles a square empty → × → crown → empty under the same tap', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);

    expect(labelAt(1, 1)).toMatch(/^Empty/);
    await user.click(cellAt(1, 1));
    expect(labelAt(1, 1)).toMatch(/^Crossed out/);
    await user.click(cellAt(1, 1));
    expect(labelAt(1, 1)).toMatch(/^Crown/);
    await user.click(cellAt(1, 1));
    expect(labelAt(1, 1)).toMatch(/^Empty/);
  });

  it('marks × along a drag, on empty squares only, and does not tap the origin too', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    // A crown at (2,3): the drag must leave it alone.
    await user.click(cellAt(2, 3));
    await user.click(cellAt(2, 3));
    giveCellsALayout(6);

    const origin = cellAt(2, 1);
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerType: 'touch',
      pointerId: 1,
      ...pointAt(2, 1),
    });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(2, 2) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(2, 4) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(2, 4) });
    fireEvent.click(origin, { detail: 1 });

    expect(labelAt(2, 1)).toMatch(/^Crossed out/);
    expect(labelAt(2, 2)).toMatch(/^Crossed out/);
    expect(labelAt(2, 3)).toMatch(/^Crown/);
    expect(labelAt(2, 4)).toMatch(/^Crossed out/);
    expect(labelAt(2, 5)).toMatch(/^Empty/);
  });

  it('stops a drag where the platform cancels it, and leaves no stray tap behind', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    giveCellsALayout(6);

    const origin = cellAt(3, 1);
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerType: 'touch',
      pointerId: 1,
      ...pointAt(3, 1),
    });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(3, 2) });
    fireEvent.pointerCancel(origin, { pointerId: 1 });
    // Moves after the cancel belong to nobody.
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(3, 5) });

    expect(labelAt(3, 1)).toMatch(/^Crossed out/);
    expect(labelAt(3, 2)).toMatch(/^Crossed out/);
    expect(labelAt(3, 3)).toMatch(/^Empty/);
    expect(labelAt(3, 5)).toMatch(/^Empty/);
    // And the origin is still exactly one × — nothing tapped it to a crown.
    expect(labelAt(3, 1)).toMatch(/^Crossed out/);
  });

  it('tints crowns that break a rule, and says so in the label (§5)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    for (const col of [1, 2]) {
      await user.click(cellAt(1, col));
      await user.click(cellAt(1, col));
    }
    expect(labelAt(1, 1)).toMatch(/breaks a rule$/);
    expect(labelAt(1, 2)).toMatch(/breaks a rule$/);
    expect(labelAt(1, 3)).not.toMatch(/breaks a rule/);
  });

  it('solves the board by placing its crowns, and says so once (§2)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    await settle();

    // The game saved the board it dealt, answer included (§11): that is how
    // this test knows where the crowns go without reaching past the UI.
    const solution = savedSolution();
    expect(solution).toHaveLength(6);
    for (let row = 0; row < solution.length; row++) {
      const cell = cellAt(row + 1, solution[row]! + 1);
      await user.click(cell);
      await user.click(cell);
    }

    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New board' })).toBeInTheDocument();
  });

  it('restarts the same board from a clean slate after asking', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    await user.click(cellAt(1, 1));
    expect(labelAt(1, 1)).toMatch(/^Crossed out/);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(labelAt(1, 1)).toMatch(/^Empty/);
  });

  it('keeps a suspended board, marks and all, across a relaunch (§11)', async () => {
    const user = userEvent.setup();
    deviceStore.set(CG_STORAGE_KEYS.flags, tutorialDone[CG_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(cellAt(4, 4));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    expect(labelAt(4, 4)).toMatch(/^Crossed out/);
  });
});

describe('hints (§6)', () => {
  it('offers a hint with the area that proves it, and never writes a mark', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);

    const before = within(board())
      .getAllByRole('button')
      .map((cell) => cell.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(/the highlighted area shows why/);
    const after = within(board())
      .getAllByRole('button')
      .map((cell) => cell.getAttribute('aria-label'));
    expect(after).toEqual(before);
    expect(document.querySelectorAll('.cg-cell-reason').length).toBeGreaterThan(0);
  });

  it('points at a broken rule first', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    for (const col of [1, 2]) {
      await user.click(cellAt(1, col));
      await user.click(cellAt(1, col));
    }
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent('The highlighted crowns break a rule.');
  });

  it('H asks for the hint, same as the button (issue #93)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent(/highlighted/);
  });

  it('H does nothing while the Retry dialog is open (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startEasy(user);
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(screen.getByRole('alertdialog', { name: 'Retry same board' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h' });
    // No hint behind the dialog: no message, nothing highlighted, nothing counted.
    expect(document.querySelector('.toast')).toBeNull();
    expect(
      document.querySelectorAll('.cg-cell-hint, .cg-cell-support, .cg-cell-reason'),
    ).toHaveLength(0);

    // The key comes back with the board.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent(/highlighted/);
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no undo — every tap already cycles back round (§14)', async () => {
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
