import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { BLACK, createSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { RV_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { CPU_DELAY_MS } from '../state/GameContext';
import { ReversiRoot } from './ReversiRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so the tests that read
 * back what a save actually wrote stand behind both.
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
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ReversiRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/**
 * A launch through the ordinary door: a tile on the collection, or the web
 * address. It stands against the device store, the way a player's phone does.
 */
function launchFromCollection() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ReversiRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return onExit;
}

/** The same store, entered by the other door. */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ReversiRoot onExit={onExit} entry="shortcut" />
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

/** Total play seconds as they survive on disk (§8). */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(RV_STORAGE_KEYS.stats);
  return raw === undefined ? 0 : (JSON.parse(raw) as Stats).totalPlaySeconds;
}

/** The match's own clock as it survives on disk (§9). */
function storedElapsedSeconds(): number {
  const raw = deviceStore.get(RV_STORAGE_KEYS.game);
  return raw === undefined ? 0 : (JSON.parse(raw) as PersistedGame).elapsedSeconds;
}

const tutorialDone = {
  [RV_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const savedGame = {
  ...tutorialDone,
  [RV_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(createSession('easy', BLACK, 'reversi-uitest'), 1),
  ),
};

/** Quick Rules behind the player, the way every launch after the first finds them. */
function taughtAlready() {
  deviceStore.set(RV_STORAGE_KEYS.flags, tutorialDone[RV_STORAGE_KEYS.flags]!);
}

const board = () => screen.getByRole('group', { name: /Reversi board/ });

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and deals a board right after (§10)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Trap discs to turn them')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('No move? Play passes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Most discs wins')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Sixty-four squares, every one of them announced, and the opening's
    // four discs on them (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(64);
    expect(board().querySelectorAll('.rv-disc')).toHaveLength(4);
    expect(screen.getByText(/You\s*2/)).toBeInTheDocument();
    expect(screen.getByText(/CPU\s*2/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('offers only the legal squares, and marks them (§2, §7)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    // Black's four opening moves — and nothing else is pressable.
    const enabled = within(board())
      .getAllByRole('button')
      .filter((cell) => !(cell as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(4);
    expect(board().querySelectorAll('.rv-legal-dot')).toHaveLength(4);
    // Help is Undo and the dots; there is no move being suggested (§7).
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('turns the discs it traps, and takes the move back (§2, §6)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Row 3, column 4: your move' }));
    // One disc more on the board — the one placed. The disc it trapped was
    // already there and only changed colour, which the counts report: black
    // gains the placed disc and the turned one, white loses one (§2).
    expect(board().querySelectorAll('.rv-disc')).toHaveLength(5);
    expect(screen.getByText(/You\s*4/)).toBeInTheDocument();
    expect(screen.getByText(/CPU\s*1/)).toBeInTheDocument();

    // The CPU answers on a timer (§5); Undo comes back either way.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/You\s*2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('shows no clock while playing (§11)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('choosing a colour (§1)', () => {
  it('lets the CPU open when the player takes white, and keeps the choice', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    const white = await screen.findByRole('radio', { name: 'White · second' });
    expect(screen.getByRole('radio', { name: 'Black · first' })).toBeChecked();
    await user.click(white);
    expect(white).toBeChecked();

    await user.click(screen.getByRole('button', { name: /Easy/ }));
    // Black opens, and black is the CPU now: the opening move arrives on its
    // own timer and the board is not the player's to touch until it lands.
    expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
    await waitFor(() => expect(board().querySelectorAll('.rv-disc')).toHaveLength(5));
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument());
    // The counts are told from the player's side whichever colour that is.
    expect(screen.getByText(/You\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/CPU\s*4/)).toBeInTheDocument();
  });

  it('leaves the match in progress on the colour it started with', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);

    // The saved match was started as black; flipping the preference is about
    // the next one and must not change this board's sides.
    await user.click(await screen.findByRole('radio', { name: 'White · second' }));
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(screen.getByText(/You\s*2/)).toBeInTheDocument();
  });
});

