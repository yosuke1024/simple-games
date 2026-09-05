import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession, isValidBoard, type SpiderBoard } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { SS_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { SpiderRoot } from './SpiderRoot';

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
      <SpiderRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(SS_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

const tutorialDone = {
  [SS_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/**
 * The golden deal at one suit (compatibility.test.ts). Its ten face-up cards
 * are 4 A 10 7 4 9 6 7 2 Q of spades, so the 9 onto the 10 is a legal move and
 * both of those ranks appear exactly once.
 */
const savedGoldenGame = {
  ...tutorialDone,
  [SS_STORAGE_KEYS.game]: JSON.stringify(toPersisted(createFreeSession(1, 'ss-free-golden'), 1)),
};

/**
 * A crafted one-suit save whose only sound move is the ace of column 1 onto
 * the 2 of column 2 (a card is `copy * 13 + rank - 1`, types.ts). Kings and
 * jacks land nowhere and take nothing, three completed runs and the stock
 * absorb the rest of the 104, and — the point of the fixture — both columns
 * of the move hold cards the move does not touch: the 5 and 9 above the ace,
 * the 8 under the 2.
 */
const hintTableau = [
  { down: [], up: [4, 8, 0] }, // 5♠ 9♠ A♠ — only the ace moves
  { down: [], up: [7, 1] }, // 8♠ 2♠ — the ace lands on the 2
  { down: [], up: [55, 12] }, // 4♠ under a king
  { down: [], up: [57, 64] }, // 6♠ under a king
  { down: [], up: [77] },
  { down: [], up: [90] },
  { down: [], up: [103] },
  { down: [], up: [62] },
  { down: [], up: [75] },
  { down: [], up: [88] },
];
const hintCompleted = [1, 2, 3].map((copy) =>
  Array.from({ length: 13 }, (_, i) => copy * 13 + 12 - i),
);
const hintDealt = new Set([...hintTableau.flatMap((pile) => pile.up), ...hintCompleted.flat()]);
const savedHintGame = {
  ...tutorialDone,
  [SS_STORAGE_KEYS.game]: JSON.stringify({
    schemaVersion: 1,
    mode: 'free',
    seed: 'ss-free-hint-marks',
    suitCount: 1,
    dailyDate: null,
    stock: Array.from({ length: 104 }, (_, card) => card).filter((card) => !hintDealt.has(card)),
    tableau: hintTableau,
    completed: hintCompleted,
    moveCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
    savedAt: 1,
  }),
};

/**
 * A crafted one-suit save with one of every drag the issue names (issue
 * #119), each with a legal destination and an illegal one within reach.
 * A card is `copy * 13 + rank - 1` (types.ts); suit does not matter here
 * (suitCount 1), only rank and identity.
 *
 * - column 1: 9♠ 8♠ over a hidden king — the multi-card run that moves onto
 *   column 2's 10♠, freeing the flip
 * - column 2: 10♠ alone — receives the run from column 1
 * - column 3: 5♠ over a hidden card — the single card that moves onto
 *   column 4's 6♠
 * - column 4: 6♠ alone — receives column 3's 5♠
 * - column 5: empty — any card may land here
 * - column 6: J♠ alone — a spare single card, dragged to the empty column 5
 * - column 7: J♠ over 7♠, not a run (11 is not one more than 7) — lifting
 *   from its own bottom carries a mixed stack that lights nothing
 * - column 8: A♠ alone — completes column 9's run when dragged there
 * - column 9: K♠ down to 2♠, twelve cards, one card short of a finished run —
 *   receiving column 8's ace takes the whole thirteen off the table
 * - column 10: Q♠ over a very deep hidden stock (every card not spoken for
 *   above), so the fixture accounts for all 104 cards with none in the stock
 */
const dragTableau = [
  { down: [25], up: [8, 7] }, // K♠(hidden) / 9♠ 8♠
  { down: [], up: [9] }, // 10♠
  { down: [73], up: [4] }, // (hidden) / 5♠
  { down: [], up: [5] }, // 6♠
  { down: [], up: [] }, // empty
  { down: [], up: [10] }, // J♠
  { down: [], up: [23, 19] }, // J♠ / 7♠ — not a run
  { down: [], up: [26] }, // A♠
  { down: [], up: [51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40] }, // K♠..2♠
  {
    down: [
      0, 1, 2, 3, 6, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 27, 28, 29, 30, 31, 32, 33, 34,
      35, 36, 37, 38, 39, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70,
      71, 72, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
      95, 96, 97, 98, 99, 100, 101, 102, 103,
    ],
    up: [63],
  }, // (very deep hidden) / Q♠
];
function savedDragGame() {
  return {
    ...tutorialDone,
    [SS_STORAGE_KEYS.game]: JSON.stringify({
      schemaVersion: 1,
      mode: 'free',
      seed: 'ss-free-drag',
      suitCount: 1,
      dailyDate: null,
      stock: [],
      tableau: dragTableau,
      completed: [],
      moveCount: 0,
      hintCount: 0,
      elapsedSeconds: 0,
      savedAt: 1,
    }),
  };
}

const table = () => screen.getByRole('group', { name: 'Spider Solitaire table' });

async function resumeSavedGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Resume/ }));
}

