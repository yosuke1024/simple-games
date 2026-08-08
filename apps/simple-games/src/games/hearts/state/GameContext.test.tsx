/**
 * The context's two jobs that only React can get wrong: the chain of beats, and
 * the play clock.
 *
 * The chain is what makes this title different from the four CPU games before
 * it. There, one move was answered by one move; here a card put down is
 * followed by three replies and the trick folding away, and if a CPU seat took
 * that trick the chain runs straight on into the next one. It is still one
 * armed timeout, re-armed by an effect that depends on the session
 * (docs/GAME_LIFECYCLE.md「CPU 探索」), and the tests below pin what that single
 * mechanism has to cover: the beats arriving one at a time rather than all at
 * once; the pass, where three seats settle while the player is still choosing;
 * a settled hand, where the chain deliberately stops and waits to be tapped; a
 * match restored mid-chain, which needs no path of its own; and leaving,
 * unmounting or dealing a new match under it.
 *
 * The clock is a ref rather than state (battery), so it is observed the way the
 * app observes it: through the session that a save or a navigation leaves
 * behind. Time spent in the background is not play time.
 *
 * The positions here are **played into existence** rather than crafted. A
 * Hearts position is only valid if every card in it could have been played
 * (game/engine.ts replays them all), so hand-writing one is both awkward and a
 * good way to prove something about a game nobody can play. A scripted player
 * reading the same view a CPU seat gets takes the table wherever a test needs
 * it, and the scores are then set to whatever the case is about — the score is
 * the one part of a match that carries no history with it.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCpuStep,
  canCollectTrick,
  canDealNextHand,
  chooseCpuAction,
  createSession,
  cpuViewOf,
  doCollectTrick,
  doConfirmPass,
  doNextHand,
  doPlayCard,
  doSelectPassCard,
  isCpuTurn,
  MATCH_TARGET,
  PASS_SIZE,
  restoreSession,
  seatToPlay,
  SEATS,
  TRICKS_PER_HAND,
  YOU,
  type BySeat,
  type HeartsSession,
  type Seat,
} from '../game';
import { saveGame } from '../storage/gamePersistence';
import { gameSchema, statsSchema, type Prefs, type Stats } from '../storage/schemas';
import { CPU_DELAY_MS, HeartsProvider, useHearts, type HeartsContextValue } from './GameContext';

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

// ---------- positions, played into existence ----------

/** One beat by whoever is due one, with the player's seat played by the easy opponent. */
function step(session: HeartsSession): HeartsSession {
  if (canDealNextHand(session)) return doNextHand(session)!;
  if (canCollectTrick(session)) return doCollectTrick(session)!.session;
  if (isCpuTurn(session)) return applyCpuStep(session)!.session;

  const action = chooseCpuAction({ ...cpuViewOf(session, YOU), difficulty: 'easy' }, 0.5)!;
  if (action.kind === 'pass') {
    const chosen = action.cards.reduce<HeartsSession>(
      (state, card) => doSelectPassCard(state, card)!,
      session,
    );
    return doConfirmPass(chosen)!.session;
  }
  return doPlayCard(session, action.card)!.session;
}

const STEP_LIMIT = 20_000;

function playUntil(seed: string, reached: (session: HeartsSession) => boolean): HeartsSession {
  let session = createSession('normal', seed);
  for (let taken = 0; taken < STEP_LIMIT && !reached(session); taken++) session = step(session);
  if (!reached(session)) throw new Error(`never reached the position asked for (${seed})`);
  return session;
}

/** The player, on lead, with a card to put down. */
const playersLead = (seed = 'hearts-ctx-lead'): HeartsSession =>
  playUntil(
    seed,
    (s) => s.hand.phase === 'playing' && s.hand.played.length === 0 && s.hand.leader === YOU,
  );

/** The player, to play, whatever the trick already holds. */
const playersTurn = (seed = 'hearts-ctx-turn'): HeartsSession =>
  playUntil(seed, (s) => s.hand.phase === 'playing' && seatToPlay(s.hand) === YOU);

/** Four cards lying finished on the table, nobody having taken them in. */
const trickWaiting = (seed = 'hearts-ctx-collect'): HeartsSession =>
  playUntil(seed, canCollectTrick);

