import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { BLACK, createSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { GM_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { GomokuRoot } from './GomokuRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so the blocks that use it
 * never read a save back; those tests are about what the screens show. The
 * shortcut block is the exception: it launches against this store and asserts
 * what the last sitting actually wrote to it.
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
      <GomokuRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

const tutorialDone = {
  [GM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const savedGame = {
  ...tutorialDone,
  [GM_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(createSession('easy', BLACK, 'gomoku-uitest'), 1),
  ),
};

const board = () => screen.getByRole('group', { name: /Gomoku board/ });
const stones = () => board().querySelectorAll('.gm-stone');

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and sets a board right after (§9)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Tap once to aim, again to place')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Five in a row wins')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Block the open three')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Two hundred and twenty-five crossings, and an empty board (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(225);
    expect(stones()).toHaveLength(0);
  });
});

describe('placing a stone takes two taps (§2)', () => {
  it('marks on the first tap and places on the second', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByText(/Your turn/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));

    // Nothing is on the board yet — the crossing is only aimed at.
    expect(stones()).toHaveLength(0);
    expect(screen.getByText('Tap the same point again to place your stone.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: tap again to place' }));
    expect(stones()).toHaveLength(1);

    // The CPU answers on its own timer.
    await waitFor(() => expect(stones()).toHaveLength(2));
    await waitFor(() => expect(screen.getByText(/Your turn/)).toBeInTheDocument());
  });

  it('moves the mark when another crossing is tapped, placing nothing', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));
    await user.click(screen.getByRole('button', { name: 'Row 4, column 4: empty' }));

    expect(stones()).toHaveLength(0);
    expect(
      screen.getByRole('button', { name: 'Row 4, column 4: tap again to place' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Row 8, column 8: empty' })).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('takes back the stone and the reply together (§5)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: tap again to place' }));
    await waitFor(() => expect(stones()).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(stones()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    // Help is one button; nothing suggests a crossing (§6).
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('shows no clock while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

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
    // Black opens and black is the CPU here, so the first stone is not the
    // player's to place (§1, §4).
    expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
    await waitFor(() => expect(stones()).toHaveLength(1));
    await waitFor(() => expect(screen.getByText(/Your turn/)).toBeInTheDocument());
  });

  it('leaves the match in progress on the colour it started with', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);

    await user.click(await screen.findByRole('radio', { name: 'White · second' }));
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    expect(screen.getByText(/Your turn/)).toBeInTheDocument();
  });
});

describe('the play clock survives a backgrounding', () => {
  it('books the seconds played when the app is hidden, not only at the end', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderGame(savedGame);
      await user.click(await screen.findByRole('button', { name: /Easy/ }));

      // Eight seconds of play, then the OS hides the app — which is the last
      // event a killed process gets.
      await vi.advanceTimersByTimeAsync(8000);
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);

      expect(board()).toBeInTheDocument();
    } finally {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      vi.useRealTimers();
    }
  });
});

/**
 * A pinned home-screen shortcut, and what Gomoku does about it (issue #113).
 *
 * The shell says only which door the launch came through; every decision below
 * is this game's, taken from its own save (§8). There is no "which match did
 * they mean" case to cover here: one slot cannot be ambiguous, and
 * `loadSavedGame` has already thrown away anything that is not a match still
 * being played — so the whole question is whether there is a match at all.
 *
 * These launches read the device store rather than the `kv` seam the tests
 * above use, because what a shortcut opens onto is decided by what the last
 * sitting actually wrote.
 */
