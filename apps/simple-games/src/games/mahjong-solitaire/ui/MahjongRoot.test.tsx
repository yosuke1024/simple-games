import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { generateBoard, levelParams } from '../game';
import { MJ_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { MahjongRoot } from './MahjongRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to
 * read back what a save actually wrote has to stand behind both.
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
      <MahjongRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [MJ_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: /Mahjong board/ });

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MahjongRoot onExit={vi.fn()} />
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
  const raw = deviceStore.get(MJ_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.totalPlaySeconds;
}

/** The suspended level game's own clock, as it survives on disk (§10). */
function storedLevelSeconds(): number {
  const raw = deviceStore.get(MJ_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  // Play five seconds, background the app, let Android kill it, come back:
  // the board returns, and so must the five seconds. The session save alone
  // cannot carry them — `activate` treats a restored session's elapsedSeconds
  // as already counted, so anything not booked before the kill is gone for
  // good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(MJ_STORAGE_KEYS.flags, tutorialDone[MJ_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the
    // game screen mounts — which rules out userEvent here (it waits on real
    // timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

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
 * A pinned home-screen shortcut, and what this game does about it (issue
 * #113). The shell says only which door was used; every decision below is
 * Mahjong Solitaire's own, taken from its two save slots (§6, §10).
 */
describe('a home-screen shortcut', () => {
  /** The same device store a launch reads, entered by the other door. */
  function launchFromShortcut(onExit: () => void = vi.fn()) {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <MahjongRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
  }

  /** Quick Rules behind the player, the way every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(MJ_STORAGE_KEYS.flags, tutorialDone[MJ_STORAGE_KEYS.flags]!);
  }

  /** Leaves the board the way the back arrow does, which is what suspends it. */
  async function suspend(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Home' }));
  }

  const anyBoard = () => screen.queryByRole('group', { name: /Mahjong board/ });
  const home = () => screen.queryByRole('button', { name: /Daily Challenge/ });

  it('opens the one suspended game straight onto its board', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await startLevelOne(user);
    await suspend(user);
    cleanup();

    launchFromShortcut();
    await settle();

    expect(anyBoard()).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(home()).not.toBeInTheDocument();
  });

  it('opens the daily when that is the suspended one, on the daily slot', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await user.click(await screen.findByRole('button', { name: /Daily Challenge/ }));
    await suspend(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // The board reads through the active slot, so resuming the daily has to
    // move that slot too — pointing it at the empty level slot would render
    // nothing at all (§6: the two are kept apart on purpose).
    expect(anyBoard()).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('leaves that board for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await startLevelOne(user);
    await suspend(user);
    cleanup();

    const onExit = vi.fn();
    launchFromShortcut(onExit);
    await settle();
    await suspend(user);

    // One step back from a board is this game's home, whichever door the board
    // was reached through: the way in did not add a screen to undo.
    expect(home()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home screen when both slots are suspended, rather than guessing', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await startLevelOne(user);
    await suspend(user);
    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    await suspend(user);
    cleanup();

    launchFromShortcut();
    await settle();

    // A level and the daily are kept apart on purpose (§6), so a shortcut
    // carries no signal saying which one was meant. Both are still there to be
    // picked up by hand — nothing was chosen for the player, and nothing was
    // thrown away either.
    expect(anyBoard()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge.*Resume/ })).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(anyBoard()).not.toBeInTheDocument();
    expect(home()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await startLevelOne(user);
    await suspend(user);
    cleanup();

    launch();
    await settle();

    expect(anyBoard()).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Level 1.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first, even with a game suspended (§11)', async () => {
    const user = userEvent.setup();
    taughtAlready();
    launch();
    await settle();
    await startLevelOne(user);
    await suspend(user);
    cleanup();

    // The flag and the saves are independent keys (`mj.flags` vs
    // `mj.saveGame`), so a cleared or unreadable flag can sit beside a good
    // board — and then Quick Rules are what this launch has not seen yet. A
    // shortcut does not become a way past them; the board is still there
    // afterwards, unchanged.
    deviceStore.delete(MJ_STORAGE_KEYS.flags);
    launchFromShortcut();

    expect(await screen.findByText('Take matching pairs')).toBeInTheDocument();
    expect(anyBoard()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding test above: mounting straight onto a
  // board seeds the same two clocks `activate` does, so the seconds already
  // played are neither lost nor counted again.
  it('does not book the resumed game’s play seconds a second time', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Level 1/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      expect(storedLevelSeconds()).toBe(5);

      // The process dies here; the shortcut is the next thing that happens.
      cleanup();
      launchFromShortcut();
      await settle();
      expect(anyBoard()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      // Eight seconds of play, counted once — and still eight on the board's
      // own clock. The two are separate failures: a booked clock that starts
      // at zero writes the five restored seconds off the save (and off any
      // best time computed from it), while a live clock seeded without its
      // booked twin adds all five to the statistics a second time.
      expect(storedPlaySeconds()).toBe(8);
      expect(storedLevelSeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Take matching pairs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Flowers and seasons are groups')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Clear the board')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is the 24-tile sprout, every tile a labelled button.
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
    expect(within(board()).getAllByRole('button')).toHaveLength(24);
  });
});

describe('taking pairs (§2, §3)', () => {
  it('removes a matching free pair on two taps', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The golden level-1 board holds exactly two free Bamboo 2 tiles.
    const pair = within(board()).getAllByRole('button', { name: 'Bamboo 2, can be taken' });
    expect(pair).toHaveLength(2);
    await user.click(pair[0]!);
    expect(pair[0]).toHaveAttribute('aria-pressed', 'true');
    await user.click(pair[1]!);
    expect(screen.getByText('22 tiles left')).toBeInTheDocument();
  });

  it('moves the selection quietly on a non-matching tap — never a scold (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const dots = within(board()).getAllByRole('button', { name: 'Dots 7, can be taken' })[0]!;
    const wind = within(board()).getAllByRole('button', {
      name: 'East Wind, can be taken',
    })[0]!;
    await user.click(dots);
    expect(dots).toHaveAttribute('aria-pressed', 'true');
    await user.click(wind);
    expect(dots).toHaveAttribute('aria-pressed', 'false');
    expect(wind).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
  });

  it('does nothing on a blocked tile', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const blocked = within(board()).getAllByRole('button', { name: /blocked/ })[0]!;
    await user.click(blocked);
    expect(blocked).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
  });
});

describe('undo and hint (§8) — free, unlimited, never behind anything', () => {
  it('undo takes back the last pair', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const pair = within(board()).getAllByRole('button', { name: 'Bamboo 2, can be taken' });
    await user.click(pair[0]!);
    await user.click(pair[1]!);
    expect(screen.getByText('22 tiles left')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
  });

  it('hint points at a takeable pair', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(document.querySelectorAll('.mj-hint')).toHaveLength(2);
  });
});

describe('winning (§2, §5)', () => {
  it('clears the board along the construction order and celebrates', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // The deal is deterministic (§5), so the test can know a winning order
    // the same way every player's device could: the construction's own.
    const { solvedOrder } = generateBoard(levelParams(1), 'mj-level-1');
    const removed = new Set<number>();
    for (let k = 0; k + 1 < solvedOrder.length; k += 2) {
      const a = solvedOrder[k]!;
      const b = solvedOrder[k + 1]!;
      // Buttons render in tile-index order; position = index minus removed.
      const buttons = within(board()).getAllByRole('button');
      const position = (index: number) =>
        index - [...removed].filter((gone) => gone < index).length;
      await user.click(buttons[position(a)]!);
      await user.click(buttons[position(b)]!);
      removed.add(a).add(b);
    }

    expect(await screen.findByRole('alertdialog', { name: 'Cleared!' })).toBeInTheDocument();
    expect(screen.getByText('Hints used')).toBeInTheDocument();
  });
});

describe('what this game deliberately does not have', () => {
  it('shows no clock and no streak while playing (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports counts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels cleared')).toBeInTheDocument();
    expect(screen.getByText('Dailies cleared')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers both modes and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

/* Keyboard input is an adapter over the same tap handlers (issue #93): this
   checks board state the Undo button also produces, never a keyboard-only
   behaviour. */
describe('keyboard (issue #93)', () => {
  it('Ctrl+Z undoes the last pair, same as the Undo button', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const pair = within(board()).getAllByRole('button', { name: 'Bamboo 2, can be taken' });
    await user.click(pair[0]!);
    await user.click(pair[1]!);
    expect(screen.getByText('22 tiles left')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByText('24 tiles left')).toBeInTheDocument();
  });
});
