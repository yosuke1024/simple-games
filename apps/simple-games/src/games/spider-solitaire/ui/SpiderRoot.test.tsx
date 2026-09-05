import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession } from '../game';
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
