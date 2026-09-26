/**
 * The game as a player meets it (docs/NUMBER_PATH_RULES.md §4, §5, §7–§9):
 * three steps of Quick Rules and straight into a board, a path drawn by
 * tapping and by dragging, taken back by dragging back, by tapping and by
 * Undo, a hint that points without drawing, and neither a clock nor a streak
 * anywhere on the screen.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createDailySession, createDifficultySession, localDateString } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { NP_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { NumberPathRoot } from './NumberPathRoot';

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
      <NumberPathRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [NP_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/**
 * A known 5×5, suspended on the difficulty slot: 1 at cell 14 (row 3, column
 * 5), the road running up the right edge first (compatibility.test.ts pins
 * the mechanism that makes this the same board on every machine).
 */
const KNOWN = createDifficultySession('easy', 'number-path-easy-test');
const SIZE = KNOWN.board.width;
const knownSuspended = {
  ...tutorialDone,
  [NP_STORAGE_KEYS.game]: JSON.stringify(toPersisted(KNOWN, 1_754_000_000_000)),
};

const at = (index: number) => ({ row: Math.floor(index / SIZE) + 1, col: (index % SIZE) + 1 });
const board = () => screen.getByRole('group', { name: /Number Path board/ });
const cellAt = (index: number) => {
  const { row, col } = at(index);
  return within(board()).getByRole('button', {
    name: new RegExp(`row ${row}, column ${col},`, 'i'),
  });
};
const stepOf = (index: number): number | null => {
  const match = /step (\d+)$/.exec(cellAt(index).getAttribute('aria-label') ?? '');
  return match ? Number(match[1]) : null;
};
const pathLength = () =>
  within(board())
    .getAllByRole('button')
    .filter((cell) => /, on the path, step \d+$/.test(cell.getAttribute('aria-label') ?? ''))
    .length;

async function resumeKnown(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NumberPathRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store a launch reads, entered by the other door (issue #113). */
function launchFromShortcut(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NumberPathRoot onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return onExit;
}

const settle = () => act(async () => undefined);

function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

function storedPlaySeconds(): number {
  const raw = deviceStore.get(NP_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;
const pointAt = (index: number) => ({
  clientX: CELL_PX * ((index % SIZE) + 0.5),
  clientY: CELL_PX * (Math.floor(index / SIZE) + 0.5),
});
function giveCellsALayout(): void {
  const cells = document.querySelector('.np-cells') as Element;
  const side = CELL_PX * SIZE;
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

describe('first run', () => {
  it('shows Quick Rules and starts a board right after (§10)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Follow the numbers')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Cover every square')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Walls block the way')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // The difficulty last chosen — easy on a fresh install (§7): a 5×5.
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(25);
  });
});

describe('home (§7)', () => {
  it('offers three boards and the daily, and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /^Easy/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Medium.*6×6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hard.*7×7/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    expect(screen.queryByText(/^Levels$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('asks before replacing a suspended board with another difficulty', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await user.click(await screen.findByRole('button', { name: /^Hard/ }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
  });

  it('starts the daily on a 6×6 and names the mode', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(36);
    const truth = createDailySession(localDateString(new Date()));
    expect(pathLength()).toBe(1);
    expect(truth.board.width).toBe(6);
  });
});

