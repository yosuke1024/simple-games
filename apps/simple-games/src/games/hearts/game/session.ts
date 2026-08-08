/**
 * HeartsSession — a pure, immutable snapshot of one match: the hand being
 * played, the four running scores, and nothing else. The React layer only
 * dispatches into these functions; all the rules live here, in engine.ts and
 * in cpu.ts.
 *
 * **There is no undo, and no function here to add one to** (§6). The board games'
 * undo works because both players can see everything; here, taking a move back
 * after watching three replies would hand back a card you now know was safe.
 * The leak cannot be undone by undoing the move, so the take-back is not
 * offered — the same reason Minesweeper has no undo. Help arrives instead as
 * the always-on list of cards you may legally play (`playableCards`).
 *
 * A match is a run of hands. Settling one leaves the session on a finished
 * hand with the scores already updated, and `doNextHand` deals the following
 * one. There is no clock on screen; elapsed seconds are carried for the
 * statistics only.
 *
 * **A beat is one thing happening.** The CPU seats confirm their passes one at
 * a time and play one card at a time, and taking a finished trick in is its
 * own beat as well — the four cards sit face up on the table until
 * `doCollectTrick` folds them away, which is the state the screen animates
 * from. The caller schedules each beat off session state, so a timer that
 * lands late finds nothing to do and does nothing.
 */
import type { Card } from './cards';
import { buildCpuView, chooseCpuAction, type CpuView } from './cpu';
import {
  collectTrick,
  confirmPass,
  dealHand,
  playCard,
  scoreHand,
  selectPassCard,
  unselectPassCard,
  type ExchangeOutcome,
  type HandOutcome,
  type TrickOutcome,
} from './engine';
import { createRng } from './rng';
import {
  bySeat,
  isCpuSeat,
  isTrickComplete,
  legalPlaysIn,
  MATCH_TARGET,
  PASS_SIZE,
  SEATS,
  seatToPlay,
  YOU,
  type BySeat,
  type Difficulty,
  type HandState,
  type MatchStatus,
  type Seat,
} from './types';

export interface HeartsSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly hand: HandState;
  /** Hands dealt so far, from 1. Half of the deal's seed, and the pass cycle. */
  readonly handNumber: number;
  /** Match points, indexed by seat. A hundred anywhere ends it. */
  readonly scores: BySeat<number>;
  /** From the player's side of the table: 'won' means the player did. */
  readonly status: MatchStatus;
  /** How the last hand scored, for the screen. Null while one is in progress. */
  readonly lastHand: HandOutcome | null;
  /** Beats taken this match, by any seat. The CPU tie-break's other half. */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets a new deal — while the seed
 * still pins every deal and every CPU answer in the match down completely.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `hearts-${token}`;

