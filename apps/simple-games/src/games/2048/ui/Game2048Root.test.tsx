import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createSession, type Board } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { TM_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { Game2048Root } from './Game2048Root';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so every save lands here,
 * and the blocks that have to read back what a save actually wrote go through
 * `storedPlaySeconds` / `storedRunSeconds` below.
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
      <Game2048Root onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

/** Launches the app against the device store, the way a player's phone does. */
function launch(onExit: () => void = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Game2048Root onExit={onExit} />
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
  const raw = deviceStore.get(TM_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

/** The saved run's own clock, which is what all later booking is measured from. */
function storedRunSeconds(): number | null {
  const raw = deviceStore.get(TM_STORAGE_KEYS.game);
  if (raw === undefined) return null;
  return (JSON.parse(raw) as PersistedGame).elapsedSeconds;
}

const tutorialDone = {
  [TM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = (...rows: readonly number[][]): Board => ([] as number[]).concat(...rows);
const ZERO = [0, 0, 0, 0];

/** A pinned board, so the test knows what each direction is worth. */
const PAIR_ON_TOP = board([2, 2, 0, 0], ZERO, ZERO, ZERO);

const savedGame = {
  ...tutorialDone,
  [TM_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted({ ...createSession('2048-uitest'), board: PAIR_ON_TOP }, 1),
  ),
};

const gameBoard = () => screen.getByRole('group', { name: /2048 board/ });
const tiles = () => gameBoard().querySelectorAll('.tm-tile');

/** Every live tile's row, column and value — a board's shape, not just its
 * count. Ghosts (a merge's consumed pair, still sliding out underneath) are
 * left out: nothing a keydown does while blocked could ever create one. */
function tileLayout(): string[] {
  return Array.from(tiles())
    .filter((tile) => !tile.classList.contains('tm-tile-ghost'))
    .map((tile) => {
      const style = tile.getAttribute('style') ?? '';
      const row = /--tm-row:\s*(\d+)/.exec(style)?.[1] ?? '?';
      const col = /--tm-col:\s*(\d+)/.exec(style)?.[1] ?? '?';
      return `${row},${col}=${tile.textContent}`;
    })
    .sort();
}

/** The score off the topbar specifically — the result overlay says "Score"
 * on its own card too, so a plain text query would find both once it is up. */
const topScore = () => document.querySelector('.tm-score')?.textContent ?? '';

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and deals a board right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Swipe to slide')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A new tile appears')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Stuck? Take it back')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Sixteen squares, every one of them announced, and two tiles on them (§5).
    expect(within(gameBoard()).getAllByRole('img')).toHaveLength(16);
    expect(tiles()).toHaveLength(2);
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('offers Undo from the first frame, with nothing yet to undo (§6, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeInTheDocument();
    expect(undo).toBeDisabled();
    // Help is one button, and it is not unlocked by watching anything (§8).
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('slides on an arrow key, and takes the move back (§3, §6)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Score\s*4/)).toBeInTheDocument();
    // The 4 the move made and the tile that followed it, with the pair the
    // merge consumed still travelling in underneath them (§12).
    expect(gameBoard().querySelectorAll('.tm-tile-merge')).toHaveLength(1);
    expect(gameBoard().querySelectorAll('.tm-tile-spawn')).toHaveLength(1);
    expect(gameBoard().querySelectorAll('.tm-tile-ghost')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('does nothing at all for a direction the board cannot take (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    // Two tiles already against the top edge: up changes nothing, so nothing
    // is scored, no tile appears, and there is still nothing to undo.
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(tiles()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('shows no clock while playing (§12)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same swipe/undo handlers (issue #93):
   every assertion here checks board state the taps also produce. */
describe('keyboard (issue #93)', () => {
  it('an arrow keydown slides the board the same as the swipe path', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Score\s*4/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('a held arrow key does not replay the slide', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    fireEvent.keyDown(window, { key: 'ArrowLeft', repeat: true });
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(tiles()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('Ctrl+Z undoes the same as the Undo button', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Score\s*4/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  /* 2048 does not detach its key listener behind a dialog (unlike the
     `enabled` gate useGameKeys.ts describes for a modal) — GameScreen.tsx
     keeps it attached and swallows every arrow and Ctrl+Z through `blocked`
     instead, so a held or mistimed key can never scroll the page or slip a
     move in behind the confirm. This pins that the swallowing changes
     nothing: the board underneath is exactly as it was saved. */
  it('goes quiet while the New Game dialog is up', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    const layout = tileLayout();
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Start a new game?' });

    // Pointer input is covered by `inert` on `.game-content`; the keydown
    // listener lives on `window` and has to be told separately (GameScreen.tsx).
    expect(gameBoard().closest('[inert]')).not.toBeNull();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    // Neither reached the board behind the dialog: the pair sits exactly
    // where it was saved, and the dialog is still the thing on screen.
    expect(tileLayout()).toEqual(layout);
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    // Cancel, and the same key the dialog just ate does exactly what the
    // ungated slide test above expects (§3, §6) — the listener never left.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(gameBoard().closest('[inert]')).toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Score\s*4/)).toBeInTheDocument();
    expect(gameBoard().querySelectorAll('.tm-tile-merge')).toHaveLength(1);
    expect(gameBoard().querySelectorAll('.tm-tile-spawn')).toHaveLength(1);
    expect(gameBoard().querySelectorAll('.tm-tile-ghost')).toHaveLength(2);
  });

  // A board one merge away from a stalemate (§2, §4): every cell filled, and
  // the top-left pair is the only pair a left slide can join (ArrowLeft only
  // ever resolves row-wise merges; the board's other equal neighbours all sit
  // vertically, so they don't move under this key). Sliding the pair together
  // spends the board's one move and leaves nothing to join — the ending is
  // not staged, it is what this exact board does under ArrowLeft, with the
  // same seed the rest of this file plays from.
  //
  // A board that is *already* lost can never reach the screen as a resumed
  // save — restoreSession (game/session.ts) recomputes `status` from the
  // board on every load, and gamePersistence.ts's `toSession` discards
  // anything that is not `'playing'` (§8: "the next game is free and starts
  // fresh"), so loadSavedGame hands back null rather than an over session.
  // Reaching "the run is over" here the same way a player does — by playing
  // the move that ends it — is therefore the only way this test can put a
  // finished board on screen at all.
  const ONE_MOVE_FROM_OVER = board([4, 4, 2, 4], [2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4]);

  it('goes quiet once the run is over', async () => {
    const user = userEvent.setup();
    const overSoon = {
      ...tutorialDone,
      [TM_STORAGE_KEYS.game]: JSON.stringify(
        toPersisted({ ...createSession('2048-uitest'), board: ONE_MOVE_FROM_OVER }, 1),
      ),
    };
    renderGame(overSoon);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await screen.findByRole('alertdialog', { name: 'No moves left' });
    expect(gameBoard().closest('[inert]')).not.toBeNull();

    const layout = tileLayout();
    const score = topScore();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    // The finished board does not answer to a key any more than the dialog
    // above did — this is the same `blocked` gate, not a second
    // implementation of it.
    expect(tileLayout()).toEqual(layout);
    expect(topScore()).toBe(score);
    expect(screen.getByRole('alertdialog', { name: 'No moves left' })).toBeInTheDocument();
  });
});

/**
 * The "reached 2048" milestone overlay is not a ConfirmDialog, so it falls
 * outside modalIsolationWiring.test.ts's static gate (issue #120) — it is
 * `announceReached` from GameContext, folded into the same `blocked` expression
 * as the New Game dialog and the game-over overlay (GameScreen.tsx). This pins
 * the same contract for it by hand: the board behind it is inert, the keyboard
 * cannot move it or undo through it, and both come back once it is dismissed.
 */
describe('the reached-2048 overlay (issue #120)', () => {
  // Two 1024s side by side merge into the board's first 2048 on a single
  // ArrowLeft — `session.ts`'s `justReached` is true exactly on that move —
  // while everywhere else stays empty, so the run does not also end: the
  // milestone and game-over overlays are mutually exclusive
  // (MergeResultOverlay.tsx picks the ending over the milestone when both
  // would apply on the same move), and this board has to stay `'playing'`
  // afterwards to exercise the milestone on its own.
  const TWO_1024S = board([1024, 1024, 0, 0], ZERO, ZERO, ZERO);

  it('inerts the board and swallows the keyboard while it is up, and releases both once dismissed', async () => {
    const user = userEvent.setup();
    const merging = {
      ...tutorialDone,
      [TM_STORAGE_KEYS.game]: JSON.stringify(
        toPersisted({ ...createSession('2048-uitest'), board: TWO_1024S }, 1),
      ),
    };
    renderGame(merging);
    await user.click(await screen.findByRole('button', { name: /Resume/ }));

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    const dialog = await screen.findByRole('alertdialog', { name: 'You reached 2048!' });

    // Same contract as the New Game and game-over dialogs above: the board
    // behind the overlay is inert, and the keydown listener lives on `window`
    // and has to be told separately through `blocked` (GameScreen.tsx).
    expect(gameBoard().closest('[inert]')).not.toBeNull();

    const layout = tileLayout();
    const score = topScore();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    // None of the three reached the board behind the milestone overlay: the
    // 2048 tile and its neighbour sit exactly where the merge left them, the
    // score has not moved, and the overlay is still up.
    expect(tileLayout()).toEqual(layout);
    expect(topScore()).toBe(score);
    expect(dialog).toBeInTheDocument();

    // Dismiss, and the board answers the keyboard again. A further slide
    // moves the tile the merge spawned and drops another one behind it, so a
    // fresh (non-ghost) tile count says "this move actually happened"
    // without pinning the seed's exact spawn cell. `tiles()` alone would still
    // be counting the merge's own consumed pair here — MOVE_MS (110ms,
    // MergeBoard.tsx) has not necessarily elapsed on the real clock this runs
    // on — so `tileLayout()`'s ghost filter is what makes the count settled.
    await user.click(screen.getByRole('button', { name: 'Keep Going' }));
    expect(gameBoard().closest('[inert]')).toBeNull();
    expect(tileLayout()).toHaveLength(2);

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(tileLayout()).toHaveLength(3);
  });
});

describe('home', () => {
  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /New Game/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports counts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Games played')).toBeInTheDocument();
    expect(screen.getByText('Best score')).toBeInTheDocument();
    expect(screen.getByText('Largest tile')).toBeInTheDocument();
    expect(screen.getByText('Times you reached 2048')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
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
    deviceStore.set(TM_STORAGE_KEYS.flags, tutorialDone[TM_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /New Game/ }));

      act(() => vi.advanceTimersByTime(9_000));
      background();
      await settle();
      expect(storedRunSeconds()).toBe(9);

      // The process dies here. Relaunch and stop on the game's own home.
      cleanup();
      launch();
      await settle();
      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

      // Away again without ever resuming: the nine seconds are still there.
      background();
      await settle();
      expect(storedRunSeconds()).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what 2048 does about it (issue #113).
 * The shell says only which door was used; every decision below is this
 * game's, taken from its own save.
 *
 * There is no "two suspended games" case to disambiguate here: 2048 keeps one
 * slot (§10), and `loadSavedGame` hands back null for anything that is not a
 * board still worth coming back to. Either there is one game to resume, or
 * there is none.
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut(onExit: () => void = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <Game2048Root onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(TM_STORAGE_KEYS.flags, tutorialDone[TM_STORAGE_KEYS.flags]!);
  }

  /** Leaves one suspended board on the device the way a player does: by
   * starting a game and walking away from it (§10). */
  async function suspendOneGame() {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();
  }

  const boardShown = () => screen.queryByRole('group', { name: /2048 board/ });
  /** The one control only this game's home carries. */
  const homeShown = () => screen.queryByRole('button', { name: 'All games' });

  it('opens the one suspended game straight onto its board', async () => {
    await suspendOneGame();

    launchFromShortcut();
    await settle();

    expect(boardShown()).toBeInTheDocument();
    expect(homeShown()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    await suspendOneGame();

    const onExit = vi.fn();
    launchFromShortcut(onExit);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(homeShown()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(homeShown()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    await suspendOneGame();

    launch();
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    await suspendOneGame();
    // A save and the flags are separate records, so "board kept, rules not yet
    // taught" is reachable: a flags record that fails to validate is read past
    // and falls back to its default while `tm.saveGame` still loads (§10).
    // What this pins is that a shortcut cannot become a way past §11.
    deviceStore.delete(TM_STORAGE_KEYS.flags);

    launchFromShortcut();
    await settle();

    expect(screen.getByText('Swipe to slide')).toBeInTheDocument();
    expect(boardShown()).not.toBeInTheDocument();
  });

  // The counterpart of `activate`: opening onto the board at mount seeds the
  // same two clocks Resume does, so the seconds already played are neither
  // lost from the run nor counted into the statistics again.
  it('does not book the resumed game’s play seconds a second time', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedRunSeconds()).toBe(5);
      expect(storedPlaySeconds()).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      expect(boardShown()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();

      // The run carries on from the clock it was saved with...
      expect(storedRunSeconds()).toBe(8);
      // ...and only the three seconds since are added to the total.
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
