import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  createDailySession,
  createDifficultySession,
  localDateString,
  neighbors,
  type ShapeRegionsSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { SR_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { ShapeRegionsRoot } from './ShapeRegionsRoot';

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
      <ShapeRegionsRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [SR_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Shape Regions board/ });
const cells = () => within(board()).getAllByRole('button');

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ShapeRegionsRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store a launch reads, entered by the other door (issue #113). */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ShapeRegionsRoot onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return onExit;
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
  const raw = deviceStore.get(SR_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

/** Gives the grid the rectangle a stroke measures itself against. */
function giveCellsALayout(width: number, height: number): void {
  const grid = document.querySelector('.sr-cells') as Element;
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: CELL_PX * width,
    height: CELL_PX * height,
    right: CELL_PX * width,
    bottom: CELL_PX * height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

const pointAt = (index: number, width: number) => ({
  clientX: CELL_PX * ((index % width) + 0.5),
  clientY: CELL_PX * (Math.floor(index / width) + 0.5),
});

/** One short stroke: press on `from`, move to `to`, let go. */
function strokeFrom(from: number, to: number, width: number) {
  const origin = cells()[from]!;
  fireEvent.pointerDown(origin, {
    button: 0,
    pointerId: 1,
    pointerType: 'touch',
    ...pointAt(from, width),
  });
  fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(to, width) });
  fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(to, width) });
}

const today = () => localDateString(new Date());

/**
 * A region with a chain of two beyond its clue — `n1` touching the clue, `n2`
 * touching `n1` but not the clue — so that removing `n1` also strands `n2`.
 */
function chainIn(truth: ShapeRegionsSession): { region: number; n1: number; n2: number } | null {
  for (let region = 0; region < truth.clues.length; region++) {
    const clue = truth.clues[region]!.index;
    const near = neighbors(clue, truth.width, truth.height);
    for (const n1 of near) {
      if (truth.solution[n1] !== region) continue;
      for (const n2 of neighbors(n1, truth.width, truth.height)) {
        if (n2 === clue || truth.solution[n2] !== region || near.includes(n2)) continue;
        return { region, n1, n2 };
      }
    }
  }
  return null;
}

/** The first easy board (by seed) with such a chain — a known board to resume from. */
function boardWithChain(): ShapeRegionsSession {
  for (let i = 0; i < 200; i++) {
    const truth = createDifficultySession('easy', `shape-regions-easy-chain-${i}`);
    if (chainIn(truth) !== null) return truth;
  }
  throw new Error('no easy board in the first 200 seeds has a two-cell chain');
}

/** The saved-game slot a suspended board sits in, ready for the device store or a kv. */
const savedBoard = (truth: ShapeRegionsSession) => ({
  [SR_STORAGE_KEYS.game]: JSON.stringify(toPersisted(truth, 1)),
});

/** A region and one cell beside its clue that belongs to it — one stroke away. */
function stepIn(truth: ShapeRegionsSession): { region: number; n1: number } {
  for (let region = 0; region < truth.clues.length; region++) {
    const clue = truth.clues[region]!.index;
    for (const n1 of neighbors(clue, truth.width, truth.height)) {
      if (truth.solution[n1] === region) return { region, n1 };
    }
  }
  throw new Error('no region has a second cell');
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run', () => {
  it('shows Quick Rules and starts an easy board right after (§12)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Number and symbol')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Grow from the clue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Fill the board')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(cells()).toHaveLength(25);
  });
});

