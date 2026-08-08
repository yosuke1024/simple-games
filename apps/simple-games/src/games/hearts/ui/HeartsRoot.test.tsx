/**
 * The screens, against the real state layer: what a player sees, taps, and
 * hears back.
 *
 * Two things here are this title's own. The first is that the table answers in
 * **beats** — one card of yours is followed by three replies and the trick
 * being folded away, each 450ms apart — so the clock is faked and wound
 * forward one beat at a time (`advanceBeats`). Winding it in one jump would
 * test the timers without ever letting React answer them, and the next timer
 * would never be armed; the state layer's own tests learned that first
 * (state/GameContext.test.tsx).
 *
 * The second is that the positions are **played into existence** rather than
 * crafted. A Hearts position is only valid if every card in it could have been
 * played (game/engine.ts replays them all), so hand-writing one is both
 * awkward and a good way to prove something about a game nobody can play. A
 * scripted player takes the table to where a test needs it, and the scores are
 * then set to whatever the case is about — the score is the one part of a
 * match that carries no history with it.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  applyCpuStep,
  canCollectTrick,
  canDealNextHand,
  chooseCpuAction,
  createSession,
  cpuSeatToAct,
  cpuViewOf,
  doCollectTrick,
  doConfirmPass,
  doNextHand,
  doPlayCard,
  doSelectPassCard,
  isCpuTurn,
  MATCH_TARGET,
  pendingTrick,
  playableCards,
  restoreSession,
  seatToPlay,
  SEATS,
  TRICKS_PER_HAND,
  TWO_OF_CLUBS,
  YOU,
  type BySeat,
  type Card,
  type HeartsSession,
  type Seat,
} from '../game';
import { CPU_DELAY_MS } from '../state/GameContext';
import { toPersisted } from '../storage/gamePersistence';
import { HT_STORAGE_KEYS, type Stats } from '../storage/schemas';
import { HeartsRoot } from './HeartsRoot';

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

function playUntil(seed: string, reached: (session: HeartsSession) => boolean): HeartsSession {
  let session = createSession('normal', seed);
  for (let taken = 0; taken < 20_000 && !reached(session); taken++) session = step(session);
  if (!reached(session)) throw new Error(`never reached the position asked for (${seed})`);
  return session;
}

/** The player, on lead, with a card to put down. */
const playersLead = (seed: string): HeartsSession =>
  playUntil(
    seed,
    (s) => s.hand.phase === 'playing' && s.hand.played.length === 0 && s.hand.leader === YOU,
  );

/** The player, to play, with the rules refusing some of what they hold. */
const mustFollow = (seed: string): HeartsSession =>
  playUntil(
    seed,
    (s) =>
      s.hand.phase === 'playing' &&
      s.hand.played.length > 0 &&
      seatToPlay(s.hand) === YOU &&
      playableCards(s).length < s.hand.hands[YOU].length,
  );

/** The last trick complete: one beat away from a settled hand. */
const lastCollect = (seed: string): HeartsSession =>
  playUntil(seed, (s) => canCollectTrick(s) && s.hand.tricks.length === TRICKS_PER_HAND - 1);

/** What the hand on the table will cost, played out from here. */
function deltaOf(brink: HeartsSession): BySeat<number> {
  let done = brink;
  for (let taken = 0; taken < 64 && done.hand.phase !== 'over'; taken++) done = step(done);
  return done.lastHand!.delta;
}

/**
 * The same position, with the four scores set so that finishing this hand ends
 * the match the way asked for — the same construction the state layer's tests
 * use, and for the same reason: the verdict is a fact about the scores, and
 * the scores are the one part of a match that carries no history with it.
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
  if (session.status !== 'playing') throw new Error('the match was over before it started');
  return session;
}

/**
 * The seed the pass case is built on. Its three CPU seats commit, the player
 * passes their three lowest cards, and the two of clubs lands on the player —
 * which is what makes the assertion afterwards a single unbranching one: the
 * hand opens with that card and with nothing else.
 */
const PASS_SEED = 'hearts-ui-pass-4';

/** The three CPU seats commit, then the player passes the three lowest cards. */
function passLowestThree(session: HeartsSession): HeartsSession {
  let after = session;
  while (after.hand.phase === 'passing' && cpuSeatToAct(after) !== null) {
    after = applyCpuStep(after)!.session;
  }
  const three = after.hand.hands[YOU].slice(0, 3);
  for (const card of three) after = doSelectPassCard(after, card)!;
  return doConfirmPass(after)!.session;
}