function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SpiderRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

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
  const raw = deviceStore.get(SS_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

/**
 * The free deal's own clock as it survives on disk. Worth reading separately
 * from the statistics: a save writes the live clock *over* the session's
 * elapsed seconds, so a clock that started from the wrong place destroys the
 * deal's own record even where the lifetime total happens to come out right.
 */
function storedFreeElapsed(): number {
  const raw = deviceStore.get(SS_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as PersistedGame).elapsedSeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(SS_STORAGE_KEYS.flags, tutorialDone[SS_STORAGE_KEYS.flags]!);
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
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what Spider does about it (issue #113).
 * The shell says only which door was used; every decision below is this
 * game's, taken from its own two save slots (§10).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut() {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SpiderRoot onExit={vi.fn()} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(SS_STORAGE_KEYS.flags, tutorialDone[SS_STORAGE_KEYS.flags]!);
  }

  const board = () => screen.queryByRole('group', { name: 'Spider Solitaire table' });
  const home = () => screen.queryByRole('button', { name: /New deal/ });

  /**
   * Deals a free game, plays one row off the stock, then leaves it on the
   * table and goes home.
   *
   * The move is the point. An untouched deal is indistinguishable from the one
   * a launch would hand out by itself — same ten columns, same five deals in
   * hand, same zero moves — so a test that suspends without playing cannot
   * tell a resumed board from a fresh one, and would keep passing if the
   * shortcut silently started a new deal (spending a play, §9).
   */
  async function suspendFreeDeal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /New deal/ }));
    await user.click(
      await within(table()).findByRole('button', {
        name: 'Stock, 5 deals left — tap to deal a row',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  /** The same for today's daily — the other slot, kept independently (§10). */
  async function suspendDailyDeal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await user.click(
      await within(table()).findByRole('button', {
        name: 'Stock, 5 deals left — tap to deal a row',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  it('opens the one suspended deal straight onto its table', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendFreeDeal(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // The deal that was waiting, and not a new one: a row already off the
    // stock and the move that took it. A launch that dealt its own game would
    // show five deals in hand and no moves.
    expect(board()).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 4 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  it('opens the daily when that is the one that was suspended', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendDailyDeal(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // The table reads whichever slot was resumed, so arriving at the daily has
    // to move the active mode with it — the free slot is empty and would draw
    // nothing at all. And it is the suspended daily, not a second one dealt on
    // arrival: today's date would have dealt again just as readily.
    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 4 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('leaves the table for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await suspendFreeDeal(user);
    cleanup();

    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SpiderRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
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
    await settle();
    await suspendFreeDeal(user);
    await suspendDailyDeal(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — nothing was chosen for
    // the player, and nothing was thrown away either.
    expect(board()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spider Solitaire\s*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge\s*Resume/ })).toBeInTheDocument();
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
    await suspendFreeDeal(user);
    cleanup();

    // The word itself, because it is the one the shell sends on every ordinary
    // path — the collection tile, the web `?game=` view, Back into a game, the
    // error-boundary retry (app/App.tsx). A gate written as `!== 'collection'`
    // or as a truthiness check would pass every test that only omits the prop.
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SpiderRoot onExit={vi.fn()} entry="collection" />
      </SettingsProvider>,
    );
    await settle();

    expect(board()).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Spider Solitaire\s*Resume/ }),
    ).toBeInTheDocument();

    // And a launch that names no door at all, which is what the tests above
    // and the game's own screens do.
    cleanup();
    launch();
    await settle();

    expect(board()).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Spider Solitaire\s*Resume/ }),
    ).toBeInTheDocument();
  });

  it('teaches the game first, even with a deal waiting', async () => {
    const user = userEvent.setup();
    launch();
    await settle();
    // Quick Rules, and the free deal it hands out at the end (§11).
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();

    // The one arrangement where the rule can be seen at all: a suspended deal
    // on disk and Quick Rules still not behind the player. A shortcut is not
    // an exception to the order — it is a way back in, not a way past.
    deviceStore.delete(SS_STORAGE_KEYS.flags);
    launchFromShortcut();

    expect(await screen.findByText('Stack down by rank')).toBeInTheDocument();
    expect(board()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding test above: resuming at mount seeds
  // the same two clocks `activate` does, so the seconds already played are
  // neither lost nor counted again. Both numbers have to be checked — one
  // catches a clock that restarted, the other a booking that started over.
  it('keeps the resumed deal’s play seconds, and books them only once', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /New deal/ }));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedFreeElapsed()).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(board()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // The deal has been played for eight seconds and the lifetime total says
      // eight: the five it arrived with were carried, not re-run and not
      // re-counted.
      expect(storedFreeElapsed()).toBe(8);
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and deals a free game right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Stack down by rank')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('One suit travels together')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Deal when you are stuck')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // A fresh Spider layout (§1): 54 cards over ten columns, one face up per
    // column, and five deals still in hand.
    expect(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(44);
    expect(table().querySelectorAll('[data-card]')).toHaveLength(10);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('moves a run with two taps and turns over what it uncovers (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeSavedGame(user);

    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(44);

    await user.click(within(table()).getByRole('button', { name: '9 of spades' }));
    await user.click(within(table()).getByRole('button', { name: '10 of spades' }));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    // The column the 9 left had four hidden cards; one has turned over.
    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(43);
    expect(table().querySelectorAll('[data-card]')).toHaveLength(11);
  });

  it('deals a row from the stock and undoes it whole (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeSavedGame(user);

    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
    await user.click(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    );

    expect(
      within(table()).getByRole('button', { name: 'Stock, 4 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(table().querySelectorAll('[data-card]')).toHaveLength(20);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    // One undo takes the whole row back — ten cards, one step.
    await user.click(screen.getByRole('button', { name: /Undo/ }));
    expect(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
    expect(table().querySelectorAll('[data-card]')).toHaveLength(10);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('never names a face-down card, and shows no clock or streak (§4, §12)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeSavedGame(user);

    for (const back of within(table()).getAllByRole('img', { name: 'Face down' })) {
      expect(back).not.toHaveAttribute('data-card');
    }
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('offers a hint, and it is free (§8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeSavedGame(user);

    await user.click(screen.getByRole('button', { name: /Hint/ }));
    // A hint changes nothing on the board and costs nothing.
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
  });

  it('outlines only the run to move and the card it lands on (§8)', async () => {
    const user = userEvent.setup();
    renderGame(savedHintGame);
    await resumeSavedGame(user);

    await user.click(screen.getByRole('button', { name: /Hint/ }));

    // The fixture's one sound move is the ace onto the 2. The outline marks
    // that move and nothing else — not the columns it happens to touch.
    expect(within(table()).getByRole('button', { name: 'A of spades' })).toHaveClass('sp-hinted');
    expect(within(table()).getByRole('button', { name: '2 of spades' })).toHaveClass('sp-hinted');
    expect(table().querySelectorAll('.sp-hinted')).toHaveLength(2);
  });
});

describe('home', () => {
  it('carries the suit setting to the next deal, not to the one in progress', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    const oneSuit = await screen.findByRole('button', { name: '1 suit' });
    expect(oneSuit).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '4 suits' }));
    expect(screen.getByRole('button', { name: '4 suits' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1 suit' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /New deal/ }));
    expect(screen.getByText('4 suits')).toBeInTheDocument();
  });

  it('reaches the daily, the statistics and the way out', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Past Dailies/i }));
    expect(screen.getByRole('heading', { name: /Daily Challenge/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: /Statistics/i }));
    // One section per difficulty (§9).
    expect(screen.getAllByText('Deals played')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalled();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes a dealt row, same as the Undo button (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeSavedGame(user);

    await user.click(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    );
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 5 deals left — tap to deal a row' }),
    ).toBeInTheDocument();
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
    deviceStore.set(SS_STORAGE_KEYS.flags, tutorialDone[SS_STORAGE_KEYS.flags]!);
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

describe('the drag fixture (issue #119)', () => {
  // A wrong fixture must fail loudly here, not silently deal a fresh game
  // that happens to make every test below pass for the wrong reason.
  it('is a board play could really reach', () => {
    const board: SpiderBoard = { suitCount: 1, stock: [], tableau: dragTableau, completed: [] };
    expect(isValidBoard(board)).toBe(true);
  });
});

describe('drag (issue #119)', () => {
  /** The pretend table, in CSS pixels: ten 45px columns on a 50px pitch. */
  const COL = 50;
  const CARD_W = 45;
  const ROW = { top: 0, height: 63 };
  const TABLEAU_TOP = 75;
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
        return rect(0, ROW.top, COL * 10 - (COL - CARD_W), ROW.height);
      if (el.dataset.pile !== undefined) {
        return rect(Number(el.dataset.pile) * COL, TABLEAU_TOP, CARD_W, 200);
      }
      return rect(0, 0, 0, 0);
    });
  }
  afterEach(() => {
    layoutSpy?.mockRestore();
    layoutSpy = null;
  });

  /** A pointer over the middle of column `pile` (0-based), well into the tableau. */
  const overColumn = (pile: number) => ({ clientX: pile * COL + CARD_W / 2, clientY: 160 });
  /** A pointer over the middle of the top row — never a target in Spider (§3). */
  const overTopRow = { clientX: 22, clientY: ROW.height / 2 };
  /** Where every press below starts: far enough from every target to travel. */
  const PRESS = { clientX: 22, clientY: 160 };

  const column = (n: number) => within(table()).getByRole('group', { name: `Column ${n}` });

  /** Presses a card and carries it to `to`, in the events a browser sends. */
  function drag(el: HTMLElement, to: { clientX: number; clientY: number }): void {
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, ...to });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, ...to });
  }

  async function resumeDragGame(user: ReturnType<typeof userEvent.setup>) {
    renderGame(savedDragGame());
    await resumeSavedGame(user);
    giveTableALayout();
  }

  it('moves a run onto another column, and turns over what it uncovers (tableau → tableau, multi-card)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // The 9♠ is the head of a two-card run; both cards travel, and the K♠
    // they were covering turns over — the move a tap makes, made by hand.
    drag(within(column(1)).getByRole('button', { name: '9 of spades' }), overColumn(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '8 of spades' })).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: 'K of spades' })).toBeInTheDocument();
    expect(within(column(1)).queryByRole('img', { name: 'Face down' })).not.toBeInTheDocument();
  });

  it('moves a single card onto another column, and turns over what it uncovers (tableau → tableau, single card)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(within(column(3)).getByRole('button', { name: '5 of spades' }), overColumn(3));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(4)).getByRole('button', { name: '5 of spades' })).toBeInTheDocument();
    expect(within(column(4)).getByRole('button', { name: '6 of spades' })).toBeInTheDocument();
    // The hidden card column 3 held underneath has turned face up.
    expect(within(column(3)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
    expect(within(column(3)).queryByRole('img', { name: 'Face down' })).not.toBeInTheDocument();
  });

  it('drops any card onto an empty column', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(within(column(6)).getByRole('button', { name: 'J of spades' }), overColumn(4));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(5)).getByRole('button', { name: 'J of spades' })).toBeInTheDocument();
    expect(
      within(column(6)).getByRole('button', { name: 'Column 6, empty — any card can move here' }),
    ).toBeInTheDocument();
  });

  it('changes nothing on a drop that is not one rank higher, and selects nothing either', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // The 5♠ onto the 10♠: not a move (10 is not one more than 5). The card
    // is back where it lay, the board is as it was, and nothing is left held
    // — a drag that failed is over, not half of a tap.
    const five = within(column(3)).getByRole('button', { name: '5 of spades' });
    drag(five, overColumn(1));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(3)).getByRole('button', { name: '5 of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.sp-selected')).toHaveLength(0);
    expect(table().querySelectorAll('.sp-dragging')).toHaveLength(0);
    expect(table().querySelectorAll('.sp-drop-target')).toHaveLength(0);
    expect(five.style.transform).toBe('');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('lights nothing for a mixed, non-run stack, and returns it wherever it is dropped', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Column 7 holds J♠ under 7♠ — not a run (11 is not one more than 7).
    // Lifting from the J♠ carries both, and nothing about that stack can
    // legally land anywhere: the table does not re-check the rule any more
    // than a tap selection would (§3).
    const jack = within(column(7)).getByRole('button', { name: 'J of spades' });
    fireEvent.pointerDown(jack, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(jack, { pointerId: 1, buttons: 1, ...overColumn(1) });
    expect(table().querySelectorAll('.sp-destination')).toHaveLength(0);
    fireEvent.pointerUp(jack, { pointerId: 1, button: 0, ...overColumn(1) });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(7)).getByRole('button', { name: 'J of spades' })).toBeInTheDocument();
    expect(within(column(7)).getByRole('button', { name: '7 of spades' })).toBeInTheDocument();
  });

  it('changes nothing on a drop over the stock or the top row', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(within(column(1)).getByRole('button', { name: '9 of spades' }), overTopRow);

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
  });

  it('does not let the click a drag leaves behind count as a tap', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // A pointer released after a drag still ends in a click on the card it
    // pressed. After a drop that moved nothing, that card is still there to
    // hear it — and hearing it as a tap would leave the card selected, with
    // the next tap anywhere legal moving it. Nothing moved, so nothing is held.
    const five = within(column(3)).getByRole('button', { name: '5 of spades' });
    drag(five, overColumn(1));
    fireEvent.click(five, { detail: 1 });

    expect(table().querySelectorAll('.sp-selected')).toHaveLength(0);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();

    // The mark is spent on that one click: the same card, tapped for real
    // afterwards, is selected like any other.
    fireEvent.click(five, { detail: 1 });
    expect(five).toHaveClass('sp-selected');
  });

  it('never swallows a keyboard activation, drag or no drag', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Enter on a button raises a click with no pointer behind it (detail 0).
    // It is not the click the drag left, whatever card it lands on.
    const five = within(column(3)).getByRole('button', { name: '5 of spades' });
    drag(five, overColumn(1));
    fireEvent.click(five, { detail: 0 });

    expect(five).toHaveClass('sp-selected');
  });

  it('leaves the board and the table sound when the browser cancels the pointer', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Mid-drag, over a legal spot, the browser takes the gesture — a scroll it
    // decided was its own. Nothing is played, the run goes back, and the next
    // two taps work as they always did.
    const nine = within(column(1)).getByRole('button', { name: '9 of spades' });
    fireEvent.pointerDown(nine, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(nine, { pointerId: 1, buttons: 1, ...overColumn(1) });
    expect(nine).toHaveClass('sp-dragging');
    fireEvent.pointerCancel(nine, { pointerId: 1 });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.sp-dragging')).toHaveLength(0);
    expect(table().querySelectorAll('.sp-drop-target')).toHaveLength(0);
    expect(nine.style.transform).toBe('');

    await user.click(nine);
    await user.click(within(column(2)).getByRole('button', { name: '10 of spades' }));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('lights the columns the carried run could go to, and the one it is over', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    const nine = within(column(1)).getByRole('button', { name: '9 of spades' });
    fireEvent.pointerDown(nine, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(nine, { pointerId: 1, buttons: 1, ...overColumn(1) });

    // The same destination a tap-selection lights (§3) — the 10♠ is the one
    // place this run can go — and the spot under the finger is marked as
    // where letting go will put it. Both cards of the run are in hand.
    const ten = within(column(2)).getByRole('button', { name: '10 of spades' });
    expect(ten).toHaveClass('sp-destination');
    expect(ten).toHaveClass('sp-drop-target');
    expect(table().querySelectorAll('.sp-drop-target')).toHaveLength(1);
    expect(nine).toHaveClass('sp-dragging');
    expect(within(column(1)).getByRole('button', { name: '8 of spades' })).toHaveClass(
      'sp-dragging',
    );
    expect(table().querySelectorAll('.sp-dragging')).toHaveLength(2);

    // Over a column it cannot land on, nothing is marked: the felt says
    // nothing about a drop that will do nothing (§3).
    fireEvent.pointerMove(nine, { pointerId: 1, buttons: 1, ...overColumn(3) });
    expect(table().querySelectorAll('.sp-drop-target')).toHaveLength(0);
    expect(ten).toHaveClass('sp-destination');

    fireEvent.pointerUp(nine, { pointerId: 1, button: 0, ...overColumn(3) });
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('puts down whatever a tap had selected when a run is picked up', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Select the J♠ by tap, then drag the run instead: the run moves, the
    // jack does not, and nothing is left selected.
    await user.click(within(column(6)).getByRole('button', { name: 'J of spades' }));
    expect(within(column(6)).getByRole('button', { name: 'J of spades' })).toHaveClass(
      'sp-selected',
    );

    drag(within(column(1)).getByRole('button', { name: '9 of spades' }), overColumn(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(6)).getByRole('button', { name: 'J of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.sp-selected')).toHaveLength(0);
  });

  it('is still a tap below the travel threshold', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // A finger that rolls a few pixels while tapping has not picked anything
    // up: the press ends in the click the tap path has always answered.
    const jack = within(column(6)).getByRole('button', { name: 'J of spades' });
    fireEvent.pointerDown(jack, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(jack, {
      pointerId: 1,
      buttons: 1,
      clientX: PRESS.clientX + 4,
      clientY: PRESS.clientY + 4,
    });
    expect(table().querySelectorAll('.sp-dragging')).toHaveLength(0);
    fireEvent.pointerUp(jack, {
      pointerId: 1,
      button: 0,
      clientX: PRESS.clientX + 4,
      clientY: 164,
    });
    fireEvent.click(jack, { detail: 1 });

    expect(jack).toHaveClass('sp-selected');
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('finishes a second tap that rolled a little as the tap it was', async () => {
    // Select the run by tap, then place it with a finger that travels 12px on
    // the way down — past this table's threshold, inside the platform's own,
    // so the click still comes. The move the player was making happens; the
    // selection is not quietly dropped for a drag nobody meant to start.
    const user = userEvent.setup();
    await resumeDragGame(user);
    await user.click(within(column(1)).getByRole('button', { name: '9 of spades' }));
    expect(within(column(1)).getByRole('button', { name: '9 of spades' })).toHaveClass(
      'sp-selected',
    );

    const ten = within(column(2)).getByRole('button', { name: '10 of spades' });
    const roll = { clientX: 72, clientY: 172 };
    fireEvent.pointerDown(ten, { pointerId: 1, button: 0, buttons: 1, clientX: 72, clientY: 160 });
    fireEvent.pointerMove(ten, { pointerId: 1, buttons: 1, ...roll });
    fireEvent.pointerUp(ten, { pointerId: 1, button: 0, ...roll });
    fireEvent.click(ten, { detail: 1 });

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '8 of spades' })).toBeInTheDocument();
  });

  it('takes a dragged move back with Undo, like any other (§8)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(within(column(1)).getByRole('button', { name: '9 of spades' }), overColumn(1));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: '9 of spades' })).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: '8 of spades' })).toBeInTheDocument();
    // The K♠ the move had turned over is hidden again.
    expect(within(column(1)).getByRole('img', { name: 'Face down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('takes a completed run off the table when a drag finishes it', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Column 9 holds K♠ down to 2♠, one card short of a finished run; column
    // 8's lone A♠ is the missing card. The drag that lands it there finishes
    // and removes the whole thirteen, the same as a tap would (§2, §4).
    expect(screen.getAllByRole('img', { name: 'Run not finished yet' })).toHaveLength(8);

    drag(within(column(8)).getByRole('button', { name: 'A of spades' }), overColumn(8));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Completed run, spades' })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: 'Run not finished yet' })).toHaveLength(7);
    // Both columns the move touched are empty now: the run left column 9
    // whole, and column 8 had nothing else in it.
    expect(
      within(column(8)).getByRole('button', { name: 'Column 8, empty — any card can move here' }),
    ).toBeInTheDocument();
    expect(
      within(column(9)).getByRole('button', { name: 'Column 9, empty — any card can move here' }),
    ).toBeInTheDocument();
  });

  it('moves the same run by two taps after a drag, and by a drag after two taps', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Neither path leaves anything behind that trips the other.
    drag(within(column(1)).getByRole('button', { name: '9 of spades' }), overColumn(1));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    await user.click(within(column(3)).getByRole('button', { name: '5 of spades' }));
    await user.click(within(column(4)).getByRole('button', { name: '6 of spades' }));
    expect(screen.getByText(/Moves\s*2/)).toBeInTheDocument();

    drag(within(column(6)).getByRole('button', { name: 'J of spades' }), overColumn(4));
    expect(screen.getByText(/Moves\s*3/)).toBeInTheDocument();
  });

  it('leaves nothing selected after a drag let go off the table', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // A drag that went somewhere and came back with nothing is a finished
    // act, not the first tap of one: the click it leaves picks nothing up.
    const jack = within(column(6)).getByRole('button', { name: 'J of spades' });
    drag(jack, { clientX: 22, clientY: -200 });
    fireEvent.click(jack, { detail: 1 });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(table().querySelectorAll('.sp-selected')).toHaveLength(0);
    expect(table().querySelectorAll('.sp-destination')).toHaveLength(0);
  });
});