describe('playing (§3, §4, §6)', () => {
  it('grows a region by dragging from its clue, and reads the board aloud', async () => {
    const user = userEvent.setup();
    const truth = boardWithChain();
    renderGame({ ...tutorialDone, ...savedBoard(truth) });
    const { region, n1 } = chainIn(truth)!;
    await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    giveCellsALayout(truth.width, truth.height);

    const letter = String.fromCharCode(65 + region);
    expect(cells()[n1]).toHaveAccessibleName(/unassigned/);
    strokeFrom(truth.clues[region]!.index, n1, truth.width);
    expect(cells()[n1]).toHaveAccessibleName(new RegExp(`shape ${letter}`));
    // The clue counts what has grown, in ASCII, when it has a number to count to.
    const clue = truth.clues[region]!;
    if (clue.size !== null) expect(cells()[clue.index]).toHaveTextContent(`2/${clue.size}`);
  });

  it('takes a cell back with a tap, cascade included, and undoes one step at a time', async () => {
    const user = userEvent.setup();
    const truth = boardWithChain();
    renderGame({ ...tutorialDone, ...savedBoard(truth) });
    const { region, n1, n2 } = chainIn(truth)!;
    await user.click(await screen.findByRole('button', { name: /^Easy.*Resume/ }));
    giveCellsALayout(truth.width, truth.height);
    const letter = new RegExp(`shape ${String.fromCharCode(65 + region)}`);

    strokeFrom(truth.clues[region]!.index, n1, truth.width);
    strokeFrom(n1, n2, truth.width);
    expect(cells()[n2]).toHaveAccessibleName(letter);

    // The tap: the cell goes, and so does the one it was holding on.
    await user.click(cells()[n1]!);
    expect(cells()[n1]).toHaveAccessibleName(/unassigned/);
    expect(cells()[n2]).toHaveAccessibleName(/unassigned/);

    // Undo the tap: both are back. Undo again, by keyboard: the second stroke goes.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cells()[n1]).toHaveAccessibleName(letter);
    expect(cells()[n2]).toHaveAccessibleName(letter);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(cells()[n1]).toHaveAccessibleName(letter);
    expect(cells()[n2]).toHaveAccessibleName(/unassigned/);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(cells()[n1]).toHaveAccessibleName(/unassigned/);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('never lets a clue cell be tapped away', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    const clue = truth.clues[0]!.index;
    await user.click(cells()[clue]!);
    expect(cells()[clue]).toHaveAccessibleName(/shape A/);
  });

  it('solves the daily by painting its answer, and says so once (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    giveCellsALayout(truth.width, truth.height);

    // Region by region, cell by cell, each stroke from a cell already in.
    for (let region = 0; region < truth.clues.length; region++) {
      const inRegion = new Set([truth.clues[region]!.index]);
      const wanted = truth.solution.flatMap((r, i) => (r === region ? [i] : []));
      let progress = true;
      while (inRegion.size < wanted.length && progress) {
        progress = false;
        for (const cell of wanted) {
          if (inRegion.has(cell)) continue;
          const from = neighbors(cell, truth.width, truth.height).find((n) => inRegion.has(n));
          if (from === undefined) continue;
          strokeFrom(from, cell, truth.width);
          inRegion.add(cell);
          progress = true;
        }
      }
    }

    expect(await screen.findByRole('alertdialog', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('hints (§6)', () => {
  it('offers a free hint that names the next step and writes nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));

    const before = cells().map((cell) => cell.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(/highlighted shape/);
    const after = cells().map((cell) => cell.getAttribute('aria-label'));
    expect(after).toEqual(before);
  });

  it('H asks for the hint, same as the Hint button (issue #93)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent(/highlighted shape/);
  });

  it('points at a region that disagrees with the answer first', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    giveCellsALayout(truth.width, truth.height);

    // The first clue with a free neighbour the answer gives to someone else.
    let done = false;
    for (let region = 0; region < truth.clues.length && !done; region++) {
      const clue = truth.clues[region]!.index;
      for (const cell of neighbors(clue, truth.width, truth.height)) {
        if (truth.solution[cell] === region || truth.clues.some((c) => c.index === cell)) continue;
        strokeFrom(clue, cell, truth.width);
        done = true;
        break;
      }
    }
    expect(done).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'The highlighted shape does not match the answer.',
    );
  });
});

describe('retry and the home (§9, §11)', () => {
  it('rebuilds the same board on retry, after asking', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    const { region, n1 } = chainIn(truth) ?? { region: 0, n1: -1 };
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    giveCellsALayout(truth.width, truth.height);
    if (n1 >= 0) strokeFrom(truth.clues[region]!.index, n1, truth.width);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(screen.getByRole('alertdialog', { name: 'Start over?' })).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    if (n1 >= 0) expect(cells()[n1]).toHaveAccessibleName(/unassigned/);
    expect(cells()).toHaveLength(truth.width * truth.height);
  });

  it('asks before replacing a suspended difficulty game with another difficulty', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Medium/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the board in progress?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });

  it('keeps a suspended board across leaving, and across a relaunch (§11)', async () => {
    const user = userEvent.setup();
    deviceStore.set(SR_STORAGE_KEYS.flags, tutorialDone[SR_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    const truth = createDailySession(today());
    const { region, n1 } = stepIn(truth);
    const letter = new RegExp(`shape ${String.fromCharCode(65 + region)}`);
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    giveCellsALayout(truth.width, truth.height);
    strokeFrom(truth.clues[region]!.index, n1, truth.width);

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    expect(cells()[n1]).toHaveAccessibleName(letter);

    // The process dies; the next launch reads the device store.
    cleanup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(cells()[n1]).toHaveAccessibleName(letter);
  });

  it('shows no clock while playing, and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports per-difficulty facts on the statistics screen, and no streak (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getAllByText('Puzzles solved')).toHaveLength(3);
    expect(screen.getByText('Days cleared')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('backgrounding (§11)', () => {
  // Play five seconds, background the app, let Android kill it, come back:
  // the board returns, and so must the five seconds. The session save alone
  // cannot carry them — `activate` treats a restored session's elapsedSeconds
  // as already counted, so anything not booked before the kill is gone.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(SR_STORAGE_KEYS.flags, tutorialDone[SR_STORAGE_KEYS.flags]!);
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
      fireEvent.click(screen.getByRole('button', { name: /Easy.*Resume/ }));

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books nothing when a suspended game is opened and left unresumed', async () => {
    deviceStore.set(SR_STORAGE_KEYS.flags, tutorialDone[SR_STORAGE_KEYS.flags]!);
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
 * A pinned home-screen shortcut, and what this game does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own two save slots (§11).
 */
describe('a home-screen shortcut', () => {
  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    deviceStore.set(SR_STORAGE_KEYS.flags, tutorialDone[SR_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();
    expect(screen.getByRole('group', { name: /Shape Regions board/ })).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    deviceStore.set(SR_STORAGE_KEYS.flags, tutorialDone[SR_STORAGE_KEYS.flags]!);
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
    expect(screen.queryByRole('group', { name: /Shape Regions board/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§12)', async () => {
    launchFromShortcut();
    expect(await screen.findByText('Number and symbol')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Shape Regions board/ })).not.toBeInTheDocument();
  });
});
