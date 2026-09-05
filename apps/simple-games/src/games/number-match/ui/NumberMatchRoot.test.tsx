import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  createLevelSession,
  createScore,
  generateLevelBoard,
  initialCellsForLevel,
  isLive,
} from '../game';
import { AppProvider } from '../state/GameContext';
import { type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  NM_STORAGE_KEYS,
  prefsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type ModeStats,
  type PersistedGame,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { NumberMatchRoot, NumberMatchScreens } from './NumberMatchRoot';

/**
 * A stand-in for the device store, for the blocks below that read a save back
 * rather than only checking what a screen shows. The root's `kv` prop is a
 * load-side seam only — saves always go to Capacitor Preferences — so a test
 * that plays, quits and relaunches has to stand behind both, and a session
 * handed to the provider by hand comes out here too.
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

const LEVEL1_CELLS = generateLevelBoard(1).filter(isLive).length;

function renderApp(
  flags: Flags = flagsSchema.defaultValue(),
  progress: Progress = progressSchema.defaultValue(),
  sessions: SavedGames = { level: null, daily: null, free: null },
) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <AppProvider
        initialStats={statsSchema.defaultValue()}
        initialFlags={flags}
        initialProgress={progress}
        initialPrefs={prefsSchema.defaultValue()}
        initialSessions={sessions}
        onExit={onExit}
      >
        <NumberMatchScreens />
      </AppProvider>
    </SettingsProvider>,
  );
  return onExit;
}

const done: Flags = {
  schemaVersion: 1,
  tutorialCompleted: true,
  wildIntroSeen: true,
  stoneIntroSeen: true,
};

/** Launches the game against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NumberMatchRoot onExit={vi.fn()} />
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

/** The play seconds a suspended slot carries on disk (§14). */
function storedElapsedSeconds(key: string): number | null {
  const raw = deviceStore.get(key);
  if (raw === undefined) return null;
  return (JSON.parse(raw) as PersistedGame).elapsedSeconds;
}

/** The level mode's statistics as they survive on disk. */
function storedLevelStats(): ModeStats | null {
  const raw = deviceStore.get(NM_STORAGE_KEYS.stats);
  if (raw === undefined) return null;
  return (JSON.parse(raw) as Stats).level;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run flow', () => {
  it('shows the 3-step tutorial and starts level 1 right after (spec §17)', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByText('Equal, or adds up to 10')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Pick two that connect')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Level 1 board and the three free actions.
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    const board = screen.getByRole('group', { name: 'Game board' });
    expect(within(board).getAllByRole('button')).toHaveLength(LEVEL1_CELLS);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });
});

