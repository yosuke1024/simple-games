/**
 * The context's two jobs that only React can get wrong: the CPU's turn, and
 * the play clock.
 *
 * The CPU's turn is one armed timeout per *action* — draw, then discard — and
 * the effect that arms it depends on the session, so every transition
 * re-evaluates it (docs/GAME_LIFECYCLE.md「CPU 探索」). That single mechanism
 * has to cover four things, and each is pinned below: the two beats of an
 * ordinary turn; a stale timeout landing after the session moved on; leaving
 * the screen or unmounting; and a match restored from the store that resumes
 * *on* the CPU's turn — which needs no path of its own, and having none is the
 * point.
 *
 * The clock is a ref rather than state (battery), so it is observed the way the
 * app observes it: through the session that a save or a navigation leaves
 * behind. Time spent in the background is not play time.
 *
 * The hands here are dealt by hand rather than played into existence, so a
 * settlement worth a hundred points is one call away instead of a hundred. Each
 * one is checked against `isValidHand` as it is built, so a crafted position
 * the rules could not produce fails loudly here rather than quietly proving
 * something about a game nobody can play.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARD_COUNT,
  CPU,
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
import { gameSchema, statsSchema, type Prefs, type Stats } from '../storage/schemas';
import {
  CPU_DELAY_MS,
  GinRummyProvider,
  useGinRummy,
  type GinRummyContextValue,
} from './GameContext';

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

/** The review question is the shell's; here we only watch for the one call. */
const { recordGameCompleted } = vi.hoisted(() => ({ recordGameCompleted: vi.fn() }));
vi.mock('../../../services/review', () => ({ recordGameCompleted }));

// ---------- hands, dealt by hand ----------

/**
 * A position mid-hand: the two holdings as given, every other card face down.
 * In the discard phase the seat to move holds eleven and the pile may be empty;
 * in the draw phase both hold ten and there is a card to take.
 *
 * The log says how the position was reached, because these sessions are saved
 * and the decoder rebuilds the pile from the log before it hands one back
 * (game/types.ts): nothing has happened yet on the draw, and on the discard the
 * seat to move took the turned card, which is the only way to be holding eleven
 * with an empty pile.
 */