/** The last trick complete: one collect away from a settled hand. */
const lastCollect = (seed: string): HeartsSession =>
  playUntil(seed, (s) => canCollectTrick(s) && s.hand.tricks.length === TRICKS_PER_HAND - 1);

/** The player on lead for the thirteenth trick — every seat holding one card. */
const lastLead = (seed: string): HeartsSession =>
  playUntil(
    seed,
    (s) =>
      s.hand.tricks.length === TRICKS_PER_HAND - 1 &&
      s.hand.played.length === 0 &&
      s.hand.leader === YOU,
  );

/** What the hand on the table will cost, played out from here. */
function deltaOf(brink: HeartsSession): BySeat<number> {
  let done = brink;
  for (let taken = 0; taken < 64 && done.hand.phase !== 'over'; taken++) done = step(done);
  return done.lastHand!.delta;
}

/**
 * The same position, with the four scores set so that finishing this hand ends
 * the match the way asked for. One seat is put on the target exactly; a seat
 * that took nothing this hand could not be the one to cross it, so the crosser
 * is chosen from the seats that did.
 *
 * Won: the player alone on the lowest score. Lost: another seat alone on it.
 * Drawn: the player level with one other, and nobody below them.
 */
function endingIn(brink: HeartsSession, verdict: 'won' | 'lost' | 'draw'): HeartsSession {
  const delta = deltaOf(brink);
  const crosser = SEATS.find((seat) => seat !== YOU && delta[seat] > 0)!;
  const [first, second] = SEATS.filter((seat) => seat !== YOU && seat !== crosser) as [Seat, Seat];

  const finals: number[] = [];
  finals[crosser] = MATCH_TARGET;
  finals[YOU] = verdict === 'lost' ? 60 : 30;
  finals[first] = verdict === 'won' ? 60 : 30;
  finals[second] = 60;

  const scores = SEATS.map((seat) => finals[seat]! - delta[seat]);
  const session = restoreSession({
    ...brink,
    scores: [scores[0]!, scores[1]!, scores[2]!, scores[3]!],
  });
  // The position has to still be a match in progress, or the case proves
  // nothing about ending one.
  if (session.status !== 'playing') throw new Error('the match was over before it started');
  return session;
}

// ---------- mounting ----------

interface Mounted {
  api: () => HeartsContextValue;
  unmount: () => void;
}

function mount(
  initialSession: HeartsSession | null,
  initialPrefs: Prefs = { schemaVersion: 1, difficulty: 'normal' },
): Mounted {
  let value!: HeartsContextValue;
  function Probe() {
    value = useHearts();
    return null;
  }
  const { unmount } = render(
    <HeartsProvider
      initialStats={statsSchema.defaultValue()}
      initialFlags={{ schemaVersion: 1, tutorialCompleted: true }}
      initialPrefs={initialPrefs}
      initialSession={initialSession}
      onExit={vi.fn()}
    >
      <Probe />
    </HeartsProvider>,
  );
  return { api: () => value, unmount };
}

/** Mounts a match and brings it on screen, the way a resume does. */
function resumed(session: HeartsSession, prefs?: Prefs): Mounted {
  const mounted = mount(session, prefs);
  act(() => mounted.api().resumeGame());
  return mounted;
}

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/**
 * Lets the chain run for up to `beats` beats. One `act` per beat, because that
 * is what a beat is: a timer lands, React re-renders, and the effect decides
 * whether to arm another. Winding the clock forward in one jump would test the
 * timers without ever letting React answer them.
 */
