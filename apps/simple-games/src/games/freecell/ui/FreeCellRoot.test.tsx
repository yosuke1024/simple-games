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