function craft(
  you: readonly Card[],
  cpu: readonly Card[],
  turn: Seat,
  phase: 'draw' | 'discard',
): HandState {
  const held = new Set<Card>([...you, ...cpu]);
  const rest: Card[] = [];
  for (let card = 0; card < CARD_COUNT; card++) if (!held.has(card)) rest.push(card);
  const upcard = phase === 'draw' ? rest[0]! : sortedCards(turn === YOU ? you : cpu)[0]!;
  const hand: HandState = {
    dealer: opponentOf(turn),
    hands: [sortedCards(you), sortedCards(cpu)],
    stock: phase === 'draw' ? rest.slice(1) : rest,
    discard: phase === 'draw' ? [upcard] : [],
    turn,
    phase,
    ending: 'none',
    takenFromDiscard: null,
    mustDrawStock: false,
    log:
      phase === 'draw'
        ? [{ kind: 'upcard', card: upcard }]
        : [
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
 * it is exactly the actions this hand's log carries (storage/gamePersistence.ts),
 * so a session built here is one the store would give back unchanged.
 */
const sessionWith = (hand: HandState, scores: [number, number] = [0, 0]): GinRummySession =>
  restoreSession({
    ...createSession('normal', 'gin-ctx'),
    hand,
    scores,
    moveCount: hand.log.length - 1,
  });

/** Three A-2-3 runs and the ace of clubs on top: gin the moment 2♣ goes down. */
const GIN_HAND = [0, 1, 2, 13, 14, 15, 26, 27, 28, 39, 40];
/** Ten scattered high cards: no set, no run, eighty points of deadwood. */
const JUNK_HAND = [4, 8, 12, 19, 23, 30, 33, 37, 44, 48];
/** The same three runs and a king: exactly ten deadwood — the knock limit. */
const LIMIT_HAND = [0, 1, 2, 13, 14, 15, 26, 27, 28, 40, 51];
/** Three runs and the ace of clubs, ten cards: one deadwood, undercut material. */
const TIGHT_HAND = [3, 4, 5, 16, 17, 18, 29, 30, 31, 39];
/** The card put down to declare with, in both knocking hands above. */
const TWO_OF_CLUBS = 40;

// ---------- mounting ----------

interface Mounted {
  api: () => GinRummyContextValue;
  unmount: () => void;
}

function mount(
  initialSession: GinRummySession | null,
  initialPrefs: Prefs = { schemaVersion: 1, difficulty: 'normal' },
): Mounted {
  let value!: GinRummyContextValue;
  function Probe() {
    value = useGinRummy();
    return null;
  }
  const { unmount } = render(
    <GinRummyProvider
      initialStats={statsSchema.defaultValue()}
      initialFlags={{ schemaVersion: 1, tutorialCompleted: true }}
      initialPrefs={initialPrefs}
      initialSession={initialSession}
      onExit={vi.fn()}
    >
      <Probe />
    </GinRummyProvider>,
  );
  return { api: () => value, unmount };
}

/** Mounts a match and brings it on screen, the way a resume does. */
function resumed(session: GinRummySession, prefs?: Prefs): Mounted {
  const mounted = mount(session, prefs);
  act(() => mounted.api().resumeGame());
  return mounted;
}

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Runs one dispatch the way a tap does — inside act — and gives its answer. */
function tap<T>(run: () => T): T {
  let answer!: T;
  act(() => {
    answer = run();
  });
  return answer;
}

const settle = () => act(async () => undefined);

/** What actually survives on disk — the record the next launch will read. */
const stored = <T,>(key: string): T | null => {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
};

let visibility = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
  deviceStore.clear();
  recordGameCompleted.mockClear();
});

// ---------- the CPU's turn ----------

describe('the CPU plays on a timer, one beat per action', () => {
  /** The CPU to draw, holding nothing worth declaring: it will draw and throw. */
  const cpuToDraw = () => sessionWith(craft(GIN_HAND.slice(0, 10), JUNK_HAND, CPU, 'draw'));

  it('waits the whole beat before it moves', async () => {
    const { api } = resumed(cpuToDraw());
    const before = api().session!.moveCount;

    await advance(CPU_DELAY_MS - 1);
    expect(api().session!.moveCount).toBe(before);

    await advance(1);
    expect(api().session!.moveCount).toBe(before + 1);
  });

  it('draws, and then — a beat later — puts a card down', async () => {
    const { api } = resumed(cpuToDraw());

    await advance(CPU_DELAY_MS);
    expect(['draw-stock', 'draw-discard']).toContain(api().lastEvent!.event.kind);
    expect(api().session!.hand.phase).toBe('discard');
    expect(api().session!.hand.turn).toBe(CPU);

    await advance(CPU_DELAY_MS);
    expect(api().lastEvent!.event.kind).toBe('discard');

    // Two beats, and then it is the player's move: nothing more is armed.
    const settled = api().session!;
    expect(settled.hand.turn).toBe(YOU);
    await advance(CPU_DELAY_MS * 4);
    expect(api().session).toBe(settled);
  });

  it('picks up a match restored on the CPU’s turn, with no path of its own', async () => {
    // Exactly what the store hands back: a session that is already the CPU's
    // to move. The effect below is the same one that runs mid-match.
    const { api } = mount(cpuToDraw());
    expect(api().session!.hand.turn).toBe(CPU);

    // Nothing happens while the match is only *loaded* — the game screen is
    // not showing it yet.
    await advance(CPU_DELAY_MS * 3);
    expect(api().session!.moveCount).toBe(cpuToDraw().moveCount);

    act(() => api().resumeGame());
    await advance(CPU_DELAY_MS);
    expect(api().session!.moveCount).toBe(cpuToDraw().moveCount + 1);
  });

  it('is disarmed by leaving the game screen', async () => {
    const { api } = resumed(cpuToDraw());
    act(() => api().goHome());

    const before = api().session!;
    await advance(CPU_DELAY_MS * 4);
    expect(api().session!.moveCount).toBe(before.moveCount);
  });

  it('is disarmed by unmounting, mid-beat', async () => {
    const { api, unmount } = resumed(cpuToDraw());
    await advance(CPU_DELAY_MS - 100);
    const onDisk = deviceStore.get(gameSchema.key);

    unmount();
    await advance(CPU_DELAY_MS * 4);

    // No move landed after the tree went away — the record is where it was,
    // and nothing tried to set state on a component that no longer exists.
    expect(deviceStore.get(gameSchema.key)).toBe(onDisk);
    expect(() => api()).not.toThrow();
  });

  it('is disarmed by a new match started under it', async () => {
    const { api } = resumed(cpuToDraw());
    await advance(CPU_DELAY_MS - 100);

    act(() => api().startNewGame('easy'));
    const dealt = api().session!;
    expect(dealt.difficulty).toBe('easy');
    expect(dealt.handNumber).toBe(1);

    // The beat armed against the old session lands into nothing: the new
    // match is where it was dealt, not one action into somebody else's hand.
    await advance(100);
    expect(api().session!.seed).toBe(dealt.seed);
    expect(api().session!.moveCount).toBe(0);
  });
});

// ---------- the player's turn ----------

describe('the player’s actions', () => {
  it('are refused, silently, when they are not legal', async () => {
    const session = sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard'));
    const { api } = resumed(session);
    // Mid-turn the player has already drawn; there is nothing left to draw.
    expect(tap(() => api().drawStock())).toBe(false);
    expect(tap(() => api().drawDiscard())).toBe(false);
    expect(tap(() => api().takeUpcard())).toBe(false);
    // Putting an ace down breaks the set that was holding two others up, and
    // twelve points of deadwood is over the limit: not a knock.
    expect(tap(() => api().knock(0))).toBe(false);
    // Nothing landed, so nothing counted: the tie-break stream has not moved.
    expect(api().session!.moveCount).toBe(session.moveCount);
    await settle();
  });

  it('put a card down and hand the turn over', async () => {
    const { api } = resumed(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard')));
    expect(tap(() => api().discard(TWO_OF_CLUBS))).toBe(true);
    expect(api().lastEvent!.event).toEqual({ kind: 'discard', seat: YOU, card: TWO_OF_CLUBS });
    expect(api().session!.hand.turn).toBe(CPU);
    await settle();
  });

  it('are not takeable back — there is no undo in the API', () => {
    const { api } = resumed(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard')));
    // Not an oversight: seeing the reply and then taking the move back would
    // hand over a card you now know the opponent wanted (game/session.ts).
    const exposed = Object.keys(api());
    expect(exposed.some((name) => /undo/i.test(name))).toBe(false);
  });
});

// ---------- the settled hand ----------

describe('a hand that settles', () => {
  it('waits on screen for the next deal, and the score is already moved', async () => {
    // Ten deadwood knocked into a hand holding one: an undercut, thirty-five
    // points to the other side, and the match still to play.
    const { api } = resumed(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard')));
    expect(tap(() => api().knock(TWO_OF_CLUBS))).toBe(true);

    const result = api().handResult!;
    expect(result.kind).toBe('undercut');
    expect(result.winner).toBe(CPU);
    expect(api().session!.scores).toEqual([0, result.points]);
    expect(api().session!.status).toBe('playing');
    expect(api().canDealNextHand).toBe(true);
    expect(api().lastResult).toBeNull();

    // Nothing deals it for you: the result is the one thing here worth reading.
    await advance(CPU_DELAY_MS * 4);
    expect(api().session!.handNumber).toBe(1);

    expect(tap(() => api().dealNextHand())).toBe(true);
    expect(api().session!.handNumber).toBe(2);
    expect(api().session!.hand.phase).toBe('upcard');
    // The hand's winner deals the next one.
    expect(api().session!.hand.dealer).toBe(CPU);
    expect(api().handResult).toBeNull();
    expect(api().lastEvent).toBeNull();
    await settle();
  });

  it('has nothing to deal while the hand is still being played', async () => {
    const { api } = resumed(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard')));
    expect(api().canDealNextHand).toBe(false);
    expect(tap(() => api().dealNextHand())).toBe(false);
    await settle();
  });
});

// ---------- the match ----------

describe('a match that ends', () => {
  it('books the win, clears the slot, and asks the review question once', async () => {
    const { api } = resumed(sessionWith(craft(GIN_HAND, JUNK_HAND, YOU, 'discard')));
    expect(tap(() => api().knock(TWO_OF_CLUBS))).toBe(true);
    await settle();

    expect(api().session!.status).toBe('won');
    expect(api().session!.scores[YOU]).toBeGreaterThanOrEqual(MATCH_TARGET);
    expect(api().lastResult).toEqual({
      status: 'won',
      mine: api().session!.scores[YOU],
      theirs: api().session!.scores[CPU],
    });
    expect(api().canDealNextHand).toBe(false);
    expect(api().canResume).toBe(false);

    // A finished match is not one to come back to.
    expect(deviceStore.has(gameSchema.key)).toBe(false);
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({ played: 0, wins: 1, losses: 0 });
    // The question counts matches won, and this counted once
    // (docs/REVIEW_PROMPT_POLICY.md).
    expect(recordGameCompleted).toHaveBeenCalledTimes(1);
  });

  it('books the loss and asks nothing', async () => {
    // Ninety-five to the CPU already; the undercut takes it past a hundred.
    const { api } = resumed(
      sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard'), [0, MATCH_TARGET - 5]),
    );
    expect(tap(() => api().knock(TWO_OF_CLUBS))).toBe(true);
    await settle();

    expect(api().session!.status).toBe('lost');
    expect(api().lastResult!.status).toBe('lost');
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({ played: 0, wins: 0, losses: 1 });
    expect(recordGameCompleted).not.toHaveBeenCalled();
    expect(deviceStore.has(gameSchema.key)).toBe(false);
  });

  it('counts a match as played when it is dealt, and never twice', async () => {
    const { api } = mount(null);
    act(() => api().startNewGame('hard'));
    await settle();
    expect(stored<Stats>(statsSchema.key)!.hard).toEqual({ played: 1, wins: 0, losses: 0 });

    // Abandoned for another: played twice, lost never.
    act(() => api().startNewGame('hard'));
    await settle();
    expect(stored<Stats>(statsSchema.key)!.hard).toEqual({ played: 2, wins: 0, losses: 0 });
  });
});

// ---------- the play clock ----------

describe('the play clock', () => {
  const playersTurn = () => sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard'));

  it('does not run while the app is in the background', async () => {
    const { api } = resumed(playersTurn());

    await advance(3000);
    // The OS hides the app — the last event a killed process is given.
    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(api().session!.elapsedSeconds).toBe(3);

    // Eight seconds in the background buy nothing.
    await advance(8000);
    visibility = 'visible';
    await advance(2000);

    act(() => api().goHome());
    await settle();
    expect(api().session!.elapsedSeconds).toBe(5);
    expect(stored<Stats>(statsSchema.key)!.totalPlaySeconds).toBe(5);
  });

  it('stops when the game screen does', async () => {
    const { api } = resumed(playersTurn());
    await advance(2000);
    act(() => api().goHome());
    await settle();

    await advance(9000);
    act(() => api().resumeGame());
    await advance(1000);
    act(() => api().goHome());
    await settle();
    expect(api().session!.elapsedSeconds).toBe(3);
  });

  it('books every second exactly once, across a save and an ending', async () => {
    // The gin hand, so the knock takes the match: play seconds are booked
    // again when the match ends, and the two bookings must not overlap.
    const { api } = resumed(sessionWith(craft(GIN_HAND, JUNK_HAND, YOU, 'discard')));
    await advance(4000);
    act(() => api().goHome());
    await settle();
    expect(stored<Stats>(statsSchema.key)!.totalPlaySeconds).toBe(4);

    act(() => api().resumeGame());
    await advance(2000);
    expect(tap(() => api().knock(TWO_OF_CLUBS))).toBe(true);
    await settle();
    expect(api().session!.status).toBe('won');
    expect(stored<Stats>(statsSchema.key)!.totalPlaySeconds).toBe(6);
  });
});

// ---------- the opponent preference ----------

describe('the opponent for next time', () => {
  it('is remembered, and never changes the match in play', async () => {
    const { api } = resumed(sessionWith(craft(LIMIT_HAND, TIGHT_HAND, YOU, 'discard')), {
      schemaVersion: 1,
      difficulty: 'easy',
    });
    expect(api().difficulty).toBe('easy');

    act(() => api().setDifficulty('hard'));
    await settle();
    expect(api().difficulty).toBe('hard');
    expect(stored<Prefs>('gr.prefs')!.difficulty).toBe('hard');
    // The match on screen keeps the opponent it was dealt against.
    expect(api().session!.difficulty).toBe('normal');
  });

  it('follows the opponent a new match is actually dealt against', async () => {
    const { api } = mount(null);
    act(() => api().startNewGame('easy'));
    await settle();
    expect(api().difficulty).toBe('easy');
    expect(stored<Prefs>('gr.prefs')!.difficulty).toBe('easy');
    expect(api().session!.difficulty).toBe('easy');
  });
});
