import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { SP_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { SlidingPuzzleRoot } from './SlidingPuzzleRoot';

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
      <SlidingPuzzleRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [SP_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

interface Spot {
  readonly row: number;
  readonly col: number;
}

const spotOf = (element: Element): Spot => {
  const match = /row (\d+), column (\d+)/.exec(element.getAttribute('aria-label') ?? '');
  if (!match) throw new Error(`no position in "${element.getAttribute('aria-label')}"`);
  return { row: Number(match[1]), col: Number(match[2]) };
};

const board = () => screen.getByRole('group', { name: 'Sliding puzzle board' });
/** The gap — announced, but never a control (§12). */
const gap = () => within(board()).getByRole('img');
const tiles = () => within(board()).getAllByRole('button');

/** A tile sharing an edge with the gap: the simplest legal move there is. */
function tileBesideGap(): HTMLElement {
  const here = spotOf(gap());
  const found = tiles().find((tile) => {
    const spot = spotOf(tile);
    return Math.abs(spot.row - here.row) + Math.abs(spot.col - here.col) === 1;
  });
  if (!found) throw new Error('no tile beside the gap');
  return found;
}

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SlidingPuzzleRoot onExit={vi.fn()} />
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
  const raw = deviceStore.get(SP_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.size3.totalPlaySeconds + stats.size4.totalPlaySeconds + stats.size5.totalPlaySeconds;
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
    deviceStore.set(SP_STORAGE_KEYS.flags, tutorialDone[SP_STORAGE_KEYS.flags]!);
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
 * A pinned home-screen shortcut, and what Sliding Puzzle does about it (issue
 * #113). The shell says only which door was used; every decision below is this
 * game's, taken from its own two save slots (§10).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut(onExit: () => void = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SlidingPuzzleRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(SP_STORAGE_KEYS.flags, tutorialDone[SP_STORAGE_KEYS.flags]!);
  }

  /** Suspends a level game the way a player does: start it, then leave it. */
  async function suspendLevelOne(user: ReturnType<typeof userEvent.setup>) {
    await startLevelOne(user);
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  const boardIfAny = () => screen.queryByRole('group', { name: 'Sliding puzzle board' });
  /** A control only the game's home screen has. */
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  /** Games started on the 3x3 boards, as they survive on disk (§9). */
  function storedPlays(): number {
    const raw = deviceStore.get(SP_STORAGE_KEYS.stats);
    return raw === undefined ? 0 : (JSON.parse(raw) as Stats).size3.played;
  }

  /** A suspended game's own clock, as it survives on disk (§10). */
  function storedSeconds(key: string): number {
    const raw = deviceStore.get(key);
    return raw === undefined ? 0 : (JSON.parse(raw) as PersistedGame).elapsedSeconds;
  }
  const storedLevelSeconds = () => storedSeconds(SP_STORAGE_KEYS.game);
  const storedDailySeconds = () => storedSeconds(SP_STORAGE_KEYS.dailyGame);

  /** Starting a game where the clock is faked — which rules out userEvent. */
  const startLevelNow = () => fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));
  const startDailyNow = () =>
    fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(boardIfAny()).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
    // Picked up, not started over: a resume never spends a play (§9).
    expect(storedPlays()).toBe(1);
  });

  // The daily lives in the other slot, and the whole UI reads the session of
  // whichever slot is active — so this is the case that catches a resume that
  // opens the board without saying which game is on it.
  it('opens a sole suspended daily on the daily board, not an empty one', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    expect(boardIfAny()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    // The daily is a 4x4 (§7), so the board on screen is the daily's own.
    expect(tiles()).toHaveLength(15);
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();

    const onExit = vi.fn();
    launchFromShortcut(onExit);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when both modes are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — nothing was chosen for
    // the player, and nothing was thrown away either.
    expect(boardIfAny()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(boardIfAny()).not.toBeInTheDocument();
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

    expect(boardIfAny()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules (§11)', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevelOne(user);
    cleanup();
    // The one arrangement where the two could collide: a suspended game, and
    // a tutorial flag that never made it to disk (the flag and the save are
    // separate fire-and-forget writes). Quick Rules still win.
    deviceStore.delete(SP_STORAGE_KEYS.flags);

    launchFromShortcut();
    await settle();

    expect(screen.getByText('Tap next to the gap')).toBeInTheDocument();
    expect(boardIfAny()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding test above: resuming at mount seeds
  // the same two clocks `activate` does, so the seconds already played are
  // neither counted again nor lost. The two numbers below fail in opposite
  // directions — the total catches a second booking, and the game's own clock
  // catches the restored minutes being overwritten by the seconds since mount,
  // which is what would stamp a fabricated record onto a solve (§9). The total
  // alone would see neither: with both clocks unseeded the two errors cancel,
  // and the board quietly loses the minutes it is still being played for.
  //
  // Once per slot, because the seeding has to read the slot that was resumed:
  // clocks seeded from the level slot come what may are invisible here on a
  // level and destroy the daily's.
  it.each([
    { slot: 'level', start: startLevelNow, stored: storedLevelSeconds },
    { slot: 'daily', start: startDailyNow, stored: storedDailySeconds },
  ])('keeps the resumed $slot’s play seconds, and books them once', async ({ start, stored }) => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      start();
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(stored()).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(boardIfAny()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, and still eight on the board's
      // own record: the restored five are neither lost nor booked twice.
      expect(storedPlaySeconds()).toBe(8);
      expect(stored()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Tap next to the gap')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A whole row moves')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Put 1 to the end in order')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is a 3x3: eight tiles plus the gap.
    expect(tiles()).toHaveLength(8);
    expect(gap()).toBeInTheDocument();
    // Undo is there from the first frame, and free — it just has nothing yet.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('playing', () => {
  it('slides the tapped tile into the gap and counts the move (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const gapWas = spotOf(gap());
    const tile = tileBesideGap();
    const tileWas = spotOf(tile);
    const value = tile.textContent;

    await user.click(tile);

    // The tile is where the gap was, and the gap is where the tile was.
    expect(spotOf(tile)).toEqual(gapWas);
    expect(tile.textContent).toBe(value);
    expect(spotOf(gap())).toEqual(tileWas);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('ignores a tap that shares neither the gap’s row nor its column (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const here = spotOf(gap());
    const diagonal = tiles().find((tile) => {
      const spot = spotOf(tile);
      return spot.row !== here.row && spot.col !== here.col;
    })!;
    const before = diagonal.getAttribute('aria-label');

    await user.click(diagonal);

    expect(diagonal.getAttribute('aria-label')).toBe(before);
    expect(spotOf(gap())).toEqual(here);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('undo puts the board and the move count back (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const gapWas = spotOf(gap());
    const tile = tileBesideGap();
    const tileWas = spotOf(tile);
    await user.click(tile);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(spotOf(tile)).toEqual(tileWas);
    expect(spotOf(gap())).toEqual(gapWas);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

/* Keyboard input is an adapter over the same tap/undo handlers (issue #93):
   every assertion here checks board state the taps also produce, and the
   direction test pins down which tile travels for which arrow. */
describe('keyboard (issue #93)', () => {
  const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;

  /** The cell whose tile would travel into the gap for a given arrow — the
   *  tile's own direction, not the gap's (issue #93's locked semantics). All
   *  spots are 1-indexed, matching `spotOf`. */
  function sourceForKey(gapSpot: Spot, size: number, key: string): Spot | null {
    const { row, col } = gapSpot;
    if (key === 'ArrowLeft') return col < size ? { row, col: col + 1 } : null;
    if (key === 'ArrowRight') return col > 1 ? { row, col: col - 1 } : null;
    if (key === 'ArrowUp') return row < size ? { row: row + 1, col } : null;
    if (key === 'ArrowDown') return row > 1 ? { row: row - 1, col } : null;
    return null;
  }

  function tileAt(spot: Spot): HTMLElement {
    const found = tiles().find((tile) => {
      const here = spotOf(tile);
      return here.row === spot.row && here.col === spot.col;
    });
    if (!found) throw new Error(`no tile at row ${spot.row}, column ${spot.col}`);
    return found;
  }

  it('an arrow key slides the tile that travels that way into the gap', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const size = Number(board().dataset.size);
    const gapWas = spotOf(gap());
    const candidate = ARROW_KEYS.map((key) => ({
      key,
      source: sourceForKey(gapWas, size, key),
    })).find((entry) => entry.source !== null)!;
    const movingTile = tileAt(candidate.source!);
    const value = movingTile.textContent;

    fireEvent.keyDown(window, { key: candidate.key });

    // The tile that travelled is where the gap was, and the gap is where that
    // tile used to be — the exact semantics issue #93 locks in per arrow.
    expect(spotOf(movingTile)).toEqual(gapWas);
    expect(movingTile.textContent).toBe(value);
    expect(spotOf(gap())).toEqual(candidate.source);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('an arrow with no tile in that direction changes nothing', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const size = Number(board().dataset.size);
    let gapSpot = spotOf(gap());
    let invalidKey = ARROW_KEYS.find((key) => sourceForKey(gapSpot, size, key) === null);
    if (!invalidKey) {
      // Every direction has a tile only with the gap away from every edge;
      // one legal move is enough to put it back on one.
      const validKey = ARROW_KEYS.find((key) => sourceForKey(gapSpot, size, key) !== null)!;
      fireEvent.keyDown(window, { key: validKey });
      gapSpot = spotOf(gap());
      invalidKey = ARROW_KEYS.find((key) => sourceForKey(gapSpot, size, key) === null);
    }
    const before = tiles().map((tile) => tile.getAttribute('aria-label'));
    const movesBefore = screen.getByText(/Moves\s*\d+/).textContent;

    fireEvent.keyDown(window, { key: invalidKey! });

    expect(tiles().map((tile) => tile.getAttribute('aria-label'))).toEqual(before);
    expect(spotOf(gap())).toEqual(gapSpot);
    expect(screen.getByText(/Moves\s*\d+/).textContent).toBe(movesBefore);
  });

  it('Ctrl+Z undoes the same as the Undo button', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const gapWas = spotOf(gap());
    const tile = tileBesideGap();
    const tileWas = spotOf(tile);
    await user.click(tile);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(spotOf(tile)).toEqual(tileWas);
    expect(spotOf(gap())).toEqual(gapWas);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no hint, at any point in a game (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument();

    // Still nothing after playing a move — a hint is not unlocked by progress.
    await user.click(tileBesideGap());
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§4, §7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports per-size facts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    expect(screen.getByText('3x3')).toBeInTheDocument();
    expect(screen.getByText('4x4')).toBeInTheDocument();
    expect(screen.getByText('5x5')).toBeInTheDocument();
    expect(screen.getAllByText('Fewest moves')).toHaveLength(3);
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