// ---------- mounting ----------

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <HeartsRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <HeartsRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

const tutorialDone = {
  [HT_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const saved = (session: HeartsSession) => ({
  ...tutorialDone,
  [HT_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
});

const table = () => screen.getByRole('group', { name: 'Hearts table' });
const trick = () => screen.getByRole('group', { name: 'The trick' });
const hand = () => screen.getByRole('group', { name: 'Your hand' });
const tray = () => screen.getByRole('group', { name: 'Cards you are passing' });
const line = () => screen.getByRole('status');

/** The cards the fan is offering — everything else in it is sunk. */
const liveCards = (): HTMLElement[] =>
  within(hand())
    .getAllByRole('button')
    .filter((card) => !(card as HTMLButtonElement).disabled);

/** One tap on a card, wherever it is drawn. */
function tapCard(within_: HTMLElement, card: Card) {
  const target = within_.querySelector(`[data-card="${card}"]`);
  if (target === null) throw new Error(`no card ${card} on screen`);
  fireEvent.click(target);
}

/** The two-tap confirm: lift, then commit. */
function playCard(card: Card) {
  tapCard(hand(), card);
  tapCard(hand(), card);
}

/** Lets the local reads and the saves they trigger resolve (promises, not timers). */
const settle = () => act(async () => undefined);

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/**
 * Lets the table run for `beats` beats. One `act` per beat, because that is
 * what a beat is: a timer lands, React re-renders, and the effect decides
 * whether to arm another. Winding the clock forward in one jump would test the
 * timers without ever letting React answer them.
 */
const advanceBeats = async (beats: number) => {
  for (let beat = 0; beat < beats; beat++) await advance(CPU_DELAY_MS);
};

/** Opens a saved match from the home screen — always dealt against Normal. */
function resume() {
  fireEvent.click(screen.getByRole('button', { name: /Normal/ }));
}

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
  const raw = deviceStore.get(HT_STORAGE_KEYS.stats);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as Stats).totalPlaySeconds;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  deviceStore.clear();
});

// ---------- the first launch ----------

describe('first run', () => {
  it('shows Quick Rules and deals a hand right after', async () => {
    renderGame();
    await settle();

    expect(screen.getByText('Pass three')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Follow the suit')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Fewest points wins')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Thirteen cards each, and the pass going the way the first hand's number
    // says it goes.
    expect(within(hand()).getAllByRole('button')).toHaveLength(13);
    expect(hand().querySelectorAll('.ht-hand-row')).toHaveLength(3);
    expect(screen.getByText('Passing left')).toBeInTheDocument();
    for (const seat of [1, 2, 3]) {
      expect(
        within(table()).getByRole('group', { name: new RegExp(`CPU ${seat}: 13 cards`) }),
      ).toBeInTheDocument();
    }
    await settle();
  });

  it('does not show Quick Rules again once it is done', async () => {
    renderGame(tutorialDone);
    await settle();

    expect(screen.getByRole('button', { name: /Easy/ })).toBeInTheDocument();
    expect(screen.queryByText('Pass three')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Playing' })).not.toBeInTheDocument();
  });
});

// ---------- the table ----------

describe('the table', () => {
  it('shows no clock and no undo', async () => {
    renderGame(saved(playersLead('hearts-ui-lead')));
    await settle();
    resume();

    // Nothing on screen is formatted as a running time (the rules, §8 and §11.2).
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    // And there is no take-back: watching three replies and then handing the
    // card back is a leak no undo can undo (game/session.ts).
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    await settle();
  });

  it('sinks every card the rules will not take, and says so', async () => {
    const session = mustFollow('hearts-ui-follow-0');
    renderGame(saved(session));
    await settle();
    resume();

    // The whole of this game's help: the cards the rules allow are the ones a
    // tap can reach, and the rest are sunk rather than scolded.
    const allowed = playableCards(session);
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.length).toBeLessThan(session.hand.hands[YOU].length);
    expect(liveCards()).toHaveLength(allowed.length);
    expect(liveCards().map((card) => Number(card.getAttribute('data-card')))).toEqual(allowed);

    // Sunk is spoken as well as drawn — a screen reader hears the rule too.
    const refused = within(hand()).getAllByRole('button', { name: /not allowed now/ });
    expect(refused).toHaveLength(session.hand.hands[YOU].length - allowed.length);

    // And a tap on one of them is nothing, silently: no card leaves the hand.
    tapCard(hand(), Number(refused[0]!.getAttribute('data-card')));
    expect(within(hand()).getAllByRole('button')).toHaveLength(session.hand.hands[YOU].length);
    await settle();
  });
});

