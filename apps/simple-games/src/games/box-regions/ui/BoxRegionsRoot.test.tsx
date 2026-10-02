import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createDailySession, localDateString, regionCells, type BoxRegionsSession } from '../game';
import { BR_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { BoxRegionsRoot } from './BoxRegionsRoot';

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
      <BoxRegionsRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [BR_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Box Regions board/ });
const cells = () => within(board()).getAllByRole('button');

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BoxRegionsRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store a launch reads, entered by the other door (issue #113). */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BoxRegionsRoot onExit={onExit} entry="shortcut" />
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
  const raw = deviceStore.get(BR_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

/** Gives the grid the rectangle a stroke measures itself against. */
function giveCellsALayout(width: number, height: number): void {
  const grid = document.querySelector('.br-cells') as Element;
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

/** One stroke: press on `from`, move to `to`, let go — the tap it would be when they are one cell. */
function strokeFrom(from: number, to: number, width: number) {
  const origin = cells()[from]!;
  if (from === to) {
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerId: 1,
      pointerType: 'touch',
      ...pointAt(from, width),
    });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(from, width) });
    fireEvent.click(origin, { detail: 1 });
    return;
  }
  fireEvent.pointerDown(origin, {
    button: 0,
    pointerId: 1,
    pointerType: 'touch',
    ...pointAt(from, width),
  });
  fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(to, width) });
  fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(to, width) });
  fireEvent.click(origin, { detail: 1 });
}

/** Draws one box of the answer, corner to corner. */
function drawAnswerBox(truth: BoxRegionsSession, region: number) {
  const box = regionCells(truth.solution, region);
  strokeFrom(box[0]!, box[box.length - 1]!, truth.width);
}

/** A box of the answer bigger than one cell — something a stroke draws and a tap removes. */
const bigBox = (truth: BoxRegionsSession): number =>
  truth.clues.findIndex((_, region) => regionCells(truth.solution, region).length > 1);

const today = () => localDateString(new Date());

/** Opens today's daily. */
async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
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

    expect(await screen.findByText('Cut into boxes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Read the clues')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Draw corner to corner')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(cells()).toHaveLength(25);
  });
});

describe('playing (§3, §4, §6)', () => {
  it('draws a box corner to corner, and reads the board aloud', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await openDaily(user);
    giveCellsALayout(truth.width, truth.height);

    const region = bigBox(truth);
    const box = regionCells(truth.solution, region);
    const letter = new RegExp(`box ${String.fromCharCode(65 + region)}`);
    expect(cells()[box[0]!]).toHaveAccessibleName(/unassigned/);
    drawAnswerBox(truth, region);
    for (const cell of box) expect(cells()[cell]).toHaveAccessibleName(letter);
    // A clue with a number shows just the number once its box is right.
    const clue = truth.clues[region]!;
    if (clue.size !== null) expect(cells()[clue.index]).toHaveTextContent(String(clue.size));
  });

  it('removes a whole box with a tap, and undoes one step at a time', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await openDaily(user);
    giveCellsALayout(truth.width, truth.height);
    const region = bigBox(truth);
    const box = regionCells(truth.solution, region);
    const letter = new RegExp(`box ${String.fromCharCode(65 + region)}`);

    drawAnswerBox(truth, region);
    // The tap on any one cell: the whole box goes.
    await user.click(cells()[box[box.length - 1]!]!);
    for (const cell of box) expect(cells()[cell]).toHaveAccessibleName(/unassigned/);

    // Undo the tap: the box is back. Undo again, by keyboard: the stroke goes.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    for (const cell of box) expect(cells()[cell]).toHaveAccessibleName(letter);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    for (const cell of box) expect(cells()[cell]).toHaveAccessibleName(/unassigned/);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('makes an undrawn clue a 1×1 with a tap, and does nothing on a bare cell', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    const clue = truth.clues[0]!.index;
    await user.click(cells()[clue]!);
    expect(cells()[clue]).toHaveAccessibleName(/box A/);
    const bare = truth.solution.findIndex(
      (_, index) => !truth.clues.some((c) => c.index === index),
    );
    await user.click(cells()[bare]!);
    expect(cells()[bare]).toHaveAccessibleName(/unassigned/);
  });

  it('solves the daily by drawing its answer, and says so once (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    giveCellsALayout(truth.width, truth.height);

    for (let region = 0; region < truth.clues.length; region++) drawAnswerBox(truth, region);

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
    expect(screen.getByRole('status')).toHaveTextContent(/box/);
    const after = cells().map((cell) => cell.getAttribute('aria-label'));
    expect(after).toEqual(before);
  });

  it('H asks for the hint, same as the Hint button (issue #93)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByRole('status')).toHaveTextContent(/box/);
  });

  it('points at a box that disagrees with the answer first', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));

    // A bigger box's clue tapped in as a 1×1: legal to draw, not the answer.
    await user.click(cells()[truth.clues[bigBox(truth)]!.index]!);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'The highlighted box does not match the answer.',
    );
  });
});

describe('retry and the home (§9, §11)', () => {
  it('rebuilds the same board on retry, after asking', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Daily Challenge/ });
    const truth = createDailySession(today());
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    giveCellsALayout(truth.width, truth.height);
    const region = bigBox(truth);
    drawAnswerBox(truth, region);

    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(screen.getByRole('alertdialog', { name: 'Start over?' })).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    expect(cells()[regionCells(truth.solution, region)[0]!]).toHaveAccessibleName(/unassigned/);
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
    deviceStore.set(BR_STORAGE_KEYS.flags, tutorialDone[BR_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    const truth = createDailySession(today());
    const region = bigBox(truth);
    const cell = regionCells(truth.solution, region)[0]!;
    const letter = new RegExp(`box ${String.fromCharCode(65 + region)}`);
    await openDaily(user);
    giveCellsALayout(truth.width, truth.height);
    drawAnswerBox(truth, region);

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    expect(cells()[cell]).toHaveAccessibleName(letter);

    // The process dies; the next launch reads the device store.
    cleanup();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Daily Challenge.*Resume/ }));
    expect(cells()[cell]).toHaveAccessibleName(letter);
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
    deviceStore.set(BR_STORAGE_KEYS.flags, tutorialDone[BR_STORAGE_KEYS.flags]!);
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
    deviceStore.set(BR_STORAGE_KEYS.flags, tutorialDone[BR_STORAGE_KEYS.flags]!);
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
    deviceStore.set(BR_STORAGE_KEYS.flags, tutorialDone[BR_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();
    expect(screen.getByRole('group', { name: /Box Regions board/ })).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    deviceStore.set(BR_STORAGE_KEYS.flags, tutorialDone[BR_STORAGE_KEYS.flags]!);
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
    expect(screen.queryByRole('group', { name: /Box Regions board/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it (§12)', async () => {
    launchFromShortcut();
    expect(await screen.findByText('Cut into boxes')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Box Regions board/ })).not.toBeInTheDocument();
  });
});