describe('home flow', () => {
  it('shows home for returning players and opens statistics', async () => {
    const user = userEvent.setup();
    renderApp(done);

    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    // Three play sections: Levels, Daily Challenge and Free Play, plus the
    // best-score block.
    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getByText('Best Scores')).toBeInTheDocument();
  });

  it('hands control back to the collection from home', async () => {
    const user = userEvent.setup();
    const onExit = renderApp(done);

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('opens the level select with locked levels beyond the frontier', async () => {
    const user = userEvent.setup();
    renderApp(done, { ...progressSchema.defaultValue(), highestUnlocked: 3 });

    await user.click(screen.getByRole('button', { name: /^Levels/ }));
    expect(screen.getByRole('button', { name: 'Level 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Level 4, locked')).toBeInTheDocument();
    // Starting an unlocked level goes straight to the board.
    await user.click(screen.getByRole('button', { name: 'Level 2' }));
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
  });
});

describe('levels chip', () => {
  it('counts the levels with a recorded best out of the hundred', () => {
    renderApp(done, {
      ...progressSchema.defaultValue(),
      highestUnlocked: 3,
      bestScores: { '1': 200, '2': 180 },
    });
    expect(screen.getByRole('button', { name: /^Levels/ })).toHaveTextContent('2/100');
  });
});

describe('free play (§11)', () => {
  it('starts a board at the chosen tier, and resumes it from the home', async () => {
    const user = userEvent.setup();
    renderApp(done);

    // The picker stands on medium until told otherwise; here, hard.
    const picker = screen.getByRole('group', { name: 'Difficulty' });
    expect(within(picker).getByRole('button', { name: 'Medium' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(picker).getByRole('button', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: /Free Play/ }));

    // The top bar names the mode and the tier — no level number.
    expect(screen.getByText('Free Play · Hard')).toBeInTheDocument();
    expect(screen.queryByText(/^Level \d/)).not.toBeInTheDocument();

    // A match, then away and back: the board is where it was left.
    const board = screen.getByRole('group', { name: 'Game board' });
    const fresh = within(board).getAllByRole('button').length;
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const hinted = board.querySelectorAll('.cell-hint');
    await user.click(hinted[0] as HTMLElement);
    await user.click(hinted[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume.*Hard/ })).toBeInTheDocument();
    // The level climb is untouched by a free board.
    expect(screen.getByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Levels/ })).toHaveTextContent('0/100');

    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    expect(screen.getByText('Free Play · Hard')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Game board' })).getAllByRole('button').length,
    ).toBeLessThan(fresh);
  });

  it('asks before replacing a suspended free board with a new one', async () => {
    const user = userEvent.setup();
    renderApp(done);
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Free Play.*Resume/ })).toBeInTheDocument();
  });
});

describe('gameplay', () => {
  it('hint highlights a valid pair, matching scores it, and undo restores', async () => {
    const user = userEvent.setup();
    renderApp(done);
    await user.click(screen.getByRole('button', { name: /Level 1/ }));

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const board = screen.getByRole('group', { name: 'Game board' });
    const hinted = board.querySelectorAll('.cell-hint');
    expect(hinted).toHaveLength(2);

    await user.click(hinted[0] as HTMLElement);
    await user.click(hinted[1] as HTMLElement);
    expect(within(board).getAllByRole('button').length).toBeLessThanOrEqual(LEVEL1_CELLS - 2);
    // The match earned points (shown quietly in the top bar).
    const score = document.querySelector('.game-score');
    expect(Number(score!.textContent!.replace(/\D/g, ''))).toBeGreaterThan(0);

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeEnabled();
    await user.click(undoButton);
    expect(within(board).getAllByRole('button')).toHaveLength(LEVEL1_CELLS);
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the last match, same as the Undo button', async () => {
    const user = userEvent.setup();
    renderApp(done);
    await user.click(screen.getByRole('button', { name: /Level 1/ }));

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    const board = screen.getByRole('group', { name: 'Game board' });
    const hinted = board.querySelectorAll('.cell-hint');
    await user.click(hinted[0] as HTMLElement);
    await user.click(hinted[1] as HTMLElement);
    expect(within(board).getAllByRole('button').length).toBeLessThanOrEqual(LEVEL1_CELLS - 2);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(within(board).getAllByRole('button')).toHaveLength(LEVEL1_CELLS);
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
    // A level board suspended with nine seconds on it, the way the last launch
    // left it on disk.
    const suspended = { ...createLevelSession(1), elapsedSeconds: 9 };
    renderApp(done, progressSchema.defaultValue(), {
      level: suspended,
      daily: null,
      free: null,
    });

    // The game's own home — Resume is there to be pressed, and is not.
    expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

    background();
    await settle();
    expect(storedElapsedSeconds(NM_STORAGE_KEYS.game)).toBe(9);
  });
});

