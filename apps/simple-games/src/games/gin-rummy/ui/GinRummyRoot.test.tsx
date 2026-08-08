import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  CARD_COUNT,
  createSession,
  isValidHand,
  MATCH_TARGET,
  opponentOf,
  restoreSession,
  sortedCards,
  YOU,
  type Card,
  type GinRummySession,
  type HandState,
  type Seat,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { GR_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { GinRummyRoot } from './GinRummyRoot';

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

// ---------- positions, dealt by hand ----------

/**
 * A position mid-hand, the same way state/GameContext.test.tsx builds one: the
 * two holdings as given, every other card face down. Playing a match into the
 * position these tests need would take a hundred taps and pin nothing extra.
 *
 * The one way to be holding eleven cards with nothing on the pile is to have
 * taken the turned card off it, so that is the history the log carries — and it
 * has to, because the decoder rebuilds the pile from the log and refuses a save
 * whose record does not produce the table it was saved with (game/types.ts).
 */
function craft(you: readonly Card[], cpu: readonly Card[], turn: Seat): HandState {
  const held = new Set<Card>([...you, ...cpu]);
  const rest: Card[] = [];
  for (let card = 0; card < CARD_COUNT; card++) if (!held.has(card)) rest.push(card);
  const upcard = sortedCards(turn === YOU ? you : cpu)[0]!;
  const hand: HandState = {
    dealer: opponentOf(turn),
    hands: [sortedCards(you), sortedCards(cpu)],
    stock: rest,
    discard: [],
    turn,
    phase: 'discard',
    ending: 'none',
    takenFromDiscard: null,
    mustDrawStock: false,
    log: [
      { kind: 'upcard', card: upcard },
      { kind: 'draw-discard', seat: turn, card: upcard },
    ],
  };
  // A crafted position the rules could not produce proves nothing.
  if (!isValidHand(hand)) throw new Error('crafted hand is not a hand');
  return hand;
}

/**
 * The match around the position. On the first hand the move count is not free:
 * it is exactly the actions this hand's log carries (storage/gamePersistence.ts).
 */
const sessionWith = (hand: HandState, scores: [number, number] = [0, 0]): GinRummySession =>
  restoreSession({
    ...createSession('normal', 'gin-uitest'),
    hand,
    scores,
    moveCount: hand.log.length - 1,
  });

/** Three sets and a king: exactly ten deadwood once 2♣ goes down — a knock. */
const LIMIT_HAND = [0, 1, 2, 13, 14, 15, 26, 27, 28, 40, 51];
/** Three runs and the ace of clubs: one deadwood, and it lays off on the aces. */
const TIGHT_HAND = [3, 4, 5, 16, 17, 18, 29, 30, 31, 39];
/** Four aces, four twos and three threes: gin the moment 2♣ goes down. */
const GIN_HAND = [0, 1, 2, 13, 14, 15, 26, 27, 28, 39, 40];
/** Ten scattered cards: no set, no run, eighty points of deadwood. */
const JUNK_HAND = [4, 8, 12, 19, 23, 30, 33, 37, 44, 48];
/** Eleven scattered cards: nothing melds, so nothing here can ever knock. */
const NO_KNOCK_HAND = [6, 8, 12, 19, 21, 23, 33, 37, 44, 48, 50];
/** The card put down to declare with, in both knocking hands above. */
const TWO_OF_CLUBS = /2 of clubs/;

// ---------- mounting ----------

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <GinRummyRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <GinRummyRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

const tutorialDone = {
  [GR_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const saved = (session: GinRummySession) => ({
  ...tutorialDone,
  [GR_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
});

const table = () => screen.getByRole('group', { name: 'Gin Rummy table' });
const hand = () => screen.getByRole('group', { name: 'Your hand' });

/** Resumes the saved match — always dealt against Normal, above. */
async function resume(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Normal/ }));
}

/** Lets the local reads and the saves they trigger resolve (promises, not
 * timers, so this works under fake timers too). */
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
  const raw = deviceStore.get(GR_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

// ---------- the first launch ----------

describe('first run', () => {
  it('shows Quick Rules and deals a hand right after', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Draw one, throw one')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Sets and runs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Knock at ten or less')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Ten cards each, and the twenty-first face up between them.
    expect(within(hand()).getAllByRole('button')).toHaveLength(10);
    expect(within(table()).getByRole('group', { name: /CPU holds 10 cards/ })).toBeInTheDocument();
  });

  it('does not show Quick Rules again once it is done', async () => {
    renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    expect(screen.queryByText('Draw one, throw one')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Playing' })).not.toBeInTheDocument();
  });
});

// ---------- the table ----------

describe('the table', () => {
  it('counts the deadwood, always, and shows no clock and no undo', async () => {
    const user = userEvent.setup();
    renderGame(saved(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU))));
    await resume(user);

    // Three sets carry ten of the eleven cards; the king is what is left over,
    // and its ten points are on screen without being asked for.
    expect(screen.getByText(/Deadwood\s*10/)).toBeInTheDocument();

    // Nothing on screen is formatted as a running time (the rules, §8 and §11.2).
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    // And there is no take-back: seeing the reply and then handing the card
    // back is a leak no undo can undo (game/session.ts).
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('arranges the hand into melds and deadwood, and names them', async () => {
    const user = userEvent.setup();
    renderGame(saved(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU))));
    await resume(user);

    // The arrangement is announced, not only drawn: three sets — aces, twos
    // and threes — and the one card no meld would take.
    expect(within(hand()).getAllByRole('button', { name: /meld \d/ })).toHaveLength(10);
    expect(within(hand()).getAllByRole('button', { name: /deadwood$/ })).toHaveLength(1);
    expect(
      within(hand()).getByRole('button', { name: 'K of clubs, deadwood' }),
    ).toBeInTheDocument();
    // Eleven cards, over two rows — one row of six cannot hold them at a tap
    // width the series allows (components/GinRummyTable.tsx).
    expect(hand().querySelectorAll('.gr-hand-row')).toHaveLength(2);
  });
});