describe('drawing the path (§4)', () => {
  const [START, SECOND, THIRD, FOURTH] = KNOWN.solution as unknown as [
    number,
    number,
    number,
    number,
  ];

  it('extends onto a tapped neighbour, and cuts back to a tapped cell on the path', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);

    expect(stepOf(START)).toBe(1);
    await user.click(cellAt(SECOND));
    expect(stepOf(SECOND)).toBe(2);
    await user.click(cellAt(THIRD));
    expect(stepOf(THIRD)).toBe(3);
    expect(pathLength()).toBe(3);

    // A cell out of reach changes nothing.
    await user.click(cellAt(0));
    expect(pathLength()).toBe(3);

    await user.click(cellAt(START));
    expect(pathLength()).toBe(1);
    expect(cellAt(SECOND).getAttribute('aria-label')).toMatch(/not on the path$/);
  });

  it('extends under a drag, and dragging back takes the path back', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);
    giveCellsALayout();

    const origin = cellAt(START);
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerId: 1,
      pointerType: 'touch',
      ...pointAt(START),
    });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(SECOND) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(THIRD) });
    expect(pathLength()).toBe(3);
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(SECOND) });
    expect(pathLength()).toBe(2);
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(SECOND) });
    // The click the release leaves behind is spent: it does not cut the path back.
    fireEvent.click(origin, { detail: 1 });
    expect(pathLength()).toBe(2);
  });

  it('keeps what a cancelled drag drew, and leaves no stray tap behind (issue #169)', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);
    giveCellsALayout();

    const origin = cellAt(START);
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerId: 1,
      pointerType: 'touch',
      ...pointAt(START),
    });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(SECOND) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(THIRD) });
    fireEvent.pointerCancel(origin, { pointerId: 1, ...pointAt(THIRD) });
    expect(pathLength()).toBe(3);
    // A finger that is gone draws nothing more, and its click cuts nothing back.
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(FOURTH) });
    fireEvent.click(origin, { detail: 1 });
    expect(pathLength()).toBe(3);
  });

  it('is undone one stroke at a time (§5)', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);
    giveCellsALayout();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    const origin = cellAt(START);
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerId: 1,
      pointerType: 'touch',
      ...pointAt(START),
    });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(SECOND) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(THIRD) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(FOURTH) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(FOURTH) });
    expect(pathLength()).toBe(4);
    // Then one tap on top: two steps to take back, the tap first.
    await user.click(cellAt(KNOWN.solution[4]!));
    expect(pathLength()).toBe(5);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(pathLength()).toBe(4);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(pathLength()).toBe(1);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('solves the board by drawing its road, and says so once (§2)', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);

    for (const cell of KNOWN.solution.slice(1)) await user.click(cellAt(cell));

    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New board' })).toBeInTheDocument();
  });
});

describe('hint (§5)', () => {
  const [START, SECOND] = KNOWN.solution as unknown as [number, number];

  it('points at the next cell without drawing it', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent('The marked square is the next step.');
    expect(cellAt(SECOND).className).toContain('np-cell-hint');
    expect(pathLength()).toBe(1);
  });

  it('points back to the road once the path has strayed', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);

    // 1 sits at row 3, column 5; the road goes up, so down is astray.
    await user.click(cellAt(START + SIZE));
    expect(pathLength()).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent('Back up to the marked square.');
    expect(cellAt(START).className).toContain('np-cell-hint');
    expect(cellAt(START + SIZE).className).toContain('np-cell-astray');
    expect(pathLength()).toBe(2);
  });
});

describe('retry (§5)', () => {
  it('asks, then rebuilds the same board with a clean path', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);
    await user.click(cellAt(KNOWN.solution[1]!));
    expect(pathLength()).toBe(2);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(pathLength()).toBe(1);
    // Same board: 1 is still where it was.
    expect(cellAt(KNOWN.solution[0]!).getAttribute('aria-label')).toMatch(/^Number 1/);
  });
});

/* Keyboard input is an adapter over the same handlers (issue #93): every
   key here produces board state a gesture also produces. */
describe('keyboard (§4, issue #93)', () => {
  const [START, SECOND] = KNOWN.solution as unknown as [number, number];

  it('arrows extend from the end, Backspace steps back, Ctrl+Z undoes, H asks for the hint', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);

    // The road leaves 1 upwards on this board.
    expect(SECOND).toBe(START - SIZE);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(pathLength()).toBe(2);
    // Into a wall or off the board: nothing.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(pathLength()).toBe(2);
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(pathLength()).toBe(1);

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(pathLength()).toBe(3);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(pathLength()).toBe(2);

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent('The marked square is the next step.');
  });

  it('ignores a held arrow, and goes quiet under the restart dialog', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);

    fireEvent.keyDown(window, { key: 'ArrowUp', repeat: true });
    expect(pathLength()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(pathLength()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(pathLength()).toBe(2);
  });
});