const advanceBeats = async (beats: number) => {
  for (let beat = 0; beat < beats; beat++) await advance(CPU_DELAY_MS);
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

// ---------- the chain ----------

describe('one card, and the table answers in beats', () => {
  it('takes the three replies and the fold one at a time, a beat apart', async () => {
    const { api } = resumed(playersLead());
    const before = api().session!.moveCount;
    const tricksBefore = api().session!.hand.tricks.length;

    expect(tap(() => api().playCard(api().playable[0]!))).toBe(true);
    expect(api().session!.hand.played).toHaveLength(1);
    expect(api().session!.moveCount).toBe(before + 1);

    // Nothing moves until the whole beat is up.
    await advance(CPU_DELAY_MS - 1);
    expect(api().session!.moveCount).toBe(before + 1);

    // Then the three other seats, in the order they sit.
    for (const seat of [1, 2, 3] as const) {
      await advance(seat === 1 ? 1 : CPU_DELAY_MS);
      expect(api().lastEvent!.event.kind).toBe('play');
      expect(api().lastEvent!.event).toMatchObject({ seat });
      expect(api().session!.hand.played).toHaveLength(seat + 1);
    }
    expect(api().session!.moveCount).toBe(before + 4);
    // The four cards sit face up: taking them in is the table's own beat.
    expect(api().session!.hand.tricks).toHaveLength(tricksBefore);

    await advance(CPU_DELAY_MS);
    expect(api().lastEvent!.event.kind).toBe('collect');
    expect(api().session!.hand.tricks).toHaveLength(tricksBefore + 1);
    expect(api().session!.hand.played).toHaveLength(0);
    expect(api().session!.moveCount).toBe(before + 5);
  });

  it('gives every beat its own identity, so nothing replays', async () => {
    const { api } = resumed(playersLead('hearts-ctx-identity'));
    const seen: number[] = [];
    tap(() => api().playCard(api().playable[0]!));
    seen.push(api().lastEvent!.moveCount);
    for (let beat = 0; beat < 4; beat++) {
      await advance(CPU_DELAY_MS);
      seen.push(api().lastEvent!.moveCount);
    }
    // Five beats, five serial numbers, each one more than the last.
    expect(seen).toEqual([seen[0], seen[0]! + 1, seen[0]! + 2, seen[0]! + 3, seen[0]! + 4]);
  });

  it('runs on until the table needs the player again, and then stops', async () => {
    // The seat that takes a trick leads the next one, so a chain that started
    // with one card can carry on for several tricks. It is still one timer.
    const { api } = resumed(playersLead('hearts-ctx-chain'));
    const before = api().session!.moveCount;
    tap(() => api().playCard(api().playable[0]!));

    await advanceBeats(60);
    const settled = api().session!;
    expect(settled.moveCount).toBeGreaterThan(before + 4);
    // Whatever it stopped on is something only the player can do.
    expect(seatToPlay(settled.hand) === YOU || canDealNextHand(settled)).toBe(true);

    await advanceBeats(10);
    expect(api().session).toBe(settled);
  });

  it('takes in a trick that was already finished when the match arrived', async () => {
    // Restored onto four cards nobody has folded away yet. No path of its own:
    // the effect looks at the session it is given.
    const waiting = trickWaiting();
    const { api } = resumed(waiting);
    await advance(CPU_DELAY_MS);
    expect(api().lastEvent!.event.kind).toBe('collect');
    expect(api().session!.hand.tricks).toHaveLength(waiting.hand.tricks.length + 1);
  });

  it('picks up a match restored on a CPU seat’s turn, with no path of its own', async () => {
    const waiting = playUntil(
      'hearts-ctx-restore',
      (s) => s.hand.phase === 'playing' && isCpuTurn(s),
    );
    const { api } = mount(waiting);

    // Nothing happens while the match is only *loaded* — the game screen is
    // not showing it yet.
    await advanceBeats(3);
    expect(api().session!.moveCount).toBe(waiting.moveCount);

    act(() => api().resumeGame());
    await advance(CPU_DELAY_MS);
    expect(api().session!.moveCount).toBe(waiting.moveCount + 1);
  });
});

describe('the chain is disarmed by everything that should disarm it', () => {
  it('stops when the game screen does', async () => {
    const { api } = resumed(trickWaiting('hearts-ctx-disarm-home'));
    act(() => api().goHome());
    const before = api().session!.moveCount;
    await advanceBeats(8);
    expect(api().session!.moveCount).toBe(before);
  });

  it('stops on unmount, mid-beat', async () => {
    const { api, unmount } = resumed(trickWaiting('hearts-ctx-disarm-unmount'));
    await advance(CPU_DELAY_MS - 100);
    const onDisk = deviceStore.get(gameSchema.key);

    unmount();
    await advanceBeats(8);

    // No beat landed after the tree went away — the record is where it was,
    // and nothing tried to set state on a component that no longer exists.
    expect(deviceStore.get(gameSchema.key)).toBe(onDisk);
    expect(() => api()).not.toThrow();
  });

  it('stops when a new match is dealt under it', async () => {
    const { api } = resumed(trickWaiting('hearts-ctx-disarm-new'));
    await advance(CPU_DELAY_MS - 100);

    act(() => api().startNewGame('easy'));
    const dealt = api().session!;
    expect(dealt.difficulty).toBe('easy');
    expect(dealt.handNumber).toBe(1);

    // The beat armed against the old session lands into nothing: the new match
    // is where it was dealt, not one beat into somebody else's hand.
    await advance(100);
    expect(api().session!.seed).toBe(dealt.seed);
    expect(api().session!.moveCount).toBe(0);
  });
});

// ---------- the pass ----------

describe('the pass, three seats at a time', () => {
  it('lets the CPU seats settle while the player is still choosing', async () => {
    const { api } = resumed(createSession('normal', 'hearts-ctx-pass'));
    expect(api().session!.hand.phase).toBe('passing');

    for (const seat of [1, 2, 3] as const) {
      await advance(CPU_DELAY_MS);
      expect(api().lastEvent!.event).toEqual({ kind: 'pass', seat });
      expect(api().session!.hand.confirmed[seat]).toBe(true);
      // Nothing has changed hands: the exchange waits for all four.
      expect(api().lastEvent!.exchange).toBeNull();
    }

    // And then it waits. The fourth confirmation is the player's to give.
    const waiting = api().session!;
    await advanceBeats(6);
    expect(api().session).toBe(waiting);
    expect(api().session!.hand.phase).toBe('passing');
  });

  it('stages three cards without spending a beat, and commits them as one', async () => {
    const { api } = resumed(createSession('normal', 'hearts-ctx-stage'));
    await advanceBeats(3);
    const waiting = api().session!;
    const mine = waiting.hand.hands[YOU];

    expect(tap(() => api().selectPassCard(mine[0]!))).toBe(true);
    // Picking a card up is staging, not a move: no beat, and nothing for the
    // screen to animate — the last thing that happened is still seat three's.
    expect(api().session!.moveCount).toBe(waiting.moveCount);
    expect(api().lastEvent!.event).toEqual({ kind: 'pass', seat: 3 });
    expect(api().canConfirmPass).toBe(false);
    expect(tap(() => api().confirmPass())).toBe(false);

    tap(() => api().selectPassCard(mine[1]!));
    tap(() => api().selectPassCard(mine[2]!));
    expect(api().canConfirmPass).toBe(true);
    // Four is not a pass, and neither is two.
    expect(tap(() => api().selectPassCard(mine[3]!))).toBe(false);
    expect(tap(() => api().unselectPassCard(mine[0]!))).toBe(true);
    expect(api().canConfirmPass).toBe(false);
    tap(() => api().selectPassCard(mine[0]!));

    expect(tap(() => api().confirmPass())).toBe(true);
    expect(api().session!.moveCount).toBe(waiting.moveCount + 1);
    // The fourth confirmation moves all twelve cards at once, and that is the
    // only moment the exchange exists.
    const { exchange } = api().lastEvent!;
    expect(exchange).not.toBeNull();
    for (const seat of SEATS) expect(exchange!.received[seat]).toHaveLength(PASS_SIZE);
    expect(api().session!.hand.phase).toBe('playing');
    await settle();
  });

  it('keeps a card picked out on disk, so a kill mid-choice loses nothing', async () => {
    const { api } = resumed(createSession('normal', 'hearts-ctx-staged-save'));
    const mine = api().session!.hand.hands[YOU];
    tap(() => api().selectPassCard(mine[0]!));
    await settle();
    expect(stored<{ hand: string }>(gameSchema.key)).not.toBeNull();
    expect(api().session!.hand.selected[YOU]).toEqual([mine[0]]);
  });
});

// ---------- the player's own beats ----------

describe('the player’s beats', () => {
  it('are refused, silently, when they are not legal', async () => {
    const { api } = resumed(playersTurn('hearts-ctx-illegal'));
    const before = api().session!.moveCount;
    const held = api().session!.hand.hands[YOU];
    const sunk = held.filter((card) => !api().playable.includes(card));
    expect(api().playable.length).toBeGreaterThan(0);

    for (const card of sunk) expect(tap(() => api().playCard(card))).toBe(false);
    // The pass is long over; there is nothing to pick out.
    expect(tap(() => api().selectPassCard(held[0]!))).toBe(false);
    expect(tap(() => api().confirmPass())).toBe(false);
    expect(tap(() => api().dealNextHand())).toBe(false);
    expect(api().session!.moveCount).toBe(before);
    await settle();
  });

  it('offer exactly the cards the rules allow, and no help beyond that', async () => {
    const { api } = resumed(playersTurn('hearts-ctx-playable'));
    const held = api().session!.hand.hands[YOU];
    const legal = [...api().playable];
    expect(legal.length).toBeGreaterThan(0);
    expect(legal.every((card) => held.includes(card))).toBe(true);

    // The list is the whole of the help: it says which cards the rules allow,
    // never which one is good. Everything it leaves out is simply refused.
    for (const card of held) {
      if (!legal.includes(card)) expect(tap(() => api().playCard(card))).toBe(false);
    }
    expect(api().session!.hand.hands[YOU]).toEqual(held);

    expect(tap(() => api().playCard(legal[0]!))).toBe(true);
    // And it empties the moment the turn passes on.
    expect(api().playable).toEqual([]);
    await settle();
  });

  it('are not takeable back — there is no undo in the API', () => {
    const { api } = resumed(playersTurn('hearts-ctx-undo'));
    // Not an oversight: seeing three replies and then taking the card back
    // would hand back a card you now know was safe (game/session.ts).
    expect(Object.keys(api()).some((name) => /undo/i.test(name))).toBe(false);
  });
});

// ---------- the settled hand ----------

describe('a hand that settles', () => {
  it('waits on screen for the next deal, with the scores already moved', async () => {
    const over = playUntil('hearts-ctx-settled', (s) => s.hand.phase === 'over');
    const { api } = resumed(over);

    expect(api().handResult).not.toBeNull();
    expect(api().canDealNextHand).toBe(true);
    expect(api().lastResult).toBeNull();
    expect(api().session!.scores.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);

    // Nothing deals it for you: the hand's score is the one thing here worth
    // reading, and the chain stops in front of it.
    await advanceBeats(8);
    expect(api().session!.handNumber).toBe(over.handNumber);

    expect(tap(() => api().dealNextHand())).toBe(true);
    expect(api().session!.handNumber).toBe(over.handNumber + 1);
    expect(api().handResult).toBeNull();
    expect(api().lastEvent).toBeNull();
    expect(api().session!.scores).toEqual(over.scores);
    await settle();
  });

  it('has nothing to deal while the hand is still being played', async () => {
    const { api } = resumed(playersTurn('hearts-ctx-mid'));
    expect(api().canDealNextHand).toBe(false);
    expect(api().handResult).toBeNull();
    expect(tap(() => api().dealNextHand())).toBe(false);
    await settle();
  });
});

// ---------- the match ----------

describe('a match that ends', () => {
  /** Saves the match first, so emptying the slot is something to observe. */
  const suspended = async (session: HeartsSession) => {
    await act(async () => {
      await saveGame(session);
    });
    expect(deviceStore.has(gameSchema.key)).toBe(true);
    return resumed(session);
  };

  it('books the win, clears the slot, and asks the review question once', async () => {
    const { api } = await suspended(endingIn(lastCollect('hearts-ctx-won'), 'won'));
    await advance(CPU_DELAY_MS);
    await settle();

    expect(api().session!.status).toBe('won');
    expect(api().lastResult).toEqual({ status: 'won', scores: api().session!.scores });
    expect(Math.max(...api().session!.scores)).toBeGreaterThanOrEqual(MATCH_TARGET);
    expect(api().canDealNextHand).toBe(false);
    expect(api().canResume).toBe(false);

    // A finished match is not one to come back to.
    expect(deviceStore.has(gameSchema.key)).toBe(false);
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({
      played: 0,
      wins: 1,
      losses: 0,
      draws: 0,
    });
    // The question counts matches won, and this counted once
    // (docs/REVIEW_PROMPT_POLICY.md).
    expect(recordGameCompleted).toHaveBeenCalledTimes(1);
  });

  it('books the loss and asks nothing', async () => {
    const { api } = await suspended(endingIn(lastCollect('hearts-ctx-lost'), 'lost'));
    await advance(CPU_DELAY_MS);
    await settle();

    expect(api().session!.status).toBe('lost');
    expect(api().lastResult!.status).toBe('lost');
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({
      played: 0,
      wins: 0,
      losses: 1,
      draws: 0,
    });
    expect(recordGameCompleted).not.toHaveBeenCalled();
    expect(deviceStore.has(gameSchema.key)).toBe(false);
  });

  it('books a draw when the player shares the lowest score, and asks nothing', async () => {
    // Four seats make a tie for lowest ordinary rather than exotic. It is
    // neither a win to celebrate nor a loss to book — so it is its own column.
    const { api } = await suspended(endingIn(lastCollect('hearts-ctx-draw'), 'draw'));
    await advance(CPU_DELAY_MS);
    await settle();

    expect(api().session!.status).toBe('draw');
    expect(api().lastResult!.status).toBe('draw');
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({
      played: 0,
      wins: 0,
      losses: 0,
      draws: 1,
    });
    expect(recordGameCompleted).not.toHaveBeenCalled();
  });

  it('counts a match as played when it is dealt, and never twice', async () => {
    const { api } = mount(null);
    act(() => api().startNewGame('hard'));
    await settle();
    expect(stored<Stats>(statsSchema.key)!.hard).toMatchObject({ played: 1, wins: 0, losses: 0 });

    // Abandoned for another: played twice, lost never.
    act(() => api().startNewGame('hard'));
    await settle();
    expect(stored<Stats>(statsSchema.key)!.hard).toEqual({
      played: 2,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  });
});

// ---------- the play clock ----------

describe('the play clock', () => {
  it('does not run while the app is in the background', async () => {
    const { api } = resumed(playersTurn('hearts-ctx-clock-bg'));

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
    const { api } = resumed(playersTurn('hearts-ctx-clock-screen'));
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
    // The player leads the last trick, so the clock is idle until they tap and
    // the four beats that finish the match are theirs to start.
    const { api } = resumed(endingIn(lastLead('hearts-ctx-clock-end'), 'won'));
    await advance(4000);
    act(() => api().goHome());
    await settle();
    expect(stored<Stats>(statsSchema.key)!.totalPlaySeconds).toBe(4);

    act(() => api().resumeGame());
    await advance(2000);
    tap(() => api().playCard(api().playable[0]!));
    // Three replies and the fold: 1800ms, which crosses one more second.
    await advanceBeats(4);
    await settle();

    expect(api().session!.status).toBe('won');
    // Four before the break and three after — booked once each, not twice.
    expect(stored<Stats>(statsSchema.key)!.totalPlaySeconds).toBe(7);
  });
});

// ---------- the opponents for next time ----------

describe('the opponents for next time', () => {
  it('are remembered, and never change the match in play', async () => {
    const { api } = resumed(playersTurn('hearts-ctx-prefs'), {
      schemaVersion: 1,
      difficulty: 'easy',
    });
    expect(api().difficulty).toBe('easy');

    act(() => api().setDifficulty('hard'));
    await settle();
    expect(api().difficulty).toBe('hard');
    expect(stored<Prefs>('ht.prefs')!.difficulty).toBe('hard');
    // The match on screen keeps the strength it was dealt against.
    expect(api().session!.difficulty).toBe('normal');
  });

  it('follow the strength a new match is actually dealt against', async () => {
    const { api } = mount(null);
    act(() => api().startNewGame('easy'));
    await settle();
    expect(api().difficulty).toBe('easy');
    expect(stored<Prefs>('ht.prefs')!.difficulty).toBe('easy');
    expect(api().session!.difficulty).toBe('easy');
  });
});