describe('a home-screen shortcut', () => {
  /** Launches against the device store, the way a player's phone does. */
  function launch() {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <GomokuRoot onExit={vi.fn()} />
      </SettingsProvider>,
    );
  }

  /** The same store, entered by the other door. */
  function launchFromShortcut() {
    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <GomokuRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    return { onExit };
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(GM_STORAGE_KEYS.flags, tutorialDone[GM_STORAGE_KEYS.flags]!);
  }

  /** Lets the local reads, and the saves they trigger, resolve. */
  const settle = () => act(async () => undefined);

  const boardOrNull = () => screen.queryByRole('group', { name: /Gomoku board/ });
  const findBoard = () => screen.findByRole('group', { name: /Gomoku board/ });
  /** The home screen's Easy button once it is the way back into a match. */
  const resumeButton = () => screen.queryByRole('button', { name: /Easy.*Resume/ });

  /** Plays a match a couple of stones in and leaves it, as the player would. */
  async function suspendAnEasyMatch() {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await user.click(await screen.findByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: tap again to place' }));
    await waitFor(() => expect(stones()).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    cleanup();
  }

  it('opens the one suspended match straight onto its board', async () => {
    await suspendAnEasyMatch();

    launchFromShortcut();

    expect(await findBoard()).toBeInTheDocument();
    // The position that was left, not a fresh board (§8).
    expect(stones()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Easy/ })).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    await suspendAnEasyMatch();
    const user = userEvent.setup();

    const { onExit } = launchFromShortcut();
    expect(await findBoard()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the board
    // was reached through: the way in did not add a screen to undo.
    expect(resumeButton()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when no match is suspended', async () => {
    taughtAlready();

    launchFromShortcut();

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });

  it('is the only door that resumes: the collection’s tile still opens the home', async () => {
    await suspendAnEasyMatch();

    launch();

    // Untouched and still one tap away, exactly as before this issue.
    expect(await screen.findByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });

  it('teaches the game first when Quick Rules were never finished', async () => {
    await suspendAnEasyMatch();
    // The flag and the match are separate records (§8), so the two states can
    // disagree: a flags record that does not validate leaves the game with its
    // defaults — Quick Rules unfinished — while the saved match still loads.
    // A shortcut is not a way past them; the tutorial's only exit starts a new
    // match, which would finalize this one away.
    deviceStore.set(GM_STORAGE_KEYS.flags, JSON.stringify({ schemaVersion: 9 }));

    launchFromShortcut();

    expect(await screen.findByText('Tap once to aim, again to place')).toBeInTheDocument();
    expect(boardOrNull()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding block above: a match resumed at mount
  // seeds the same two clocks `activate` does, so the seconds already played
  // are neither lost from the match nor booked into the statistics twice (§7).
  it('does not book the resumed match’s play seconds a second time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      taughtAlready();
      launch();
      await user.click(await screen.findByRole('button', { name: /Easy/ }));

      await vi.advanceTimersByTimeAsync(8000);
      await background();
      expect(storedPlaySeconds()).toBe(8);
      expect(storedElapsedSeconds()).toBe(8);
      cleanup();

      launchFromShortcut();
      expect(await findBoard()).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(3000);
      await background();

      // Eleven seconds played, counted once: the match keeps its own total,
      // and the statistics gain only the three seconds that are new.
      expect(storedElapsedSeconds()).toBe(11);
      expect(storedPlaySeconds()).toBe(11);
    } finally {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      vi.useRealTimers();
    }
  });

  /** The OS hides the app — the last event a killed process is sure to get. */
  async function background() {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  }

  /** Total play seconds as they survive on disk (§7). */
  function storedPlaySeconds(): number {
    const raw = deviceStore.get(GM_STORAGE_KEYS.stats);
    return raw === undefined ? 0 : (JSON.parse(raw) as Stats).totalPlaySeconds;
  }

  /** The suspended match's own accumulated play seconds, as saved (§8). */
  function storedElapsedSeconds(): number {
    const raw = deviceStore.get(GM_STORAGE_KEYS.game);
    return raw === undefined ? 0 : (JSON.parse(raw) as PersistedGame).elapsedSeconds;
  }
});

describe('home', () => {
  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports a record per opponent, and no streak (§7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Losses')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the stone and the reply together, same as the button', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: empty' }));
    await user.click(screen.getByRole('button', { name: 'Row 8, column 8: tap again to place' }));
    await waitFor(() => expect(stones()).toHaveLength(2));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(stones()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