describe('what the game screen refuses to show', () => {
  it('has no clock and no streak while playing (§8)', async () => {
    const user = userEvent.setup();
    renderGame(knownSuspended);
    await resumeKnown(user);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports per-difficulty facts on the statistics screen, and no streak (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Boards solved')).toHaveLength(3);
    expect(screen.getByText('Days solved')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('persistence (§9)', () => {
  it('saves the path as it is drawn and resumes it on the next launch', async () => {
    const user = userEvent.setup();
    deviceStore.set(NP_STORAGE_KEYS.flags, tutorialDone[NP_STORAGE_KEYS.flags]!);
    deviceStore.set(NP_STORAGE_KEYS.game, knownSuspended[NP_STORAGE_KEYS.game]!);
    launch();
    await resumeKnown(user);
    await user.click(cellAt(KNOWN.solution[1]!));
    await user.click(cellAt(KNOWN.solution[2]!));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();

    const saved = JSON.parse(deviceStore.get(NP_STORAGE_KEYS.game)!) as { path: number[] };
    expect(saved.path).toEqual(KNOWN.solution.slice(0, 3));

    cleanup();
    launch();
    await resumeKnown(user);
    expect(pathLength()).toBe(3);
    expect(stepOf(KNOWN.solution[2]!)).toBe(3);
    // The undo history is not part of the record: nothing to take back yet.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(NP_STORAGE_KEYS.flags, tutorialDone[NP_STORAGE_KEYS.flags]!);
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
      fireEvent.click(screen.getByRole('button', { name: /^Easy.*Resume/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books nothing when a suspended game is opened and left unresumed', async () => {
    deviceStore.set(NP_STORAGE_KEYS.flags, tutorialDone[NP_STORAGE_KEYS.flags]!);
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
 * A pinned home-screen shortcut, and what Number Path does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own two save slots (§7, §9).
 */
describe('a home-screen shortcut', () => {
  const taughtAlready = () =>
    deviceStore.set(NP_STORAGE_KEYS.flags, tutorialDone[NP_STORAGE_KEYS.flags]!);
  const boardOrNull = () => screen.queryByRole('group', { name: /Number Path board/ });
  const homeScreen = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  it('opens the one suspended game straight onto its board', async () => {
    taughtAlready();
    deviceStore.set(NP_STORAGE_KEYS.game, knownSuspended[NP_STORAGE_KEYS.game]!);
    launchFromShortcut();
    await settle();
    expect(boardOrNull()).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(homeScreen()).not.toBeInTheDocument();
  });

  it('opens a suspended daily just as readily', async () => {
    taughtAlready();
    const daily = createDailySession('2026-09-26');
    deviceStore.set(NP_STORAGE_KEYS.dailyGame, JSON.stringify(toPersisted(daily, 1)));
    launchFromShortcut();
    await settle();
    expect(boardOrNull()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    taughtAlready();
    deviceStore.set(NP_STORAGE_KEYS.game, knownSuspended[NP_STORAGE_KEYS.game]!);
    const daily = createDailySession('2026-09-26');
    deviceStore.set(NP_STORAGE_KEYS.dailyGame, JSON.stringify(toPersisted(daily, 1)));
    launchFromShortcut();
    await settle();
    expect(boardOrNull()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended, and the ordinary door always does', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();
    expect(boardOrNull()).not.toBeInTheDocument();
    expect(homeScreen()).toBeInTheDocument();
    cleanup();

    deviceStore.set(NP_STORAGE_KEYS.game, knownSuspended[NP_STORAGE_KEYS.game]!);
    launch();
    await settle();
    expect(boardOrNull()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§10)', async () => {
    deviceStore.set(NP_STORAGE_KEYS.game, knownSuspended[NP_STORAGE_KEYS.game]!);
    launchFromShortcut();
    expect(await screen.findByText('Follow the numbers')).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });

  it('does not lose or double-book the resumed game’s play seconds', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(boardOrNull()).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
      const saved = JSON.parse(deviceStore.get(NP_STORAGE_KEYS.dailyGame)!) as {
        elapsedSeconds: number;
      };
      expect(saved.elapsedSeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