/**
 * A pinned home-screen shortcut, and what Number Match does about it (issue
 * #113). The shell says only which door the launch came through; every
 * decision below is this game's, taken from its own three save slots (§14).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut() {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <NumberMatchRoot onExit={vi.fn()} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** The tutorial behind the player, the way every launch after the first finds it. */
  function taughtAlready() {
    deviceStore.set(NM_STORAGE_KEYS.flags, JSON.stringify(done));
  }

  const board = () => screen.queryByRole('group', { name: 'Game board' });
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  /** Suspends the level game: start it from home, then step back. */
  async function suspendLevel(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /Level 1/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevel(user);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  it('opens a suspended free board just the same, not only a level game', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    // The board reads through the active slot, which starts on the level one:
    // a resume that moved only the screen would draw an empty screen here,
    // with no way back (§14 — the three slots are independent).
    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Free Play · Medium')).toBeInTheDocument();
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

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendLevel(user);
    cleanup();

    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <NumberMatchRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
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
    await suspendLevel(user);
    await user.click(screen.getByRole('button', { name: /Free Play/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    launchFromShortcut();
    await settle();

    // The slots exist so that neither costs the other (§14): both are still
    // there to be picked up by hand, and nothing was chosen for the player.
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
    await suspendLevel(user);
    cleanup();

    launch();
    await settle();

    expect(board()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    const user = userEvent.setup();
    // A suspended board AND no tutorial behind the player. The two can only
    // meet through "Reset Local Data", which wipes the flags and leaves the
    // saves — but the test has to arrange that collision, because a launch
    // with an empty store would land on the tutorial whatever the gate said.
    taughtAlready();
    launch();
    await settle();
    await suspendLevel(user);
    cleanup();
    deviceStore.delete(NM_STORAGE_KEYS.flags);

    launchFromShortcut();

    // The three steps first: a shortcut is not a way past them (spec §17).
    expect(await screen.findByText('Equal, or adds up to 10')).toBeInTheDocument();
    expect(board()).not.toBeInTheDocument();
  });

  /*
   * The clock the shortcut has to hand over. Number Match books play seconds
   * once, at the terminal transition (statsLogic.ts), so the damage from an
   * unseeded clock shows up here first: the next save writes the session's
   * elapsed seconds back down to the seconds since mount, and the clear that
   * follows books that fiction into the statistics and the best time.
   */
  it('keeps the seconds already played when it resumes at launch', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedElapsedSeconds(NM_STORAGE_KEYS.game)).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(board()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once: the resumed five carried over
      // rather than being lost, and the three since mount added to them.
      expect(storedElapsedSeconds(NM_STORAGE_KEYS.game)).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * A level board one match from cleared, suspended with `elapsedSeconds`
   * already on its clock. Seeded rather than played: the last two numbers of
   * a real board are reached only by clearing every other pair first, and it
   * is the ending this test is about, not the play before it.
   */
  function seedNearlyClearedLevel(elapsedSeconds: number) {
    const record: PersistedGame = {
      schemaVersion: 2,
      mode: 'level',
      seed: 'resumed-clock',
      dailyDate: null,
      level: 1,
      freeTier: null,
      // Two live numbers, side by side, adding to ten (§2): one tap each and
      // the board is cleared.
      values: '19',
      mask: '00',
      score: createScore(initialCellsForLevel(1)),
      moveCount: 0,
      addCount: 0,
      hintCount: 0,
      elapsedSeconds,
      savedAt: Date.now(),
    };
    deviceStore.set(NM_STORAGE_KEYS.game, JSON.stringify(record));
  }

  /*
   * Where the lost seconds end up. Number Match books play time once, at the
   * terminal transition (statsLogic.ts), so an unseeded clock is quiet until
   * the resumed game ends — and then it books the seconds since mount as the
   * whole game and stamps that same fiction on the best clear time.
   */
  it('books the resumed seconds into the statistics, not the seconds since mount', async () => {
    taughtAlready();
    seedNearlyClearedLevel(5);
    vi.useFakeTimers();
    try {
      launchFromShortcut();
      await settle();
      const cells = within(screen.getByRole('group', { name: 'Game board' })).getAllByRole(
        'button',
      );
      act(() => vi.advanceTimersByTime(3_000));
      fireEvent.click(cells[0]!);
      fireEvent.click(cells[1]!);
      await settle();

      expect(storedLevelStats()).toMatchObject({
        cleared: 1,
        totalPlaySeconds: 8,
        bestClearSeconds: 8,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
