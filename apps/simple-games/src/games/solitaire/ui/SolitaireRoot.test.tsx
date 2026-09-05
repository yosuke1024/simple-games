import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { SO_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { SolitaireRoot } from './SolitaireRoot';

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
      <SolitaireRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(SO_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

const tutorialDone = {
  [SO_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/**
 * The golden deal (compatibility.test.ts): pile 1 shows the jack of clubs
 * alone, pile 2 shows the queen of diamonds — a legal, board-emptying move.
 */
const savedGoldenGame = {
  ...tutorialDone,
  [SO_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(createFreeSession(false, 'sol-free-golden'), 1),
  ),
};

/**
 * A crafted save whose first-priority hint (§8) is pile 1's run onto pile 2 —
 * a move that frees a hidden card. A card is `suit * 13 + rank - 1` with suits
 * in the order spades, hearts, diamonds, clubs (types.ts).
 *
 * The point of the fixture is the cards the move does NOT touch: the whole run
 * 9♥ 8♠ travels, but on the far side only the 10♠ receives it — the J♥ beneath
 * stays put. Pile 1 is the only pile holding a hidden card, so the hint has no
 * earlier candidate to prefer.
 */
const hintTableau = [
  { down: [12], up: [21, 7] }, // K♠ hidden under 9♥ 8♠ — the run that moves
  { down: [], up: [23, 9] }, // J♥ 10♠ — the 9♥ lands on the 10, not the J
  { down: [], up: [51] },
  { down: [], up: [38] },
  { down: [], up: [25] },
  { down: [], up: [50] },
  { down: [], up: [37] },
];
const hintDealt = new Set(hintTableau.flatMap((pile) => [...pile.down, ...pile.up]));
const savedHintGame = {
  ...tutorialDone,
  [SO_STORAGE_KEYS.game]: JSON.stringify({
    schemaVersion: 1,
    mode: 'free',
    seed: 'sol-free-hint-marks',
    drawThree: false,
    dailyDate: null,
    stock: Array.from({ length: 52 }, (_, card) => card).filter((card) => !hintDealt.has(card)),
    waste: [],
    foundations: [[], [], [], []],
    tableau: hintTableau,
    moveCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
    savedAt: 1,
  }),
};

/**
 * A crafted save with one of every drag the issue names (issue #116), each
 * with a legal destination and an illegal one within reach:
 *
 * - pile 1: A♠ alone — goes to the spades foundation, not onto a king
 * - pile 2: J♥ 10♠ — receives the 9♥ 8♠ run from pile 3
 * - pile 3: K♠ hidden under 9♥ 8♠ — the run that moves, and the flip it frees
 * - pile 7: Q♦ — receives a J♠ from the waste
 * - waste: whatever a test puts on top (an A♥ for its foundation, a J♠ for pile 7)
 */
const dragTableau = [
  { down: [], up: [0] }, // A♠
  { down: [], up: [23, 9] }, // J♥ 10♠
  { down: [12], up: [21, 7] }, // K♠ hidden under 9♥ 8♠
  { down: [], up: [51] }, // K♣
  { down: [], up: [38] }, // K♦
  { down: [], up: [50] }, // Q♣
  { down: [], up: [37] }, // Q♦
];
function savedDragGame(waste: number[]) {
  const dealt = new Set([...waste, ...dragTableau.flatMap((pile) => [...pile.down, ...pile.up])]);
  return {
    ...tutorialDone,
    [SO_STORAGE_KEYS.game]: JSON.stringify({
      schemaVersion: 1,
      mode: 'free',
      seed: 'sol-free-drag',
      drawThree: false,
      dailyDate: null,
      stock: Array.from({ length: 52 }, (_, card) => card).filter((card) => !dealt.has(card)),
      waste,
      foundations: [[], [], [], []],
      tableau: dragTableau,
      moveCount: 0,
      hintCount: 0,
      elapsedSeconds: 0,
      savedAt: 1,
    }),
  };
}

const table = () => screen.getByRole('group', { name: 'Solitaire table' });

async function resumeGoldenGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Resume/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SolitaireRoot onExit={vi.fn()} />
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
  const raw = deviceStore.get(SO_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

/**
 * The suspended free deal's own clock, as it survives on disk (§10). A deal
 * that is not there at all reads as -1, never as a plausible zero.
 */
function storedDealSeconds(): number {
  const raw = deviceStore.get(SO_STORAGE_KEYS.game);
  if (raw === undefined) return -1;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  // Play five minutes, background the app, let Android kill it, come back: the
  // deal returns, and so must the five minutes. The session save alone cannot
  // carry them — `activate` treats a restored session's elapsedSeconds as
  // already counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(SO_STORAGE_KEYS.flags, tutorialDone[SO_STORAGE_KEYS.flags]!);
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
 * A pinned home-screen shortcut, and what Solitaire does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * this game's, taken from its own two save slots (§10).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut(onExit: () => void = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <SolitaireRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(SO_STORAGE_KEYS.flags, tutorialDone[SO_STORAGE_KEYS.flags]!);
  }

  /** Deals a free game and walks away from it, leaving one suspended deal. */
  async function suspendFreeDeal(user: ReturnType<typeof userEvent.setup>) {
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /New deal/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
  }

  const board = () => screen.queryByRole('group', { name: 'Solitaire table' });
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  it('opens the one suspended deal straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    await suspendFreeDeal(user);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(board()).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  // The daily lives in the other slot, and the board renders whatever
  // `sessions[activeMode]` holds — so a suspended daily is the case that
  // proves the resumed mode is carried over and not just the screen.
  it('opens a suspended daily on the daily board, not an empty one', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();

    expect(board()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    await suspendFreeDeal(user);
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

  it('opens the home screen when both slots are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    await suspendFreeDeal(user);
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();

    launchFromShortcut();
    await settle();

    // Both are still there to be picked up by hand — nothing was chosen for
    // the player, and nothing was thrown away either (§10).
    expect(board()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solitaire.*Resume/ })).toBeInTheDocument();
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
    await suspendFreeDeal(user);
    cleanup();

    launch();
    await settle();

    expect(board()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solitaire.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    launchFromShortcut();

    // A first launch has no suspended deal to resume anyway; what this pins
    // is that the shortcut cannot become a way past Quick Rules (§11).
    expect(await screen.findByText('Down by one, colors alternate')).toBeInTheDocument();
    expect(board()).not.toBeInTheDocument();
  });

  it('teaches the game first even with a deal waiting to be resumed', async () => {
    const user = userEvent.setup();
    taughtAlready();
    await suspendFreeDeal(user);
    cleanup();
    // The deal survives, the record of having been taught does not — the two
    // are separate keys, and only one of them can be lost. Quick Rules come
    // first whatever the other slots say (§11).
    deviceStore.delete(SO_STORAGE_KEYS.flags);

    launchFromShortcut();

    expect(await screen.findByText('Down by one, colors alternate')).toBeInTheDocument();
    expect(board()).not.toBeInTheDocument();
  });

  /**
   * The counterpart of the backgrounding test above: resuming at mount seeds
   * the same two clocks `activate` does, so the seconds already played are
   * neither lost nor counted again. Nothing on screen would show it either
   * way — the board deliberately has no clock (§4).
   *
   * Both numbers are read, and that is the point. The statistics alone cannot
   * see the worse of the two mistakes: with NEITHER clock seeded the errors
   * cancel — `withElapsed` writes the deal's own clock back DOWN to the
   * seconds since mount, and the booking then adds exactly that many — so the
   * total comes out right while the player's five seconds are quietly gone
   * from the deal they are still sitting on.
   */
  it('does not lose or double-book the resumed deal’s play seconds', async () => {
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
      expect(storedDealSeconds()).toBe(5);

      // The process dies here; the shortcut is the next thing that runs.
      cleanup();
      launchFromShortcut();
      await settle();
      expect(board()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, on a deal that still knows it
      // has been played for eight.
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
    expect(screen.getByText('Free the hidden cards')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Aces build to kings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // A fresh Klondike layout (§1): a 24-card stock and 21 hidden cards.
    expect(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
    ).toBeInTheDocument();
    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(21);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('moves a card with two taps and flips nothing it should not (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    // J♣ (alone on pile 1) onto Q♦ (pile 2): legal, and empties pile 1.
    await user.click(within(table()).getByRole('button', { name: 'J of clubs' }));
    await user.click(within(table()).getByRole('button', { name: 'Q of diamonds' }));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Column 1, empty — a king can move here' }),
    ).toBeInTheDocument();
  });

  it('draws from the stock and undoes it, move count included (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
    );
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 23 cards — tap to draw' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('never names a face-down card in the page (§12)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    // The table finds a card again after a move by its `data-card`. Only
    // face-up cards may carry one: the fresh deal shows seven, one per pile,
    // and the twenty-one hidden cards give away nothing.
    expect(table().querySelectorAll('[data-card]')).toHaveLength(7);
    for (const back of within(table()).getAllByRole('img', { name: 'Face down' })) {
      expect(back).not.toHaveAttribute('data-card');
    }

    // Drawing turns one card over, and only then is it named.
    await user.click(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
    );
    expect(table().querySelectorAll('[data-card]')).toHaveLength(8);
  });

  it('offers a free hint and shows no clock or streak (§4, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    // The golden board has a hidden-card-freeing move, so no toast appears.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('outlines only the run to move and the card it lands on (§8)', async () => {
    const user = userEvent.setup();
    renderGame(savedHintGame);
    await resumeGoldenGame(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));

    // The whole run travels, so both its cards are marked — but on the far
    // side only the card that receives it is, never the pile it sits in.
    const card = (name: string) => within(table()).getByRole('button', { name });
    expect(card('9 of hearts')).toHaveClass('sol-hinted');
    expect(card('8 of spades')).toHaveClass('sol-hinted');
    expect(card('10 of spades')).toHaveClass('sol-hinted');
    expect(card('J of hearts')).not.toHaveClass('sol-hinted');
    expect(table().querySelectorAll('.sol-hinted')).toHaveLength(3);
  });
});

describe('home', () => {
  it('offers a new deal, the daily, and the draw toggle, and exits', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /New deal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();

    // Draw 1 is the default; the toggle flips the preference (§4).
    const drawOne = screen.getByRole('button', { name: 'Draw 1' });
    const drawThree = screen.getByRole('button', { name: 'Draw 3' });
    expect(drawOne).toHaveAttribute('aria-pressed', 'true');
    await user.click(drawThree);
    expect(drawThree).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports deals, wins, and the honest win rate on the statistics screen (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Deals played')).toBeInTheDocument();
    expect(screen.getByText('Games won')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.getByText('Daily deals won')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes a draw, same as the Undo button (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    await user.click(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
    );
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
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
    deviceStore.set(SO_STORAGE_KEYS.flags, tutorialDone[SO_STORAGE_KEYS.flags]!);
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
 * Drag-to-move (docs/SOLITAIRE_RULES.md §3, issue #116). Every drag below ends
 * in the same board a two-tap move would leave, checked the same way — a drag
 * is a way in, not a second set of rules — and the tap path is checked again
 * afterwards, because it is the one that must not have moved.
 */
describe('drag (issue #116)', () => {
  /** The pretend table, in CSS pixels: seven 45px columns on a 50px pitch. */
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
        return rect(0, ROW.top, COL * 7 - (COL - CARD_W), ROW.height);
      if (el.dataset.pile !== undefined) {
        return rect(Number(el.dataset.pile) * COL, TABLEAU_TOP, CARD_W, 200);
      }
      if (el.dataset.foundation !== undefined) {
        return rect((3 + Number(el.dataset.foundation)) * COL, ROW.top, CARD_W, ROW.height);
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
  /** A pointer over the middle of one suit's foundation. */
  const overFoundation = (suit: number) => ({
    clientX: (3 + suit) * COL + CARD_W / 2,
    clientY: ROW.height / 2,
  });
  /** Where every press below starts: far enough from every target to travel. */
  const PRESS = { clientX: 22, clientY: 160 };

  const card = (name: string) => within(table()).getByRole('button', { name });
  const column = (n: number) => within(table()).getByRole('group', { name: `Column ${n}` });

  /** Presses a card and carries it to `to`, in the events a browser sends. */
  function drag(el: HTMLElement, to: { clientX: number; clientY: number }): void {
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, ...to });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, ...to });
  }

  async function resumeDragGame(user: ReturnType<typeof userEvent.setup>, waste: number[] = []) {
    renderGame(savedDragGame(waste));
    await resumeGoldenGame(user);
    giveTableALayout();
  }

  it('moves a run onto another column (tableau → tableau, multi-card)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // The 9♥ is the head of a two-card run; both cards travel, and the K♠
    // they were covering turns over — the move a tap makes, made by hand.
    drag(card('9 of hearts'), overColumn(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '9 of hearts' })).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '8 of spades' })).toBeInTheDocument();
    expect(within(column(3)).getByRole('button', { name: 'K of spades' })).toBeInTheDocument();
    expect(within(column(3)).queryByRole('img', { name: 'Face down' })).not.toBeInTheDocument();
  });

  it('sends a card to its foundation (tableau → foundation)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(card('A of spades'), overFoundation(0));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(card('Foundation, A of spades')).toBeInTheDocument();
    expect(card('Column 1, empty — a king can move here')).toBeInTheDocument();
  });

  it('plays the waste card to its foundation (waste → foundation)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user, [10, 13]); // J♠ under A♥

    drag(card('A of hearts'), overFoundation(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(card('Foundation, A of hearts')).toBeInTheDocument();
    // The next waste card is on top now, and still where it was.
    expect(card('J of spades')).toBeInTheDocument();
    expect(column(7).contains(card('J of spades'))).toBe(false);
  });

  it('plays the waste card onto a column (waste → tableau)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user, [13, 10]); // A♥ under J♠

    drag(card('J of spades'), overColumn(6));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(7)).getByRole('button', { name: 'J of spades' })).toBeInTheDocument();
    expect(within(column(7)).getByRole('button', { name: 'Q of diamonds' })).toBeInTheDocument();
  });

  it('changes nothing on a drop that is not legal, and selects nothing either', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // An ace onto a king: not a move. The card is back where it lay, the
    // board is as it was, and nothing is left held — a drag that failed is
    // over, not half of a tap.
    const ace = card('A of spades');
    drag(ace, overColumn(3));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: 'A of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.sol-selected')).toHaveLength(0);
    expect(table().querySelectorAll('.sol-dragging')).toHaveLength(0);
    expect(table().querySelectorAll('.sol-drop-target')).toHaveLength(0);
    expect(ace.style.transform).toBe('');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('changes nothing when let go off the table', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(card('A of spades'), { clientX: 22, clientY: -200 });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: 'A of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.sol-selected')).toHaveLength(0);
  });

  it('does not let the click a drag leaves behind count as a tap', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // A pointer released after a drag still ends in a click on the card it
    // pressed. After a drop that moved nothing, that card is still there to
    // hear it — and hearing it as a tap would leave the card selected, with
    // the next tap anywhere legal moving it. Nothing moved, so nothing is held.
    const ace = card('A of spades');
    drag(ace, overColumn(3));
    fireEvent.click(ace, { detail: 1 });

    expect(table().querySelectorAll('.sol-selected')).toHaveLength(0);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();

    // The mark is spent on that one click: the same card, tapped for real
    // afterwards, is selected like any other.
    fireEvent.click(ace, { detail: 1 });
    expect(ace).toHaveClass('sol-selected');
  });

  it('never swallows a keyboard activation, drag or no drag', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Enter on a button raises a click with no pointer behind it (detail 0).
    // It is not the click the drag left, whatever card it lands on.
    const ace = card('A of spades');
    drag(ace, overColumn(3));
    fireEvent.click(ace, { detail: 0 });

    expect(ace).toHaveClass('sol-selected');
  });

  it('leaves the board and the table sound when the browser cancels the pointer', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Mid-drag, over a legal spot, the browser takes the gesture — a scroll it
    // decided was its own. Nothing is played, the run goes back, and the next
    // two taps work as they always did.
    const nine = card('9 of hearts');
    fireEvent.pointerDown(nine, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(nine, { pointerId: 1, buttons: 1, ...overColumn(1) });
    expect(nine).toHaveClass('sol-dragging');
    fireEvent.pointerCancel(nine, { pointerId: 1 });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(3)).getByRole('button', { name: '9 of hearts' })).toBeInTheDocument();
    expect(table().querySelectorAll('.sol-dragging')).toHaveLength(0);
    expect(table().querySelectorAll('.sol-drop-target')).toHaveLength(0);
    expect(nine.style.transform).toBe('');

    await user.click(nine);
    await user.click(card('10 of spades'));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('lights the places the carried card could go, and the one it is over', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    const nine = card('9 of hearts');
    fireEvent.pointerDown(nine, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(nine, { pointerId: 1, buttons: 1, ...overColumn(1) });

    // The same destinations a tap-selection lights (§3) — the 10♠ is the one
    // place this run can go — and the spot under the finger is marked as
    // where letting go will put it. Both cards of the run are in hand.
    const ten = card('10 of spades');
    expect(ten).toHaveClass('sol-destination');
    expect(ten).toHaveClass('sol-drop-target');
    expect(table().querySelectorAll('.sol-drop-target')).toHaveLength(1);
    expect(nine).toHaveClass('sol-dragging');
    expect(card('8 of spades')).toHaveClass('sol-dragging');
    expect(table().querySelectorAll('.sol-dragging')).toHaveLength(2);

    // Over a column it cannot land on, nothing is marked: the felt says
    // nothing about a drop that will do nothing (§3).
    fireEvent.pointerMove(nine, { pointerId: 1, buttons: 1, ...overColumn(3) });
    expect(table().querySelectorAll('.sol-drop-target')).toHaveLength(0);
    expect(ten).toHaveClass('sol-destination');

    fireEvent.pointerUp(nine, { pointerId: 1, button: 0, ...overColumn(3) });
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('puts down whatever a tap had selected when a card is picked up', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Select the ace by tap, then drag the run instead: the run moves, the
    // ace does not, and nothing is left selected.
    await user.click(card('A of spades'));
    expect(card('A of spades')).toHaveClass('sol-selected');

    drag(card('9 of hearts'), overColumn(1));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(1)).getByRole('button', { name: 'A of spades' })).toBeInTheDocument();
    expect(table().querySelectorAll('.sol-selected')).toHaveLength(0);
  });

  it('is still a tap below the travel threshold', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // A finger that rolls a few pixels while tapping has not picked anything
    // up: the press ends in the click the tap path has always answered.
    const ace = card('A of spades');
    fireEvent.pointerDown(ace, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(ace, {
      pointerId: 1,
      buttons: 1,
      clientX: PRESS.clientX + 4,
      clientY: PRESS.clientY + 4,
    });
    expect(table().querySelectorAll('.sol-dragging')).toHaveLength(0);
    fireEvent.pointerUp(ace, { pointerId: 1, button: 0, clientX: PRESS.clientX + 4, clientY: 164 });
    fireEvent.click(ace, { detail: 1 });

    expect(ace).toHaveClass('sol-selected');
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('takes a dragged move back with Undo, like any other (§8)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    drag(card('9 of hearts'), overColumn(1));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(3)).getByRole('button', { name: '9 of hearts' })).toBeInTheDocument();
    expect(within(column(3)).getByRole('button', { name: '8 of spades' })).toBeInTheDocument();
    // The K♠ the move had turned over is hidden again (§8).
    expect(within(column(3)).getByRole('img', { name: 'Face down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('refuses a run bound for a foundation (§3)', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user);

    // Two cards cannot go to a foundation together, whatever the head is.
    drag(card('9 of hearts'), overFoundation(1));

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(within(column(3)).getByRole('button', { name: '9 of hearts' })).toBeInTheDocument();
  });

  it('moves the same card by two taps after a drag, and by a drag after two taps', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user, [13, 10]); // A♥ under J♠

    // Neither path leaves anything behind that trips the other.
    drag(card('J of spades'), overColumn(6));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    await user.click(card('A of hearts'));
    await user.click(card('Foundation, hearts, empty'));
    expect(screen.getByText(/Moves\s*2/)).toBeInTheDocument();

    drag(card('A of spades'), overFoundation(0));
    expect(screen.getByText(/Moves\s*3/)).toBeInTheDocument();
  });

  it('finishes a second tap that rolled a little as the tap it was', async () => {
    // Select the run by tap, then place it with a finger that travels 12px on
    // the way down — past this table's threshold, inside the platform's own,
    // so the click still comes. The move the player was making happens; the
    // selection is not quietly dropped for a drag nobody meant to start.
    const user = userEvent.setup();
    await resumeDragGame(user);
    await user.click(card('9 of hearts'));
    expect(card('9 of hearts')).toHaveClass('sol-selected');

    const ten = card('10 of spades');
    const roll = { clientX: 72, clientY: 172 };
    fireEvent.pointerDown(ten, {
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: 72,
      clientY: 160,
    });
    fireEvent.pointerMove(ten, { pointerId: 1, buttons: 1, ...roll });
    fireEvent.pointerUp(ten, { pointerId: 1, button: 0, ...roll });
    fireEvent.click(ten, { detail: 1 });

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '9 of hearts' })).toBeInTheDocument();
    expect(within(column(2)).getByRole('button', { name: '8 of spades' })).toBeInTheDocument();
  });

  it('leaves nothing selected after a drag let go off the table', async () => {
    const user = userEvent.setup();
    await resumeDragGame(user, [13, 10]); // A♥ under J♠

    // A drag that went somewhere and came back with nothing is a finished
    // act, not the first tap of one: the click it leaves picks nothing up.
    const jack = card('J of spades');
    drag(jack, { clientX: 22, clientY: -200 });
    fireEvent.click(jack, { detail: 1 });

    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(table().querySelectorAll('.sol-selected')).toHaveLength(0);
    expect(table().querySelectorAll('.sol-destination')).toHaveLength(0);
  });
});
