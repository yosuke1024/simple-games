import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createDifficultySession, generateDeck, LAYOUTS, tapCard } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { MM_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { MemoryMatchRoot } from './MemoryMatchRoot';

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
      <MemoryMatchRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(MM_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

const tutorialDone = {
  [MM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** A pinned easy game, so the test knows where every pair is. */
const SEED = 'memory-easy-uitest';
const DECK = generateDeck(SEED, 'easy');

const savedEasyGame = {
  ...tutorialDone,
  [MM_STORAGE_KEYS.game]: JSON.stringify(toPersisted(createDifficultySession('easy', SEED), 1)),
};

const positionOf = (index: number) => ({
  row: Math.floor(index / LAYOUTS.easy.cols) + 1,
  col: (index % LAYOUTS.easy.cols) + 1,
});

const board = () => screen.getByRole('group', { name: /Memory board/ });

const downCard = (index: number) => {
  const { row, col } = positionOf(index);
  return within(board()).getByRole('button', {
    name: `Face down, row ${row}, column ${col}`,
  });
};

/** The two cells holding the same symbol as `index`, itself excluded. */
const partnerOf = (index: number): number =>
  DECK.findIndex((symbol, i) => symbol === DECK[index] && i !== index);

/** A cell whose symbol differs from the one at `index`. */
const strangerTo = (index: number): number => DECK.findIndex((symbol) => symbol !== DECK[index]);

async function resumeEasyGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Easy/ }));
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MemoryMatchRoot onExit={vi.fn()} />
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

/** Total play seconds as they survive on disk, across every board size. */
function storedPlaySeconds(): number {
  const raw = deviceStore.get(MM_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  const stats = JSON.parse(raw) as Stats;
  return stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('backgrounding (§10)', () => {
  // Play five minutes, background the app, let Android kill it, come back: the
  // board returns, and so must the five minutes. The session save alone cannot
  // carry them — `activate` treats a restored session's elapsedSeconds as
  // already counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(MM_STORAGE_KEYS.flags, tutorialDone[MM_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

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
  it('shows Quick Rules and starts an easy board right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Flip two cards')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('No rush to remember')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Match every pair')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // An easy board: twelve cards, all face down (§6).
    expect(within(board()).getAllByRole('button')).toHaveLength(12);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('locks a found pair face up and counts the move (§3, §4)', async () => {
    const user = userEvent.setup();
    renderGame(savedEasyGame);
    await resumeEasyGame(user);

    const first = 0;
    const second = partnerOf(first);
    await user.click(downCard(first));
    await user.click(downCard(second));

    // Both cards are announced as matched and are no longer controls.
    expect(within(board()).getAllByRole('img')).toHaveLength(2);
    expect(within(board()).getAllByRole('button')).toHaveLength(10);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/Pairs\s*1\/6/)).toBeInTheDocument();
  });

  it('turns the second card of a found pair like any other card (§12)', async () => {
    const user = userEvent.setup();
    renderGame(savedEasyGame);
    await resumeEasyGame(user);

    const first = 0;
    const second = partnerOf(first);
    await user.click(downCard(first));
    await user.click(downCard(second));

    // Becoming matched rebuilds the card as an image, which is why the turn
    // is keyframed rather than transitioned — without this, the second card
    // arrives face up having never turned.
    const cardOf = (index: number) => {
      const { row, col } = positionOf(index);
      return within(board()).getByRole('img', {
        name: `Matched, symbol ${DECK[index]! + 1}, row ${row}, column ${col}`,
      });
    };
    expect(cardOf(second).querySelector('.mm-card-turning')).toBeInTheDocument();
    // The first card was already showing; it has nothing to turn.
    expect(cardOf(first).querySelector('.mm-card-turning')).not.toBeInTheDocument();
    // Both are acknowledged as the pair.
    expect(cardOf(first)).toHaveClass('mm-card-found');
    expect(cardOf(second)).toHaveClass('mm-card-found');
  });

  it('brings a resumed board back already settled, not replaying old pairs (§10, §12)', async () => {
    const user = userEvent.setup();
    const found = tapCard(tapCard(createDifficultySession('easy', SEED), 0)!, partnerOf(0))!;
    renderGame({
      ...tutorialDone,
      [MM_STORAGE_KEYS.game]: JSON.stringify(toPersisted(found, 1)),
    });
    await resumeEasyGame(user);

    expect(within(board()).getAllByRole('img')).toHaveLength(2);
    expect(board().querySelectorAll('.mm-card-found')).toHaveLength(0);
    expect(board().querySelectorAll('.mm-card-turning')).toHaveLength(0);
  });

  it('keeps a mismatch visible until the next flip (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedEasyGame);
    await resumeEasyGame(user);

    const first = 0;
    const second = strangerTo(first);
    await user.click(downCard(first));
    await user.click(downCard(second));

    // Both stay face up — no timer flips them back (§3).
    expect(within(board()).getAllByRole('button', { name: /^Symbol/ })).toHaveLength(2);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();

    // The next flip puts them away and opens its own card.
    const third = DECK.findIndex((_, i) => i !== first && i !== second);
    await user.click(downCard(third));
    expect(within(board()).getAllByRole('button', { name: /^Symbol/ })).toHaveLength(1);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no hint and no undo, at any point in a game (§8)', async () => {
    const user = userEvent.setup();
    renderGame(savedEasyGame);
    await resumeEasyGame(user);

    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();

    // Still nothing after playing — help is not unlocked by progress.
    await user.click(downCard(0));
    await user.click(downCard(partnerOf(0)));
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§4, §7)', async () => {
    const user = userEvent.setup();
    renderGame(savedEasyGame);
    await resumeEasyGame(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers the three boards and the daily, and exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Medium/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hard/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports per-board facts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Days cleared')).toBeInTheDocument();
    expect(screen.getByText(/Easy · 3×4/)).toBeInTheDocument();
    expect(screen.getByText(/Medium · 4×5/)).toBeInTheDocument();
    expect(screen.getByText(/Hard · 5×6/)).toBeInTheDocument();
    expect(screen.getAllByText('Fewest moves')).toHaveLength(3);
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
    deviceStore.set(MM_STORAGE_KEYS.flags, tutorialDone[MM_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

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