// ---------- the knock ----------

describe('the Knock button', () => {
  it('appears only while a knock is actually available', async () => {
    const user = userEvent.setup();
    renderGame(saved(sessionWith(craft(NO_KNOCK_HAND, TIGHT_HAND, YOU))));
    await resume(user);

    // Ninety-six points of deadwood and nothing melds: no card put down would
    // leave a hand allowed to declare, so there is nothing to press. Its
    // absence is the answer, and it is never a greyed-out button.
    expect(screen.getByText(/Deadwood\s*96/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Knock' })).not.toBeInTheDocument();
  });

  it('appears the moment one is', async () => {
    const user = userEvent.setup();
    renderGame(saved(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU))));
    await resume(user);

    expect(screen.getByRole('button', { name: 'Knock' })).toBeInTheDocument();
  });
});

// ---------- a hand, and then the next ----------

describe('a hand that settles', () => {
  it('lays the settlement out and waits for the next deal to be asked for', async () => {
    const user = userEvent.setup();
    renderGame(saved(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU))));
    await resume(user);

    await user.click(screen.getByRole('button', { name: 'Knock' }));
    // Two taps, not one: the first lifts the card, the second declares.
    const declare = within(hand()).getByRole('button', { name: TWO_OF_CLUBS });
    await user.click(declare);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(declare);

    // Ten deadwood knocked into a hand that lays its last card off onto the
    // knocker's own aces: an undercut, and the points go the other way.
    const settlement = screen.getByRole('alertdialog', { name: 'Undercut' });
    expect(within(settlement).getByText('The CPU takes 35')).toBeInTheDocument();
    // The lay-off is shown as the card it was, not folded into a total.
    expect(within(settlement).getByText('Laid off')).toBeInTheDocument();
    expect(within(settlement).getByText('A of clubs')).toBeInTheDocument();

    // Nothing deals the next hand on a timer; the result is the one thing here
    // worth reading.
    await user.click(within(settlement).getByRole('button', { name: 'Next hand' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // The hand's winner deals the next one, so the upcard is offered here
    // first — and that offer is two named buttons, not a tap on the pile.
    expect(screen.getByRole('button', { name: 'Take' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
  });
});

describe('a match that ends', () => {
  it('states the score and offers a free rematch', async () => {
    const user = userEvent.setup();
    renderGame(saved(sessionWith(craft(GIN_HAND, JUNK_HAND, YOU))));
    await resume(user);

    await user.click(screen.getByRole('button', { name: 'Knock' }));
    const declare = within(hand()).getByRole('button', { name: TWO_OF_CLUBS });
    await user.click(declare);
    await user.click(declare);

    // Gin against eighty points of deadwood is a hundred and five — past the
    // target in one hand, so the match ends rather than dealing another.
    const result = screen.getByRole('alertdialog', { name: 'You win!' });
    expect(within(result).getByText('You take 105')).toBeInTheDocument();
    expect(within(result).getByText(String(MATCH_TARGET + 5))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next hand' })).not.toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'New Game' })).toBeInTheDocument();
  });
});

// ---------- the play clock ----------

describe('backgrounding', () => {
  // Play, background the app, let Android kill it, come back: the match
  // returns, and so must the seconds. The session save alone cannot carry them
  // — `activate` treats a restored session's elapsedSeconds as already
  // counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(GR_STORAGE_KEYS.flags, tutorialDone[GR_STORAGE_KEYS.flags]!);
    // The play clock is a plain interval, so it has to be faked before the game
    // screen mounts — which rules out userEvent here (it waits on real timers).
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here; nothing else runs. Relaunch and resume.
      cleanup();
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Resume/ }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
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

// ---------- home ----------

describe('home', () => {
  it('reports a record per opponent, and no streak', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Wins')).toHaveLength(3);
    expect(screen.getAllByText('Losses')).toHaveLength(3);
    // A match ends when somebody passes a hundred: there is no draw to report.
    expect(screen.queryByText('Draws')).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Easy/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
