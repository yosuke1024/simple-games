import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { FC_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { FreeCellRoot } from './FreeCellRoot';

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
      <FreeCellRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [FC_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/**
 * The golden deal (compatibility.test.ts). Its column tops are, left to right:
 * 6♦ 3♠ 10♠ 9♦ Q♠ 2♦ 9♣ 2♥ — so the 2♦ onto the 3♠ is a legal single-card
 * move, and the two red twos give a second one if the first ever changes.
 */
const savedGoldenGame = {
  ...tutorialDone,
  [FC_STORAGE_KEYS.game]: JSON.stringify(toPersisted(createFreeSession('fc-free-golden'), 1)),
};

const table = () => screen.getByRole('group', { name: 'FreeCell table' });

async function resumeGoldenGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Resume/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <FreeCellRoot onExit={vi.fn()} />
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
  const raw = deviceStore.get(FC_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

/** The suspended free deal's own clock, as it survives on disk (§10). */
function storedDealSeconds(): number {
  const raw = deviceStore.get(FC_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  // Play, background the app, let Android kill it, come back: the deal returns,
  // and so must the seconds. The session save alone cannot carry them —
  // `activate` treats a restored session's elapsedSeconds as already counted,
  // so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(FC_STORAGE_KEYS.flags, tutorialDone[FC_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /New deal/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Resume/ }));

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
 * A pinned home-screen shortcut, and what FreeCell does about it (issue #113).
 * The shell says only which door was used; every decision below is this game's,
 * taken from its own two save slots (§10).
 */
describe('a home-screen shortcut', () => {
  /** The same device store a launch reads, entered by the other door. */
  function launchFromShortcut(onExit: () => void = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <FreeCellRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(FC_STORAGE_KEYS.flags, tutorialDone[FC_STORAGE_KEYS.flags]!);
  }

  const board = () => screen.queryByRole('group', { name: 'FreeCell table' });
  const home = () => screen.queryByRole('button', { name: /New deal/ });

  /** Deals a free game and walks away from it, the way a player suspends one. */
  async function suspendFreeDeal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /New deal/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  /** The same, for the other slot: today's daily, left in progress. */
  async function suspendDailyDeal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  it('opens the one suspended deal straight onto its table', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await suspendFreeDeal(user);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(board()).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  it('opens a suspended daily onto the daily, not the empty free slot', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await suspendDailyDeal(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // The mode has to be seeded with the screen: `session` is an index into
    // the two slots, so resuming the daily on the default 'free' would put an
    // empty table on screen instead of a wrong one.
    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('leaves the table for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await suspendFreeDeal(user);
    cleanup();

    const onExit = vi.fn();
    launchFromShortcut(onExit);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a table is this game's home, whichever door the table
    // was reached through: the way in did not add a screen to undo.
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when both deals are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await suspendFreeDeal(user);
    await suspendDailyDeal(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — neither was chosen for the
    // player, and neither was thrown away either (§10).
    expect(board()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FreeCell.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
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
    await suspendFreeDeal(user);
    cleanup();

    launch();
    await settle();

    expect(board()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FreeCell.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    const user = userEvent.setup();
    // A suspended deal AND no Quick Rules behind the player. The two can only
    // meet through "Reset Local Data", which wipes the flags and leaves the
    // saves — but the test has to arrange it, because a launch against an empty
    // store would land on the tutorial whatever the gate said.
    taughtAlready();
    launch();
    await suspendFreeDeal(user);
    cleanup();
    deviceStore.delete(FC_STORAGE_KEYS.flags);

    launchFromShortcut();

    // Quick Rules first: a shortcut is not a way past them (§11).
    expect(await screen.findByText('Down by one, colors alternate')).toBeInTheDocument();
    expect(board()).not.toBeInTheDocument();
  });

  /**
   * The counterpart of the backgrounding test above: resuming at mount seeds
   * the same two clocks `activate` does, so the seconds already played are
   * neither lost nor counted again.
   *
   * Both numbers are read, and that is the point. The statistics alone cannot
   * see the worse of the two mistakes: with NEITHER clock seeded the errors
   * cancel — `withElapsed` writes the deal's own clock back DOWN to the
   * seconds since mount, and the booking then adds exactly that many — so the
   * total comes out right while the minutes the player spent are quietly gone
   * from the deal they are still playing.
   */
  it('does not lose or double-book the resumed deal’s play seconds', async () => {
    deviceStore.set(FC_STORAGE_KEYS.flags, tutorialDone[FC_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /New deal/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedDealSeconds()).toBe(5);

      // The process dies here; the shortcut is what starts the next one.
      cleanup();
      launchFromShortcut();
      await settle();
      expect(board()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, on a deal that still knows it has
      // been played for eight.
      expect(storedPlaySeconds()).toBe(8);
      expect(storedDealSeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and deals a free game right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Down by one, colors alternate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Four cells, one card each')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Aces build to kings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // A fresh FreeCell layout (§1): four empty cells, four empty foundations,
    // and every one of the 52 cards face up — the thing that most separates
    // this table from Klondike's.
    for (const n of [1, 2, 3, 4]) {
      expect(
        within(table()).getByRole('button', { name: `Free cell ${n}, empty` }),
      ).toBeInTheDocument();
    }
    expect(table().querySelectorAll('[data-card]')).toHaveLength(52);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('moves a card with two taps (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    await user.click(within(table()).getByRole('button', { name: '2 of diamonds' }));
    await user.click(within(table()).getByRole('button', { name: '3 of spades' }));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('parks a card in the cell that was tapped, and undoes it (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    const undo = screen.getByRole('button', { name: /Undo/ });
    expect(undo).toBeDisabled();

    await user.click(within(table()).getByRole('button', { name: '6 of diamonds' }));
    await user.click(within(table()).getByRole('button', { name: 'Free cell 3, empty' }));

    // The card went where the finger went — not into the first empty cell.
    expect(
      within(table()).getByRole('button', { name: 'Free cell 3, 6 of diamonds' }),
    ).toBeInTheDocument();
    expect(within(table()).getByRole('button', { name: 'Free cell 1, empty' })).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Undo/ }));
    expect(within(table()).getByRole('button', { name: 'Free cell 3, empty' })).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
  });

  it('offers no hint button, no clock and no streak (§4, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    // FreeCell is the one card game in the collection with no hint: every card
    // is face up, so a hint would be taking the decision, not lifting a veil.
    expect(screen.queryByRole('button', { name: /Hint/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('reaches the daily, the statistics and the way out', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Past Dailies/i }));
    expect(screen.getByRole('heading', { name: /Daily Challenge/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: /Statistics/i }));
    expect(screen.getByText('Deals played')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalled();
  });
});

/* Keyboard input is an adapter over the same tap handler (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes a move, same as the Undo button (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    await user.click(within(table()).getByRole('button', { name: '2 of diamonds' }));
    await user.click(within(table()).getByRole('button', { name: '3 of spades' }));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(table()).getByRole('button', { name: '2 of diamonds' })).toBeInTheDocument();
  });
});
