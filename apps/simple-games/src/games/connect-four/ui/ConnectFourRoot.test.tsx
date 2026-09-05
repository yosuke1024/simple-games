import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createSession, PLAYER } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { C4_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { ConnectFourRoot } from './ConnectFourRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so most tests here never
 * read a save back; they are about what the screens show. The ones that have
 * to see what a save actually wrote stand behind both instead (`launch`).
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
      <ConnectFourRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the game against the device store, the way a player's phone does. */
function launch() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ConnectFourRoot onExit={onExit} />
    </SettingsProvider>,
  );
  return { onExit };
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

/** Total play seconds as they survive on disk (§7). */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(C4_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

/**
 * The play seconds the saved match itself carries (§8). Read alongside the
 * statistics because the two fail in opposite directions: a clock that starts
 * over on a resume writes this one *down* while the booking still comes out
 * right, and a booking that forgets what was already counted inflates the
 * statistics while this one stays correct.
 */
function storedMatchSeconds(): number {
  const raw = deviceStore.get(C4_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as PersistedGame).elapsedSeconds;
}

const tutorialDone = {
  [C4_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const savedGame = {
  ...tutorialDone,
  [C4_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(createSession('easy', PLAYER, 'connect-four-uitest'), 1),
  ),
};

const board = () => screen.getByRole('group', { name: /Connect Four board/ });

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and deals a board right after (§9)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Tap a column to drop')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Four in a row wins')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Block before you build')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Seven columns, each announced as one control, and an empty grid (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(7);
    expect(board().querySelectorAll('.c4-disc')).toHaveLength(0);
  });
});

describe('playing', () => {
  it('drops one disc and hands the turn to the CPU (§2, §4)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByText('Your turn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Column 4: empty' }));
    expect(board().querySelectorAll('.c4-disc')).toHaveLength(1);

    // The CPU answers on a timer, and the board reads what is stacked in the
    // column it used (§4, §10).
    await waitFor(() => expect(board().querySelectorAll('.c4-disc')).toHaveLength(2));
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument());
  });

  it('takes back the drop and the reply together (§5)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Column 4: empty' }));
    await waitFor(() => expect(board().querySelectorAll('.c4-disc')).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(board().querySelectorAll('.c4-disc')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    // Help is one button; nothing suggests a column (§6).
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('shows no clock while playing (§10)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('choosing a side (§1)', () => {
  it('lets the CPU open when the player picks second, and keeps the choice', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    const second = await screen.findByRole('radio', { name: 'CPU first' });
    expect(screen.getByRole('radio', { name: 'You first' })).toBeChecked();
    await user.click(second);
    expect(second).toBeChecked();

    await user.click(screen.getByRole('button', { name: /Easy/ }));
    // The CPU's opening drop arrives on its own timer; until then the board
    // is not the player's to touch (§4).
    expect(screen.getByText('CPU is thinking…')).toBeInTheDocument();
    await waitFor(() => expect(board().querySelectorAll('.c4-disc')).toHaveLength(1));
    expect(board().querySelectorAll('.c4-disc-cpu')).toHaveLength(1);
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument());
  });

  it('leaves the match in progress on the side it started with', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);

    // The saved match was started by the player; flipping the preference is
    // about the next one and must not touch this board's turn order.
    await user.click(await screen.findByRole('radio', { name: 'CPU first' }));
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    expect(screen.getByText('Your turn')).toBeInTheDocument();
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
  it('Ctrl+Z undoes the drop and the reply together, same as the button', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await user.click(await screen.findByRole('button', { name: /Easy/ }));

    await user.click(screen.getByRole('button', { name: 'Column 4: empty' }));
    await waitFor(() => expect(board().querySelectorAll('.c4-disc')).toHaveLength(2));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(board().querySelectorAll('.c4-disc')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

/**
 * A pinned home-screen shortcut, and what Connect Four does about it (issue
 * #113). The shell says only which door was used; the decision below is this
 * game's, taken from its own single save slot (§8).
 */
describe('a home-screen shortcut', () => {
  /** The same store a launch reads, entered by the other door. */
  function launchFromShortcut() {
    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <ConnectFourRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    return { onExit };
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(C4_STORAGE_KEYS.flags, tutorialDone[C4_STORAGE_KEYS.flags]!);
  }

  /** Plays a move against Easy and walks away, the way a match is suspended (§8). */
  async function suspendAMatch() {
    const user = userEvent.setup();
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Column 4: empty' }));
    await waitFor(() => expect(board().querySelectorAll('.c4-disc')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    cleanup();
  }

  const boardShown = () => screen.queryByRole('group', { name: /Connect Four board/ });
  const homeShown = () => screen.queryByText('Choose your opponent');

  it('opens the one suspended match straight onto its board', async () => {
    taughtAlready();
    await suspendAMatch();

    launchFromShortcut();
    await settle();

    expect(boardShown()).toBeInTheDocument();
    // The match that was left, not a fresh one: both discs are still down.
    expect(board().querySelectorAll('.c4-disc')).toHaveLength(2);
    expect(homeShown()).not.toBeInTheDocument();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    taughtAlready();
    await suspendAMatch();

    const user = userEvent.setup();
    const { onExit } = launchFromShortcut();
    await settle();
    await user.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the
    // board was reached through: the way in did not add a screen to undo.
    expect(homeShown()).toBeInTheDocument();
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
    taughtAlready();
    await suspendAMatch();

    launch();
    await settle();

    // Nothing was taken away by the shortcut existing — the match is still
    // there to be picked up by hand, on the opponent it was played against.
    expect(boardShown()).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    taughtAlready();
    await suspendAMatch();
    // The flag and the match are two independent records, so they can fall
    // out of step — a flags write that never landed leaves exactly this. A
    // first launch has nothing to resume anyway, so this is the only shape in
    // which the ordering can actually be put to the test.
    deviceStore.delete(C4_STORAGE_KEYS.flags);

    launchFromShortcut();

    // A shortcut is not a way past Quick Rules (§9). The match is not thrown
    // away either — it is just not what this launch opens on.
    expect(await screen.findByText('Tap a column to drop')).toBeInTheDocument();
    expect(boardShown()).not.toBeInTheDocument();
  });

  // The counterpart of §8's promise that a restored elapsedSeconds comes back
  // as *already booked*: arriving at the board without passing through the
  // home screen has to seed the same two clocks `activate` does, or the
  // seconds already played are either lost from the save or counted twice.
  it('does not book the resumed match’s play seconds a second time', async () => {
    taughtAlready();
    // The play clock is a plain interval, so it has to be faked before the
    // game screen mounts — which rules out userEvent here (it waits on real
    // timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedMatchSeconds()).toBe(5);

      // The process dies here; nothing else runs. The shortcut relaunches it
      // straight onto the board.
      cleanup();
      launchFromShortcut();
      await settle();
      expect(boardShown()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once: the restored five are neither
      // lost from the match nor booked into the statistics a second time.
      expect(storedMatchSeconds()).toBe(8);
      expect(storedPlaySeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