// ---------- the pass ----------

describe('the pass', () => {
  it('takes three cards, waits for the other seats, and opens on the two of clubs', async () => {
    const session = createSession('normal', PASS_SEED);
    const three = session.hand.hands[YOU].slice(0, 3);
    // The case rests on where the two of clubs lands, so the position it rests
    // on is checked rather than assumed.
    expect(passLowestThree(session).hand.leader).toBe(YOU);

    renderGame(saved(session));
    await settle();
    resume();

    // Two taps a card: the first lifts it, the second puts it on the tray.
    for (const card of three) {
      tapCard(hand(), card);
      expect(within(tray()).queryAllByRole('button')).toHaveLength(three.indexOf(card));
      tapCard(hand(), card);
    }
    expect(within(tray()).getAllByRole('button')).toHaveLength(3);
    // Ten cards left in the fan, and the fan re-flows onto two rows for them.
    expect(within(hand()).getAllByRole('button')).toHaveLength(10);
    expect(hand().querySelectorAll('.ht-hand-row')).toHaveLength(2);

    // A fourth cannot go on: the way to change your mind is to take one back.
    expect(liveCards()).toHaveLength(0);
    tapCard(tray(), three[0]!);
    expect(within(tray()).getAllByRole('button')).toHaveLength(2);
    tapCard(hand(), three[0]!);
    tapCard(hand(), three[0]!);

    fireEvent.click(screen.getByRole('button', { name: 'Pass these three' }));
    // Committed, and nothing has changed hands: the exchange waits for four.
    expect(line()).toHaveTextContent('Waiting for the other seats…');
    expect(screen.getByRole('button', { name: 'Pass these three' })).toBeDisabled();

    // The three CPU seats commit, a beat apart, and the fourth resolves it.
    await advanceBeats(3);
    expect(screen.queryByRole('group', { name: 'Cards you are passing' })).not.toBeInTheDocument();
    expect(within(hand()).getAllByRole('button')).toHaveLength(13);

    // The hand opens on the two of clubs and on nothing else — the one card
    // the rules allow, and the reason every other one is sunk.
    const live = liveCards();
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveAttribute('data-card', String(TWO_OF_CLUBS));
    await settle();
  });
});

// ---------- one card, and the table answers ----------

describe('a trick', () => {
  it('takes the three replies and the fold one beat at a time', async () => {
    const session = playersLead('hearts-ui-lead');
    const led = playableCards(session)[0]!;
    // Who this trick belongs to, worked out from the position rather than read
    // off the screen — so what follows is one expectation, not a fork.
    let answered = doPlayCard(session, led)!.session;
    for (let reply = 0; reply < 3; reply++) answered = applyCpuStep(answered)!.session;
    const winner = pendingTrick(answered.hand)!.winner;

    renderGame(saved(session));
    await settle();
    resume();

    const held = session.hand.hands[YOU].length;
    playCard(led);
    expect(within(trick()).getAllByRole('img')).toHaveLength(1);
    expect(within(hand()).getAllByRole('button')).toHaveLength(held - 1);

    // Then the three other seats, in the order they sit round the table.
    for (const count of [2, 3, 4]) {
      await advanceBeats(1);
      expect(within(trick()).getAllByRole('img')).toHaveLength(count);
    }
    // The four sit face up: taking them in is the table's own beat.
    expect(line()).not.toHaveTextContent(/took the trick/);

    await advanceBeats(1);
    expect(line()).toHaveTextContent(
      winner === YOU ? 'You took the trick' : `CPU ${winner} took the trick`,
    );
    // The four are gone from the table and still on the screen: the fold is
    // drawn from the beat's own record, because the state has already cleared
    // them (components/HeartsTable.tsx).
    expect(within(trick()).getAllByRole('img')).toHaveLength(4);
    // Every seat is a card lighter, and the fan re-flows onto three rows.
    for (const seat of [1, 2, 3]) {
      expect(
        within(table()).getByRole('group', { name: new RegExp(`CPU ${seat}: ${held - 1} cards`) }),
      ).toBeInTheDocument();
    }
    expect(hand().querySelectorAll('.ht-hand-row')).toHaveLength(3);

    // The seat that took it leads the next trick, and the chain runs straight
    // on into it: a CPU winner has a card down one beat later, and a win of
    // your own leaves the table waiting for you.
    await advanceBeats(1);
    expect(within(trick()).queryAllByRole('img')).toHaveLength(winner === YOU ? 0 : 1);
    await settle();
  });
});

