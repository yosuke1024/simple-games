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