describe('home', () => {
  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports a record per opponent, and no streak (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Wins')).toHaveLength(3);
    expect(screen.getAllByText('Draws')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z takes the move back, same as the Undo button', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Row 3, column 4: your move' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled());

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByText(/You\s*2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
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
    taughtAlready();
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launchFromCollection();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_000);
      });
      background();
      await settle();
      expect(storedElapsedSeconds()).toBe(9);

      // The process dies here. Relaunch and stop on the game's own home.
      cleanup();
      launchFromCollection();
      await settle();
      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

      // Away again without ever resuming: the nine seconds are still there.
      background();
      await settle();
      expect(storedElapsedSeconds()).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what Reversi does about it (issue #113).
 * The shell says only which door was used; every decision below is this
 * game's, taken from its own single save slot (§9).
 */
describe('a home-screen shortcut', () => {
  /**
   * Leaves one match suspended the way a player does: start it, play a move,
   * walk away. The move matters — it makes the saved position one a fresh
   * board could not be mistaken for.
   */
  async function suspendAnEasyMatch(user: ReturnType<typeof userEvent.setup>) {
    taughtAlready();
    launchFromCollection();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Row 3, column 4: your move' }));
    // The CPU answers on its own timer (§5), and the reply is part of what
    // gets saved: one more disc, and the turn back with the player.
    await waitFor(() => expect(board().querySelectorAll('.rv-disc')).toHaveLength(6), {
      timeout: 3000,
    });
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();
  }

  const maybeBoard = () => screen.queryByRole('group', { name: /Reversi board/ });
  const opponentList = () => screen.queryByRole('button', { name: /Easy/ });

  it('opens the suspended match straight onto its board', async () => {
    const user = userEvent.setup();
    await suspendAnEasyMatch(user);

    launchFromShortcut();
    await settle();

    // The position that was saved, not a new one: six discs and the move.
    expect(maybeBoard()).toBeInTheDocument();
    expect(board().querySelectorAll('.rv-disc')).toHaveLength(6);
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(opponentList()).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    await suspendAnEasyMatch(user);

    const onExit = launchFromShortcut();
    await settle();
    expect(maybeBoard()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(opponentList()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  /**
   * The one thing a shortcut can now do that no other launch could: put a
   * board on screen with the CPU to move, and let its search run without a
   * tap in this launch at all (docs/GAME_LIFECYCLE.md「CPU 探索」).
   *
   * It is reachable the moment a player taps a move and walks away inside the
   * CPU's 450ms (§5) — a real thing to do, and the save keeps the turn where
   * it was. Fake timers hold that gap open rather than racing it.
   */
  it('resumes a match the CPU was to move in, and lets it play', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launchFromCollection();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Row 3, column 4: your move' }));
      // Away before the reply lands: the saved position has the CPU to move.
      fireEvent.click(screen.getByRole('button', { name: 'Home' }));
      await settle();
      cleanup();

      launchFromShortcut();
      await settle();

      expect(maybeBoard()).toBeInTheDocument();
      expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
      expect(board().querySelectorAll('.rv-disc')).toHaveLength(5);

      // The same one timer the home's Resume arms, on the same delay.
      await act(async () => {
        vi.advanceTimersByTime(CPU_DELAY_MS);
      });

      expect(screen.getByText('Your turn')).toBeInTheDocument();
      expect(board().querySelectorAll('.rv-disc')).toHaveLength(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    // Nothing to come back to, so a shortcut is just a way into the game —
    // and starting a match nobody asked for would spend a play (§8).
    expect(maybeBoard()).not.toBeInTheDocument();
    expect(opponentList()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    await suspendAnEasyMatch(user);

    launchFromCollection();
    await settle();

    expect(maybeBoard()).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    const user = userEvent.setup();
    await suspendAnEasyMatch(user);
    // The flags record is the one that can come back unreadable while the
    // match survives; the validator fails closed to "not taught yet" (§9), and
    // a shortcut must not turn that into a way past Quick Rules (§10).
    deviceStore.delete(RV_STORAGE_KEYS.flags);

    launchFromShortcut();

    expect(await screen.findByText('Trap discs to turn them')).toBeInTheDocument();
    expect(maybeBoard()).not.toBeInTheDocument();
  });

  // Play five seconds, background the app, let Android kill it, come back
  // through the shortcut. A board that is on screen from the first render
  // never went through `activate`, so it has to seed the same two clocks that
  // call does — the save's own seconds must not go backwards, and they must
  // not be booked into the statistics twice (§8, §9).
  it('does not book the resumed match’s play seconds a second time', async () => {
    taughtAlready();
    // The play clock is a plain interval, so it has to be faked before the
    // game screen mounts — which rules out userEvent here (it waits on real
    // timers).
    vi.useFakeTimers();
    try {
      launchFromCollection();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedElapsedSeconds()).toBe(5);

      // The process dies here; nothing else runs. The shortcut is the next
      // thing that happens.
      cleanup();
      launchFromShortcut();
      await settle();
      expect(maybeBoard()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once, and still eight on the match
      // itself: the restored five are neither lost nor counted again.
      expect(storedPlaySeconds()).toBe(8);
      expect(storedElapsedSeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
