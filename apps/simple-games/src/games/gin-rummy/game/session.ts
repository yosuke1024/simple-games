/**
 * GinRummySession — a pure, immutable snapshot of one match: the hand being
 * played, the running score, and nothing else. The React layer only dispatches
 * into these functions; all the rules live here, in engine.ts and in cpu.ts.
 *
 * **There is no undo, and no function here to add one to** (§6). The board games'
 * undo works because both players can see everything; here, taking a move back
 * after watching the reply would hand back a card you now know the opponent
 * wanted. The leak cannot be undone by undoing the move, so the take-back is
 * not offered — the same reason Minesweeper has no undo. Help arrives instead
 * as the always-on deadwood count and the melds arranged for you (melds.ts).
 *
 * A match is a run of hands. Settling one leaves the session on a finished
 * hand with the score already updated, and `doNextHand` deals the following
 * one — the hand's winner deals it, and a dead hand is redealt by the same
 * dealer. There is no clock on screen; elapsed seconds are carried for the
 * statistics only.
 */
import type { Card } from './cards';
import { chooseCpuAction, buildCpuView, type CpuView } from './cpu';
import { applyAction, dealHand, settleHand, type HandOutcome } from './engine';
import { createRng } from './rng';
import {
  CPU,
  MATCH_TARGET,
  YOU,
  type Difficulty,
  type HandAction,
  type HandState,
  type MatchStatus,
  type PublicEvent,
  type Seat,
} from './types';

export interface GinRummySession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly hand: HandState;
  /** Hands dealt so far, from 1. Half of the deal's seed. */
  readonly handNumber: number;
  /** Match points, indexed by seat. First to a hundred takes it. */
  readonly scores: readonly [number, number];
  /** From the player's side of the table: 'won' means the player did. */
  readonly status: MatchStatus;
  /** How the last hand ended, for the screen. Null while one is in progress. */
  readonly lastHand: HandOutcome | null;
  /** Actions taken this match, by either side. The CPU tie-break's other half. */
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

export const matchSeed = (token: string): string => `gin-${token}`;

/**
 * Who deals the first hand. The non-dealer gets first refusal on the upcard,
 * so this is a real coin toss and it comes from the seed like everything else.
 */
export const firstDealerOf = (seed: string): Seat =>
  createRng(`${seed}:dealer`)() < 0.5 ? YOU : CPU;

