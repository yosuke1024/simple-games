import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { WS_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { WaterSortRoot } from './WaterSortRoot';

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
      <WaterSortRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [WS_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: 'Water sort tubes' });
const tubes = () => within(board()).getAllByRole('button');

/** The golden level-1 board (compatibility.test.ts): 2112.2021.0001.. */
async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <WaterSortRoot onExit={vi.fn()} />
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

/** Total play seconds as they survive on disk. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(WS_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

/** The suspended level game's own clock, as it survives on disk (§10). */
function storedLevelSeconds(): number {
  const raw = deviceStore.get(WS_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as PersistedGame).elapsedSeconds;
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
    deviceStore.set(WS_STORAGE_KEYS.flags, tutorialDone[WS_STORAGE_KEYS.flags]!);
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
 * A pinned home-screen shortcut, and what Water Sort does about it (issue
 * #113). The shell says only which door was used; every decision below is this
 * game's, taken from its own three save slots (§10).
 */
describe('a home-screen shortcut', () => {
  /** The same store `launch` reads, entered by the other door. */
  function launchFromShortcut(onExit: () => void = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <WaterSortRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(WS_STORAGE_KEYS.flags, tutorialDone[WS_STORAGE_KEYS.flags]!);
  }

  const boardOrNull = () => screen.queryByRole('group', { name: 'Water sort tubes' });
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  /** Starts the game the named home button offers, then suspends it (§10). */
  async function playAndSuspend(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
    await user.click(await screen.findByRole('button', { name }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await playAndSuspend(user, /Level 1/);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(boardOrNull()).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  // The mode is half of the answer: the board on screen is sessions[activeMode],
  // so a daily resumed under the default 'level' would be a blank screen.
  it('opens a suspended daily on the daily board, not an empty one', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await playAndSuspend(user, /Daily Challenge/);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(boardOrNull()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
  });

  // The third slot, on its own. Each of the three has to be reachable as the
  // only suspended game, or a rule that quietly stopped looking at one of them
  // would still count right in every arrangement a test happened to build.
  it('opens a suspended free board on the free board, not an empty one', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await playAndSuspend(user, /Free Play/);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(boardOrNull()).toBeInTheDocument();
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
  });

  it('leaves that board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await playAndSuspend(user, /Level 1/);
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

  it('opens the home screen when two games are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await playAndSuspend(user, /Level 1/);
    await playAndSuspend(user, /Free Play/);
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — nothing was chosen for the
    // player, and nothing was thrown away either.
    expect(boardOrNull()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(boardOrNull()).not.toBeInTheDocument();
    expect(home()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await playAndSuspend(user, /Level 1/);
    cleanup();

    launch();
    await settle();

    expect(boardOrNull()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    launchFromShortcut();

    // A first launch has no suspended game to resume anyway; what this pins is
    // that the shortcut cannot become a way past Quick Rules (§11).
    expect(await screen.findByText('Pour same onto same')).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });

  it('teaches it first even with a game suspended, when the flag is gone', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await playAndSuspend(user, /Level 1/);
    // A corrupt or lost ws.flags record reads as a first run (§10: bad saved
    // data is read past, never fatal) while the game itself survives. Quick
    // Rules still come first; the suspended board is not deleted, only waited.
    deviceStore.delete(WS_STORAGE_KEYS.flags);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(screen.getByText('Pour same onto same')).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding test above: resuming at mount seeds the
  // same two clocks `activate` does, so the seconds already played are neither
  // lost from the save nor counted into the statistics again.
  it('does not book the resumed game’s play seconds a second time', async () => {
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

      // The process dies here; the shortcut is what brings it back.
      cleanup();
      launchFromShortcut();
      await settle();
      expect(boardOrNull()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, and the board's own clock went
      // forward rather than back to the seconds since this mount.
      expect(storedPlaySeconds()).toBe(8);
      expect(storedLevelSeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Pour same onto same')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Two spare tubes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('One color per tube')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Level 1 is three colors: five tubes, two of them the empty spares (§1).
    expect(tubes()).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /bottom to top: empty/ })).toHaveLength(2);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('pours with two taps and counts the move (§3, §4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Golden board: tube 1 holds 1 1 1 2 (top is color 2). Pour it into an
    // empty spare — always legal (§3).
    await user.click(screen.getByRole('button', { name: 'Tube 1, bottom to top: 1 1 1 2' }));
    await user.click(screen.getByRole('button', { name: 'Tube 4, bottom to top: empty' }));

    expect(screen.getByRole('button', { name: 'Tube 4, bottom to top: 2' })).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('undo puts the board and the move count back (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Tube 1, bottom to top: 1 1 1 2' }));
    await user.click(screen.getByRole('button', { name: 'Tube 4, bottom to top: empty' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(
      screen.getByRole('button', { name: 'Tube 1, bottom to top: 1 1 1 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('offers a free hint that leaves the game playable (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    // A generated board always has a proven way forward from the start, so no
    // "no way forward" toast — and the game keeps playing.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§4, §7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
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

  it('reports level and daily facts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    expect(screen.getByText('Dailies solved')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('free play (§6)', () => {
  it('deals a board at the chosen tier, and resumes it from the home', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await screen.findByRole('button', { name: /Level 1/ });

    // The picker stands on medium until told otherwise; here, hard.
    const picker = screen.getByRole('group', { name: 'Difficulty' });
    await user.click(within(picker).getByRole('button', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: /Free Play/ }));

    // Hard is level 95's deal: nine colours, so eleven tubes — and the top
    // bar names the mode, not a level number.
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
    expect(tubes()).toHaveLength(11);

    // One pour into a spare — always legal (§3) — then away and back: the
    // board is where it was left.
    const isEmpty = (tube: HTMLElement) => /: empty$/.test(tube.getAttribute('aria-label') ?? '');
    await user.click(tubes().find((tube) => !isEmpty(tube))!);
    await user.click(tubes().find(isEmpty)!);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume.*Hard/ })).toBeInTheDocument();
    // The level climb is untouched by a free board.
    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    expect(tubes()).toHaveLength(11);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('asks before replacing a suspended free board with a new one', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the last pour, same as the Undo button', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Tube 1, bottom to top: 1 1 1 2' }));
    await user.click(screen.getByRole('button', { name: 'Tube 4, bottom to top: empty' }));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(
      screen.getByRole('button', { name: 'Tube 1, bottom to top: 1 1 1 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});