export function createSession(
  difficulty: Difficulty,
  seed: string = matchSeed(newSeedToken()),
): HeartsSession {
  return {
    seed,
    difficulty,
    hand: dealHand(seed, 1),
    handNumber: 1,
    scores: [0, 0, 0, 0],
    status: 'playing',
    lastHand: null,
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/**
 * The match's verdict, said from the player's side of the table
 * (docs/HEARTS_RULES.md §3.3).
 *
 * Hearts is won by having the fewest points, and four seats make ties
 * ordinary rather than exotic — so a tie the player is part of is a draw, and
 * a tie between two CPU seats is simply a loss, because the player still is
 * not the lowest.
 */
export function statusOf(scores: BySeat<number>): MatchStatus {
  if (!SEATS.some((seat) => scores[seat] >= MATCH_TARGET)) return 'playing';
  const lowest = Math.min(...SEATS.map((seat) => scores[seat]));
  const winners = SEATS.filter((seat) => scores[seat] === lowest);
  if (!winners.includes(YOU)) return 'lost';
  return winners.length === 1 ? 'won' : 'draw';
}

const scoredWith = (scores: BySeat<number>, outcome: HandOutcome): BySeat<number> =>
  bySeat<number>((seat) => scores[seat] + outcome.delta[seat]);

/** What one beat did, for the screen's animation and announcements. */
export type TurnEvent =
  | { readonly kind: 'pass'; readonly seat: Seat }
  | { readonly kind: 'play'; readonly seat: Seat; readonly card: Card }
  | { readonly kind: 'collect'; readonly trick: TrickOutcome };

export interface TurnOutcome {
  readonly session: HeartsSession;
  readonly event: TurnEvent;
  /** Set when this beat was the fourth confirmation and the cards changed hands. */
  readonly exchange: ExchangeOutcome | null;
  /** Set when this beat took in the thirteenth trick and the hand scored. */
  readonly handResult: HandOutcome | null;
}

/**
 * Folds a hand transition into the match: counts the beat, and — when the hand
 * has just ended — scores it and moves the four totals. The scores move the
 * moment the hand ends rather than when the next is dealt, so the screen
 * showing the result is showing the real standings.
 */
function advanced(
  session: HeartsSession,
  hand: HandState,
  event: TurnEvent,
  exchange: ExchangeOutcome | null,
): TurnOutcome {
  const moveCount = session.moveCount + 1;
  const handResult = scoreHand(hand);
  if (handResult === null) {
    return { session: { ...session, hand, moveCount }, event, exchange, handResult: null };
  }
  const scores = scoredWith(session.scores, handResult);
  return {
    session: {
      ...session,
      hand,
      scores,
      status: statusOf(scores),
      moveCount,
      lastHand: handResult,
    },
    event,
    exchange,
    handResult,
  };
}

/** Whether the match is still live and the hand still has moves in it. */
const live = (session: HeartsSession): boolean =>
  session.status === 'playing' && session.hand.phase !== 'over';

// ---------------------------------------------------------------------------
// The player's beats
// ---------------------------------------------------------------------------

/**
 * Picking the three cards to pass. Selecting and unselecting are staging, not
 * moves: they change what is on offer and nothing else, so they return a
 * session rather than an outcome and do not advance the beat count the CPU's
 * coin is drawn from.
 */
export function doSelectPassCard(session: HeartsSession, card: Card): HeartsSession | null {
  if (!live(session)) return null;
  const hand = selectPassCard(session.hand, YOU, card);
  return hand === null ? null : { ...session, hand };
}

export function doUnselectPassCard(session: HeartsSession, card: Card): HeartsSession | null {
  if (!live(session)) return null;
  const hand = unselectPassCard(session.hand, YOU, card);
  return hand === null ? null : { ...session, hand };
}

/** Whether the player's three are chosen and may be committed. */
export const canConfirmPass = (session: HeartsSession): boolean =>
  live(session) &&
  session.hand.phase === 'passing' &&
  !session.hand.confirmed[YOU] &&
  session.hand.selected[YOU].length === PASS_SIZE;

/**
 * Commits the player's three. When the CPU seats have already committed
 * theirs, this is the beat that resolves the exchange and starts the tricks.
 */
export function doConfirmPass(session: HeartsSession): TurnOutcome | null {
  if (!live(session)) return null;
  const result = confirmPass(session.hand, YOU);
  if (result === null) return null;
  return advanced(session, result.hand, { kind: 'pass', seat: YOU }, result.exchange);
}

/** What the player may legally play right now, ascending. Empty when it is not their turn. */
export function playableCards(session: HeartsSession): Card[] {
  if (!live(session) || seatToPlay(session.hand) !== YOU) return [];
  return legalPlaysIn({
    cards: session.hand.hands[YOU],
    leadCard: session.hand.played.length === 0 ? null : session.hand.played[0]!,
    firstTrick: session.hand.tricks.length === 0,
    heartsBroken: session.hand.heartsBroken,
  });
}

/**
 * The player plays one card. Returns null when it is not their turn or the
 * card is not legal — the screen sinks the cards it may not take, so a stray
 * tap is nothing, silently.
 */
export function doPlayCard(session: HeartsSession, card: Card): TurnOutcome | null {
  if (!live(session) || seatToPlay(session.hand) !== YOU) return null;
  const hand = playCard(session.hand, card);
  if (hand === null) return null;
  return advanced(session, hand, { kind: 'play', seat: YOU, card }, null);
}

// ---------------------------------------------------------------------------
// The table's beats
// ---------------------------------------------------------------------------

/** Whether four cards are lying finished on the table, waiting to be folded away. */
export const canCollectTrick = (session: HeartsSession): boolean =>
  session.status === 'playing' && isTrickComplete(session.hand);

/**
 * Takes the finished trick in — its own beat, so the screen can hold four
 * cards face up for a moment and then fold them towards whoever took them.
 * The thirteenth ends the hand and scores it.
 */
export function doCollectTrick(session: HeartsSession): TurnOutcome | null {
  if (!canCollectTrick(session)) return null;
  const result = collectTrick(session.hand);
  if (result === null) return null;
  return advanced(session, result.hand, { kind: 'collect', trick: result.trick }, null);
}

/** Whether the settled hand is waiting for the next deal. */
export const canDealNextHand = (session: HeartsSession): boolean =>
  session.status === 'playing' && session.hand.phase === 'over';

/**
 * Deals the next hand. Nobody deals in Hearts — the pass direction turns with
 * the hand number and the two of clubs decides who leads — so this is only the
 * seed's next deal, with the scores carried across. Null once the match is
 * decided: a finished match deals nothing.
 */
export function doNextHand(session: HeartsSession): HeartsSession | null {
  if (!canDealNextHand(session)) return null;
  const handNumber = session.handNumber + 1;
  return {
    ...session,
    hand: dealHand(session.seed, handNumber),
    handNumber,
    lastHand: null,
    moveCount: session.moveCount + 1,
  };
}

// ---------------------------------------------------------------------------
// The CPU's beats
// ---------------------------------------------------------------------------

/**
 * Which CPU seat acts next, or null when none does. During the pass that is
 * the lowest-numbered seat that has not committed — the three of them settle
 * while the player is still choosing, which is what the table looks like. Once
 * the tricks start it is simply whoever is to play, when that is not the
 * player.
 */
export function cpuSeatToAct(session: HeartsSession): Seat | null {
  if (!live(session)) return null;
  if (session.hand.phase === 'passing') {
    return SEATS.find((seat) => isCpuSeat(seat) && !session.hand.confirmed[seat]) ?? null;
  }
  const seat = seatToPlay(session.hand);
  return seat !== null && isCpuSeat(seat) ? seat : null;
}

/**
 * Whether the screen should be scheduling a CPU beat right now. Collecting a
 * finished trick is deliberately **not** one: it belongs to the table rather
 * than to any seat, and the screen times it against its own fold animation.
 */
export const isCpuTurn = (session: HeartsSession): boolean => cpuSeatToAct(session) !== null;

/** The view a seat will be given for its next beat — for the screen and the tests. */
export const cpuViewOf = (session: HeartsSession, seat: Seat): CpuView =>
  buildCpuView(session.hand, seat, session.difficulty, session.scores);

/**
 * One beat of a CPU seat: it commits its three, or it plays one card. Never
 * both, and never two seats at once — the screen shows one thing happening at
 * a time and this is where that is decided.
 *
 * Returns null when no CPU seat is waiting: the caller schedules this off
 * session state, and a stale schedule must land as nothing.
 *
 * The tie-break float is drawn from a stream keyed on the seed and the beat
 * count — the same shape the board games use — and it is the only randomness
 * the CPU sees. The deal's seed itself never crosses into cpu.ts.
 */
export function applyCpuStep(session: HeartsSession): TurnOutcome | null {
  const seat = cpuSeatToAct(session);
  if (seat === null) return null;
  const tieBreak = createRng(`${session.seed}:cpu:${session.moveCount}`)();
  const action = chooseCpuAction(cpuViewOf(session, seat), tieBreak);
  if (action === null) return null;

  if (action.kind === 'pass') {
    let hand: HandState = session.hand;
    // A CPU seat chooses and commits in the same beat, so anything already
    // picked out is put back first rather than added to.
    for (const card of hand.selected[seat]) {
      const cleared = unselectPassCard(hand, seat, card);
      if (cleared === null) return null;
      hand = cleared;
    }
    for (const card of action.cards) {
      const next = selectPassCard(hand, seat, card);
      if (next === null) return null;
      hand = next;
    }
    const result = confirmPass(hand, seat);
    if (result === null) return null;
    return advanced(session, result.hand, { kind: 'pass', seat }, result.exchange);
  }

  const hand = playCard(session.hand, action.card);
  if (hand === null) return null;
  return advanced(session, hand, { kind: 'play', seat, card: action.card }, null);
}

/**
 * Restores a session from persisted state. The status and the last hand's
 * result are recomputed rather than stored: both are functions of the scores
 * and the hand, and a save that disagreed with itself would be a save that
 * could rewrite the match.
 */
export function restoreSession(data: Omit<HeartsSession, 'status' | 'lastHand'>): HeartsSession {
  return {
    ...data,
    status: statusOf(data.scores),
    lastHand: scoreHand(data.hand),
  };
}