export function createSession(
  difficulty: Difficulty,
  seed: string = matchSeed(newSeedToken()),
): GinRummySession {
  return {
    seed,
    difficulty,
    hand: dealHand(seed, 1, firstDealerOf(seed)),
    handNumber: 1,
    scores: [0, 0],
    status: 'playing',
    lastHand: null,
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/** The match's verdict, said from the player's side of the table. */
function statusOf(scores: readonly [number, number]): MatchStatus {
  if (scores[YOU] >= MATCH_TARGET) return 'won';
  if (scores[CPU] >= MATCH_TARGET) return 'lost';
  return 'playing';
}

function scoredWith(
  scores: readonly [number, number],
  outcome: HandOutcome,
): readonly [number, number] {
  if (outcome.winner === null) return scores;
  return outcome.winner === YOU
    ? [scores[YOU] + outcome.points, scores[CPU]]
    : [scores[YOU], scores[CPU] + outcome.points];
}

export interface TurnOutcome {
  readonly session: GinRummySession;
  /** What just happened, for the screen's animation and announcements. */
  readonly event: PublicEvent;
  /** Set when this action ended the hand; null otherwise. */
  readonly handResult: HandOutcome | null;
}

/**
 * Folds a hand transition into the match: counts the action, and — when the
 * transition ended the hand — settles it and moves the score. The score moves
 * as soon as the hand ends rather than when the next one is dealt, so the
 * screen showing the result is showing the real standings.
 */
function advanced(session: GinRummySession, hand: HandState | null): TurnOutcome | null {
  if (hand === null) return null;
  const event = hand.log[hand.log.length - 1]!;
  const moveCount = session.moveCount + 1;
  if (hand.phase !== 'over') {
    return { session: { ...session, hand, moveCount }, event, handResult: null };
  }
  const handResult = settleHand(hand);
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
    handResult,
  };
}

/** Whether the player may act at all right now. */
const playersTurn = (session: GinRummySession): boolean =>
  session.status === 'playing' && session.hand.phase !== 'over' && session.hand.turn === YOU;

/**
 * The player's turn, one action at a time. Each returns null when the rules or
 * the turn order do not allow it — the screen only offers what is legal, so a
 * stray tap is nothing, silently.
 */
function doAction(session: GinRummySession, action: HandAction): TurnOutcome | null {
  if (!playersTurn(session)) return null;
  return advanced(session, applyAction(session.hand, action));
}

export const doTakeUpcard = (session: GinRummySession): TurnOutcome | null =>
  doAction(session, { kind: 'take-upcard' });

export const doPassUpcard = (session: GinRummySession): TurnOutcome | null =>
  doAction(session, { kind: 'pass-upcard' });

export const doDrawStock = (session: GinRummySession): TurnOutcome | null =>
  doAction(session, { kind: 'draw-stock' });

export const doDrawDiscard = (session: GinRummySession): TurnOutcome | null =>
  doAction(session, { kind: 'draw-discard' });

export const doDiscard = (session: GinRummySession, card: Card): TurnOutcome | null =>
  doAction(session, { kind: 'discard', card });

export const doKnock = (session: GinRummySession, card: Card): TurnOutcome | null =>
  doAction(session, { kind: 'knock', card });

/** Whether the settled hand is waiting for the next deal. */
export const canDealNextHand = (session: GinRummySession): boolean =>
  session.status === 'playing' && session.hand.phase === 'over';

/**
 * Deals the next hand: the winner deals it, and a dead hand goes back to the
 * same dealer (docs/GIN_RUMMY_RULES.md §1, §3.1).
 * Null once the match is decided — a finished match deals nothing.
 */
export function doNextHand(session: GinRummySession): GinRummySession | null {
  if (!canDealNextHand(session)) return null;
  const dealer = session.lastHand?.winner ?? session.hand.dealer;
  const handNumber = session.handNumber + 1;
  return {
    ...session,
    hand: dealHand(session.seed, handNumber, dealer),
    handNumber,
    lastHand: null,
    moveCount: session.moveCount + 1,
  };
}

/** Whether the screen should be scheduling a CPU turn right now. */
export const isCpuTurn = (session: GinRummySession): boolean =>
  session.status === 'playing' && session.hand.phase !== 'over' && session.hand.turn === CPU;

/** The view the CPU will be given for its next action — for the screen and the tests. */
export const cpuViewOf = (session: GinRummySession): CpuView =>
  buildCpuView(session.hand, CPU, session.difficulty, session.scores);

/**
 * One beat of the CPU's turn: it draws, and then — scheduled again — it puts a
 * card down. Two beats rather than one because that is how it reads at the
 * table, and because the screen wants to show the card it took before the card
 * it threw.
 *
 * Returns null when it is not the CPU's turn: the caller schedules this off
 * session state, and a stale schedule must land as nothing.
 *
 * The tie-break float is drawn from a stream keyed on the seed and the move
 * count — the same shape the board games use — and it is the only randomness
 * the CPU sees. The deal's seed itself never crosses into cpu.ts.
 */
export function applyCpuStep(session: GinRummySession): TurnOutcome | null {
  if (!isCpuTurn(session)) return null;
  const tieBreak = createRng(`${session.seed}:cpu:${session.moveCount}`)();
  const action = chooseCpuAction(cpuViewOf(session), tieBreak);
  if (action === null) return null;
  return advanced(session, applyAction(session.hand, action));
}

/**
 * Restores a session from persisted state. The status and the last hand's
 * result are recomputed rather than stored: both are functions of the score
 * and the hand, and a save that disagreed with itself would be a save that
 * could rewrite the match.
 */
export function restoreSession(
  data: Omit<GinRummySession, 'status' | 'lastHand'>,
): GinRummySession {
  return {
    ...data,
    status: statusOf(data.scores),
    lastHand: data.hand.phase === 'over' ? settleHand(data.hand) : null,
  };
}
