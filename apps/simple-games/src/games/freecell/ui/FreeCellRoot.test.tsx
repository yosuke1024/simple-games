import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession, isValidBoard } from '../game';
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

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(FC_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
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

describe('opening a suspended game without resuming (#109)', () => {
  // The board is not the only thing a suspended game carries — the minutes on
  // its clock are the player's too. `syncActiveGame` runs on every background
  // from whichever screen is showing, and it writes this provider's play clock
  // into the session it saves. Open the game, never press Resume, background:
  // a clock that never took the restored board's seconds saves a zero over
  // them, and the board comes back looking untouched.
  it("keeps a suspended board's clock when backgrounded from the game's home", async () => {
    deviceStore.set(FC_STORAGE_KEYS.flags, tutorialDone[FC_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /New deal/ }));

      act(() => vi.advanceTimersByTime(9_000));
      background();
      await settle();
      expect(storedBoardSeconds()).toBe(9);

      // The process dies here. Relaunch and stop on the game's own home.
      cleanup();
      launch();
      await settle();
      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

      // Away again without ever resuming: the nine seconds are still there.
      background();
      await settle();
      expect(storedBoardSeconds()).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Drag-to-move (docs/FREECELL_RULES.md §3, issue #119): the screen's half.
 * What the table itself does with a pointer is FreeCellTable.test.tsx's
 * business — this covers the same move functions a tap uses, reached by a
 * drop instead.
 *
 * Every card here is a plain number (`suit * 13 + rank - 1`, suits in the
 * order spades, hearts, diamonds, clubs — types.ts), and the fixtures below
 * are asserted valid in a test of their own: a wrong one would otherwise fail
 * silently by falling back to a fresh deal, not by fireing loudly.
 */
describe('drag (issue #119)', () => {
  const ACE_SPADES = 0; // A of spades
  const NINE_SPADES = 8; // 9 of spades — head of the two-card run
  const EIGHT_HEARTS = 20; // 8 of hearts — tail of that run
  const TEN_HEARTS = 22; // 10 of hearts — the run's legal destination
  const SIX_SPADES = 5; // 6 of spades
  const FIVE_HEARTS = 17; // 5 of hearts — a legal single card onto the six
  const EIGHT_CLUBS = 46; // 8 of clubs
  const KING_SPADES = 12; // K of spades — nothing stacks on a king (§3)
  const SEVEN_DIAMONDS = 32; // 7 of diamonds — a legal single card onto the eight
  const ACE_HEARTS = 13; // A of hearts
  const KING_DIAMONDS = 38; // K of diamonds — a cell filler, never touched

  /** Column 8: everything not named above, so the deal still totals 52 (§1).
   * Its own top (last entry, 51 = K of clubs) never accepts a card either,
   * so it can never accidentally become a destination in these tests. */
  const FILLER_COLUMN = [
    1, 2, 3, 4, 6, 7, 9, 10, 11, 14, 15, 16, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34,
    35, 36, 37, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49, 50, 51,
  ];

  const dragCascades = [
    [ACE_SPADES],
    [TEN_HEARTS],
    [NINE_SPADES, EIGHT_HEARTS],
    [SIX_SPADES],
    [FIVE_HEARTS],
    [EIGHT_CLUBS],
    [KING_SPADES],
    FILLER_COLUMN,
  ];

  /**
   * One of every drag this issue names, each with a legal destination and an
   * illegal one within reach:
   *
   * - column 1: A♠ alone — goes to its own foundation, not another suit's
   * - column 2: 10♥ — receives the 9♠ 8♥ run from column 3
   * - column 3: 9♠ hidden under nothing, topped by 8♥ — the run that moves
   * - column 4: 6♠ — receives the 5♥ from column 5, or nothing from column 7
   * - column 5: 5♥ — the single card that moves onto column 4
   * - column 6: 8♣ — receives the 7♦ from a free cell, or moves into one
   * - column 7: K♠ — nothing stacks here; a drop here always fails
   * - free cells: K♦ (never touched), 7♦ (moves to column 6), one empty
   *   slot, A♥ (moves to its own foundation)
   */
  const dragBoard = {
    cells: [KING_DIAMONDS, SEVEN_DIAMONDS, null, ACE_HEARTS],
    foundations: [[], [], [], []],
    cascades: dragCascades,
  };

  /**
   * The same deal with a second free cell open (cells 1 and 2 both empty),
   * so a drop can be aimed at a specific one that is not simply the only
   * candidate — the 7♦ that would otherwise sit in cell 1 goes to the front
   * of column 8 instead, where it cannot change that column's own top card.
   */
  const dragBoardTwoEmptyCells = {
    cells: [KING_DIAMONDS, null, null, ACE_HEARTS],
    foundations: [[], [], [], []],
    cascades: dragCascades.map((pile, i) => (i === 7 ? [SEVEN_DIAMONDS, ...pile] : pile)),
  };

  /**
   * All four cells full and no empty column, so `maxMoveSize` is 1 — a run
   * that would otherwise be a legal two-card move onto column 2 is carried
   * for nothing, exactly as a tap selection the engine refuses.
   */
  const capacityBoard = {
    cells: [0, 1, 2, 3],
    foundations: [[], [], [], []],
    cascades: [
      [NINE_SPADES, EIGHT_HEARTS],
      [TEN_HEARTS],
      [4],
      [6],
      [7],
      [9],
      [10],
      [
        5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
        35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
      ],
    ],
  };

  it('is a board that could have come from a deal — the fixtures are asserted, not assumed', () => {
    expect(isValidBoard(dragBoard)).toBe(true);
    expect(isValidBoard(dragBoardTwoEmptyCells)).toBe(true);
    expect(isValidBoard(capacityBoard)).toBe(true);
  });

  function savedBoardGame(board: {
    cells: (number | null)[];
    foundations: number[][];
    cascades: number[][];
  }) {
    return {
      ...tutorialDone,
      [FC_STORAGE_KEYS.game]: JSON.stringify({
        schemaVersion: 1,
        mode: 'free',
        seed: 'fc-free-drag',
        dailyDate: null,
        cells: board.cells,
        foundations: board.foundations,
        cascades: board.cascades,
        moveCount: 0,
        elapsedSeconds: 0,
        savedAt: 1,
      }),
    };
  }

  /** The pretend table, in CSS pixels: eight 45px columns on a 50px pitch. */
  const COL = 50;
  const CARD_W = 45;
  const ROW = { top: 0, height: 63 };
  const CASCADE_TOP = 75;
  const rect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  /**
   * jsdom lays nothing out, so the table's zones are handed to it by force,
   * keyed off the same data attributes the table reads them from. Everything
   * else about the gesture is real.
   */
  let layoutSpy: ReturnType<typeof vi.spyOn> | null = null;
  function giveTableALayout(): void {
    layoutSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const el = this as HTMLElement;
      if (el.dataset.topRow !== undefined)
        return rect(0, ROW.top, COL * 8 - (COL - CARD_W), ROW.height);
      if (el.dataset.pile !== undefined) {
        return rect(Number(el.dataset.pile) * COL, CASCADE_TOP, CARD_W, 200);
      }
      if (el.dataset.cell !== undefined) {
        return rect(Number(el.dataset.cell) * COL, ROW.top, CARD_W, ROW.height);
      }
      if (el.dataset.foundation !== undefined) {
        return rect((4 + Number(el.dataset.foundation)) * COL, ROW.top, CARD_W, ROW.height);
      }
      return rect(0, 0, 0, 0);
    });
  }
  afterEach(() => {
    layoutSpy?.mockRestore();
    layoutSpy = null;
  });

  /** A pointer over the middle of column `pile` (0-based), well into the cascades. */
  const overColumn = (pile: number) => ({ clientX: pile * COL + CARD_W / 2, clientY: 160 });
  /** A pointer over the middle of one free cell. */
  const overCell = (cell: number) => ({
    clientX: cell * COL + CARD_W / 2,
    clientY: ROW.height / 2,
  });
  /** A pointer over the middle of one suit's foundation. */
  const overFoundation = (suit: number) => ({
    clientX: (4 + suit) * COL + CARD_W / 2,
    clientY: ROW.height / 2,
  });
  /** Where every press below starts: far enough from every target to travel. */
  const PRESS = { clientX: 22, clientY: 160 };
  /**
   * Where a press on a free cell's own card starts: the mocked centre of that
   * cell. A cell card carries `data-cell` as well as `data-card`, so the table
   * reads a real rectangle for it (unlike a cascade card, which the mock
   * leaves at zero) and aims with that rectangle's centre (§3) — pressing
   * anywhere else would carry a spurious offset into every target below.
   */
  const overCellCenter = (cell: number) => ({
    clientX: cell * COL + CARD_W / 2,
    clientY: ROW.height / 2,
  });

  const card = (name: string | RegExp) => within(table()).getByRole('button', { name });
  const column = (n: number) => within(table()).getByRole('group', { name: `Column ${n}` });

  /** Presses a card at `from` and carries it to `to`, in the events a browser sends. */
  function dragFrom(
    el: HTMLElement,
    from: { clientX: number; clientY: number },
    to: { clientX: number; clientY: number },
  ): void {
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...from });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, ...to });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, ...to });
  }

  /** Presses a card and carries it to `to`, in the events a browser sends. */
  function drag(el: HTMLElement, to: { clientX: number; clientY: number }): void {
    dragFrom(el, PRESS, to);
  }

  async function resumeDragGame(
    user: ReturnType<typeof userEvent.setup>,
    board: { cells: (number | null)[]; foundations: number[][]; cascades: number[][] } = dragBoard,
  ) {
    renderGame(savedBoardGame(board));
    await resumeGoldenGame(user);
    giveTableALayout();
  }

  it('moves a run onto another column (cascade → cascade, multi-card)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(card('9 of spades'), overColumn(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '8 of hearts' })).toBeInTheDocument();
    expect(within(column(3)).queryByRole('button', { name: /of/ })).not.toBeInTheDocument();
  });

  it('moves a single card onto another column (cascade → cascade, single card)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(card('5 of hearts'), overColumn(3));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(4)).getByRole('button', { name: '5 of hearts' })).toBeInTheDocument();
    expect(within(column(4)).getByRole('button', { name: '6 of spades' })).toBeInTheDocument();
  });

  it('parks a card in the free cell it was dropped on, not the first empty one', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user, dragBoardTwoEmptyCells);

    // Cells 1 and 2 (0-based) are both empty; the card must land in the one
    // the finger was over, not simply the first one the engine would pick.
    drag(card('8 of clubs'), overCell(2));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(card('Free cell 3, 8 of clubs')).toBeInTheDocument();
    expect(card('Free cell 2, empty')).toBeInTheDocument();
  });

  it("sends a card to its own foundation, refusing another suit's (cascade → foundation)", async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Every foundation is empty, so an ace fits any of them by rank alone —
    // the suit is what the drop must still get right.
    drag(card('A of spades'), overFoundation(1));
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: 'A of spades' })).toBeInTheDocument();

    drag(card('A of spades'), overFoundation(0));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(card('Foundation, A of spades')).toBeInTheDocument();
  });

  it('plays a free cell card onto a column (cell → cascade)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    dragFrom(card('Free cell 2, 7 of diamonds'), overCellCenter(1), overColumn(5));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(6)).getByRole('button', { name: '7 of diamonds' })).toBeInTheDocument();
    expect(within(column(6)).getByRole('button', { name: '8 of clubs' })).toBeInTheDocument();
    expect(card('Free cell 2, empty')).toBeInTheDocument();
  });

  it('sends a free cell card to its foundation (cell → foundation)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    dragFrom(card('Free cell 4, A of hearts'), overCellCenter(3), overFoundation(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(card('Foundation, A of hearts')).toBeInTheDocument();
    expect(card('Free cell 4, empty')).toBeInTheDocument();
  });

  it('does nothing when a free cell card is dropped on an empty cell', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    dragFrom(card('Free cell 2, 7 of diamonds'), overCellCenter(1), overCell(2));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(card('Free cell 2, 7 of diamonds')).toBeInTheDocument();
    expect(card('Free cell 3, empty')).toBeInTheDocument();
  });

  it('changes nothing on a drop that is not legal, and selects nothing either', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // A six onto a king: nothing stacks on a king at all (§3).
    const six = card('6 of spades');
    drag(six, overColumn(6));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(4)).getByRole('button', { name: '6 of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.fc-selected')).toHaveLength(0);
    expect(table().querySelectorAll('.fc-dragging')).toHaveLength(0);
    expect(table().querySelectorAll('.fc-drop-target')).toHaveLength(0);
    expect(six.style.transform).toBe('');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('lights nothing for a run too long for the free cells, and the drop returns it', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user, capacityBoard);

    // The two-card run is a legal move onto column 2 by rank and colour
    // alone — only the capacity rule stops it, and it stops it silently
    // (§3): nothing lights, and the drop is spent for nothing.
    const nine = card('9 of spades');
    fireEvent.pointerDown(nine, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(nine, { pointerId: 1, buttons: 1, ...overColumn(1) });
    expect(table().querySelectorAll('.fc-destination')).toHaveLength(0);
    expect(table().querySelectorAll('.fc-drop-target')).toHaveLength(0);
    fireEvent.pointerUp(nine, { pointerId: 1, button: 0, ...overColumn(1) });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
  });

  it('refuses a run bound for a foundation (§3)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Two cards cannot go to a foundation together, whatever the head is.
    drag(card('9 of spades'), overFoundation(0));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(3)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
  });

  it('changes nothing when let go off the table', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(card('A of spades'), { clientX: 22, clientY: -200 });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: 'A of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.fc-selected')).toHaveLength(0);
  });

  it('does not let the click a drag leaves behind count as a tap', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    const six = card('6 of spades');
    drag(six, overColumn(6));
    fireEvent.click(six, { detail: 1 });

    expect(table().querySelectorAll('.fc-selected')).toHaveLength(0);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();

    // The mark is spent on that one click: the same card, tapped for real
    // afterwards, is selected like any other.
    fireEvent.click(six, { detail: 1 });
    expect(six).toHaveClass('fc-selected');
  });

  it('never swallows a keyboard activation, drag or no drag', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Enter on a button raises a click with no pointer behind it (detail 0).
    // It is not the click the drag left, whatever card it lands on.
    const six = card('6 of spades');
    drag(six, overColumn(6));
    fireEvent.click(six, { detail: 0 });

    expect(six).toHaveClass('fc-selected');
  });

  it('leaves the board untouched when the browser cancels the pointer, and the tap path still works', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    const five = card('5 of hearts');
    fireEvent.pointerDown(five, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(five, { pointerId: 1, buttons: 1, ...overColumn(3) });
    expect(five).toHaveClass('fc-dragging');
    fireEvent.pointerCancel(five, { pointerId: 1 });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(5)).getByRole('button', { name: '5 of hearts' })).toBeInTheDocument();
    expect(table().querySelectorAll('.fc-dragging')).toHaveLength(0);
    expect(table().querySelectorAll('.fc-drop-target')).toHaveLength(0);
    expect(five.style.transform).toBe('');

    await user.click(five);
    await user.click(card('6 of spades'));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('lights the places the carried card could go, and the one it is over — one foundation ring among four lit', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    const ace = card('A of spades');
    fireEvent.pointerDown(ace, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(ace, { pointerId: 1, buttons: 1, ...overFoundation(1) });

    // Any empty foundation fits an ace by rank alone, and the table lights
    // all four the same way a tap selection would — that half of the
    // highlight is not this issue's business. Only the ring is precise:
    // it never appears over the wrong suit.
    expect(table().querySelectorAll('[data-foundation].fc-destination')).toHaveLength(4);
    expect(table().querySelectorAll('.fc-drop-target')).toHaveLength(0);

    fireEvent.pointerMove(ace, { pointerId: 1, buttons: 1, ...overFoundation(0) });
    expect(table().querySelectorAll('[data-foundation].fc-destination')).toHaveLength(4);
    const rings = table().querySelectorAll('[data-foundation].fc-drop-target');
    expect(rings).toHaveLength(1);
    expect((rings[0] as HTMLElement).dataset.foundation).toBe('0');

    fireEvent.pointerUp(ace, { pointerId: 1, button: 0, ...overFoundation(0) });
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('puts down whatever a tap had selected when a card is picked up', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    await user.click(card('A of spades'));
    expect(card('A of spades')).toHaveClass('fc-selected');

    drag(card('9 of spades'), overColumn(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: 'A of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.fc-selected')).toHaveLength(0);
  });

  it('is still a tap below the travel threshold', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    const ace = card('A of spades');
    fireEvent.pointerDown(ace, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(ace, {
      pointerId: 1,
      buttons: 1,
      clientX: PRESS.clientX + 4,
      clientY: PRESS.clientY + 4,
    });
    expect(table().querySelectorAll('.fc-dragging')).toHaveLength(0);
    fireEvent.pointerUp(ace, { pointerId: 1, button: 0, clientX: PRESS.clientX + 4, clientY: 164 });
    fireEvent.click(ace, { detail: 1 });

    expect(ace).toHaveClass('fc-selected');
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('finishes a second tap that rolled a little as the tap it was', async () => {
    // Select the run by tap, then place it with a finger that travels 12px
    // on the way down — past this table's threshold, inside the platform's
    // own, so the click still comes. The move the player was making happens.
    const user = userEvent.setup();
    await resumeDragGame(user);
    await user.click(card('9 of spades'));
    expect(card('9 of spades')).toHaveClass('fc-selected');

    const ten = card('10 of hearts');
    const roll = { clientX: 72, clientY: 172 };
    fireEvent.pointerDown(ten, { pointerId: 1, button: 0, buttons: 1, clientX: 72, clientY: 160 });
    fireEvent.pointerMove(ten, { pointerId: 1, buttons: 1, ...roll });
    fireEvent.pointerUp(ten, { pointerId: 1, button: 0, ...roll });
    fireEvent.click(ten, { detail: 1 });

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '8 of hearts' })).toBeInTheDocument();
  });

  it('takes a dragged move back with Undo, like any other (§8)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(card('5 of hearts'), overColumn(3));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(5)).getByRole('button', { name: '5 of hearts' })).toBeInTheDocument();
    expect(within(column(4)).getByRole('button', { name: '6 of spades' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('moves the same card by two taps after a drag, and by a drag after two taps', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // A drag first.
    drag(card('5 of hearts'), overColumn(3));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    // Then a two-tap move elsewhere: the held cell card to its own
    // foundation (the second-tap-on-the-same-card shortcut, §3).
    await user.click(card('Free cell 4, A of hearts'));
    await user.click(card('Free cell 4, A of hearts'));
    expect(screen.getByText(/Moves\s*2/)).toBeInTheDocument();

    // Then a drag again, on a different card entirely.
    drag(card('A of spades'), overFoundation(0));
    expect(screen.getByText(/Moves\s*3/)).toBeInTheDocument();
  });
});