// ---------- a hand, and then the next ----------

describe('a hand that settles', () => {
  it('lays the scores out and waits for the next deal to be asked for', async () => {
    const session = lastCollect('hearts-ui-settle');
    renderGame(saved(session));
    await settle();
    resume();

    // One beat takes the thirteenth trick in, which ends the hand.
    await advanceBeats(1);
    const settlement = screen.getByRole('alertdialog', { name: 'Hand scored' });
    // Every seat's take and every seat's total: four seats make the standing
    // the thing worth reading, not a difference from one opponent.
    expect(within(settlement).getByText('This hand')).toBeInTheDocument();
    expect(within(settlement).getByText('Match')).toBeInTheDocument();
    expect(within(settlement).getAllByRole('row')).toHaveLength(5);

    // Nothing deals the next hand on a timer; the hand's score is the one
    // thing here worth reading.
    await advanceBeats(4);
    expect(screen.getByRole('alertdialog', { name: 'Hand scored' })).toBeInTheDocument();

    fireEvent.click(within(settlement).getByRole('button', { name: 'Next hand' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // The second hand passes to the right, and everybody has thirteen again.
    expect(screen.getByText('Passing right')).toBeInTheDocument();
    expect(within(hand()).getAllByRole('button')).toHaveLength(13);
    await settle();
  });
});

describe('a match that ends', () => {
  it('states the final standing and offers a free rematch', async () => {
    renderGame(saved(endingIn(lastCollect('hearts-ui-won'), 'won')));
    await settle();
    resume();

    await advanceBeats(1);
    const result = screen.getByRole('alertdialog', { name: 'You win!' });
    expect(within(result).getByText('Final scores')).toBeInTheDocument();
    // Four seats, lowest first — winning order in Hearts.
    const places = within(result)
      .getAllByRole('row')
      .map((row) => Number(row.querySelector('.ht-scoreboard-total')!.textContent));
    expect(places).toHaveLength(4);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
    expect(Math.max(...places)).toBeGreaterThanOrEqual(MATCH_TARGET);

    // A settled hand is not a settled match: there is nothing left to deal.
    expect(screen.queryByRole('button', { name: 'Next hand' })).not.toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    await settle();
  });

  it('states a draw as a draw, neither celebrated nor scolded', async () => {
    renderGame(saved(endingIn(lastCollect('hearts-ui-draw'), 'draw')));
    await settle();
    resume();

    await advanceBeats(1);
    // Four seats make a tie for lowest ordinary rather than exotic, so it is
    // its own verdict rather than a win or a loss rounded off.
    const result = screen.getByRole('alertdialog', { name: 'A draw' });
    expect(
      within(result).getByText('You finished level with another seat on the lowest score.'),
    ).toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    await settle();
  });
});

// ---------- the play clock ----------

describe('backgrounding', () => {
  // Play, background the app, let Android kill it, come back: the match
  // returns, and so must the seconds. The session save alone cannot carry them
  // — `activate` treats a restored session's elapsedSeconds as already
  // counted, so anything not booked before the kill is gone for good.
  it('books play time before the app can be killed, and never twice', async () => {
    deviceStore.set(HT_STORAGE_KEYS.flags, tutorialDone[HT_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

    await advance(5_000);
    background();
    await settle();
    expect(storedPlaySeconds()).toBe(5);

    // The process dies here; nothing else runs. Relaunch and resume.
    cleanup();
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));

    await advance(3_000);
    background();
    await settle();
    // Eight seconds of play, counted once: the restored five are neither lost
    // nor booked a second time.
    expect(storedPlaySeconds()).toBe(8);
  });
});

// ---------- home ----------

describe('home', () => {
  it('reports a record per opponent, draws included, and no streak', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Wins')).toHaveLength(3);
    expect(screen.getAllByText('Losses')).toHaveLength(3);
    // Four seats make a tie for lowest a real outcome, so it has a column.
    expect(screen.getAllByText('Draws')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('exits to the collection', async () => {
    const { onExit } = renderGame(tutorialDone);
    await settle();

    expect(screen.getByRole('button', { name: /Easy/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
