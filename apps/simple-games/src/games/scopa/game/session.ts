/**
 * ScopaSession — a pure, immutable snapshot of one match: the deal being
 * played, the running score, and nothing else. The React layer only
 * dispatches into these functions; all the rules live here, in engine.ts and
 * in cpu.ts (docs/SCOPA_RULES.md).
 *
 * **There is no undo, and no function here to add one to** (§6). Taking a card
 * back after watching the CPU's reply and the next three cards dealt would
 * hand back what you now know. Help arrives instead as the capture marks and
 * the always-on primiera tally (§7), both of them arithmetic of the rules.
 *
 * A match is a run of deals. The thirty-sixth card ends a deal and moves the
 * score at once, so the settlement the screen shows is the real standing; the
 * next deal waits for the player's tap (`doNextDeal`), never for a timer.
 *
 * **A beat is one thing happening** (§4.2), and `beatOwed` is the only place
 * their order is decided: a settled deal owes nothing (it waits for a tap),
 * then a refill, then the CPU's card. The caller arms one timer for whatever
 * it says, so a timer that lands late finds nothing owed and does nothing.
 *
 * `moveCount` counts cards played across the match and nothing else — refills
 * and new deals do not advance it — which is what lets the saved game check it
 * exactly (§9.2) and what keeps the CPU's tie-break stream reproducible.
 */
import { buildCpuView, chooseCpuMove, type CpuView } from './cpu';
import {
  applyMove,
  applyRefill,
  dealDeal,
  dealerOf,
  firstDealerOf,
  isScopaMove,
  legalMoves,
  phaseOf,
  seatToPlay,
  settleDeal,
  type DealOutcome,
  type Move,
} from './engine';
import { createRng } from './rng';
import {
  CPU,
  MATCH_TARGET,
  YOU,
  type BySeat,
  type DealState,
  type MatchStatus,
  type Seat,
} from './types';
import type { Card } from './cards';

export { dealerOf, firstDealerOf };

export interface ScopaSession {
  readonly seed: string;
  /** Deals dealt so far, from 1. Half of the deal's seed. */
  readonly dealNumber: number;
  readonly deal: DealState;
  /** Match points, by seat. A settled deal's points are already in. */
  readonly scores: BySeat<number>;
  /** From the player's side of the table: 'won' means the player did. */
  readonly status: MatchStatus;
  /** How the current deal scored, once it is over; null while it is being played. */
  readonly lastDeal: DealOutcome | null;
  /** Cards played this match, by either side. The CPU tie-break's other half. */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own (a copy of Gin Rummy's). There
 * are no levels and no dates to seed from, so every new match gets a new
 * deal — while the seed still pins every deal and every CPU answer down.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `scopa-${token}`;

export function createSession(seed: string = matchSeed(newSeedToken())): ScopaSession {
  return {
    seed,
    dealNumber: 1,
    deal: dealDeal(seed, 1, firstDealerOf(seed)),
    scores: [0, 0],
    status: 'playing',
    lastDeal: null,
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/**
 * The match's verdict, judged only when a deal ends (§3.4): eleven or more on
 * either side and the two scores differ, the higher side has it. Level at
 * eleven or more, the match goes on. There is no draw.
 */
export function statusOf(scores: BySeat<number>): MatchStatus {
  const [you, cpu] = scores;
  if ((you < MATCH_TARGET && cpu < MATCH_TARGET) || you === cpu) return 'playing';
  return you > cpu ? 'won' : 'lost';
}

/** What one beat did, for the screen's animation and announcements. */
export type TurnEvent =
  | {
      readonly kind: 'play';
      readonly seat: Seat;
      readonly card: Card;
      /** The table cards taken, ascending; empty for a placement. */
      readonly captured: readonly Card[];
      readonly scopa: boolean;
    }
  | { readonly kind: 'refill' };

export interface TurnOutcome {
  readonly session: ScopaSession;
  readonly event: TurnEvent;
  /** Set when this beat was the thirty-sixth card and the deal scored. */
  readonly dealResult: DealOutcome | null;
}

/** Folds a played card into the match; the last card of a deal scores it. */
function played(session: ScopaSession, before: DealState, move: Move): TurnOutcome | null {
  const seat = seatToPlay(before);
  const deal = applyMove(before, move);
  if (deal === null || seat === null) return null;
  const event: TurnEvent = {
    kind: 'play',
    seat,
    card: move.card,
    captured: deal.plays[deal.plays.length - 1]!.captured,
    scopa: isScopaMove(before, move),
  };
  const moveCount = session.moveCount + 1;
  const dealResult = settleDeal(deal);
  if (dealResult === null) {
    return { session: { ...session, deal, moveCount }, event, dealResult: null };
  }
  const scores: BySeat<number> = [
    session.scores[YOU] + dealResult.points[YOU],
    session.scores[CPU] + dealResult.points[CPU],
  ];
  return {
    session: {
      ...session,
      deal,
      scores,
      status: statusOf(scores),
      lastDeal: dealResult,
      moveCount,
    },
    event,
    dealResult,
  };
}

const live = (session: ScopaSession): boolean => session.status === 'playing';

// ---------------------------------------------------------------------------
// The player's beats
// ---------------------------------------------------------------------------

/** Whether it is the player's card to play. */
export const isPlayersTurn = (session: ScopaSession): boolean =>
  live(session) && seatToPlay(session.deal) === YOU;

/** The player's legal moves, in canonical order — empty when it is not their turn. */
export const playerMoves = (session: ScopaSession): Move[] =>
  isPlayersTurn(session) ? legalMoves(session.deal) : [];

/**
 * The player puts down one card, taking `captured` (empty to place). Null when
 * it is not their turn or the rules refuse it — the screen only offers what is
 * legal, so a stray tap is nothing, silently.
 */
export function doPlay(session: ScopaSession, move: Move): TurnOutcome | null {
  if (!isPlayersTurn(session)) return null;
  return played(session, session.deal, move);
}

// ---------------------------------------------------------------------------
// The table's beats
// ---------------------------------------------------------------------------

/** Whether both hands are empty and three cards each are owed. */
export const canRefill = (session: ScopaSession): boolean =>
  live(session) && phaseOf(session.deal) === 'refill';

/** Deals the next round. A beat of its own; it does not advance `moveCount`. */
export function doRefill(session: ScopaSession): TurnOutcome | null {
  if (!canRefill(session)) return null;
  const deal = applyRefill(session.deal);
  if (deal === null) return null;
  return { session: { ...session, deal }, event: { kind: 'refill' }, dealResult: null };
}

/** Whether the settled deal is waiting for the player's tap to deal the next one. */
export const canDealNextDeal = (session: ScopaSession): boolean =>
  live(session) && phaseOf(session.deal) === 'over';

/**
 * Deals the next deal — the other side deals it (§2.1). Null once the match is
 * decided: a finished match deals nothing. Does not advance `moveCount`.
 */
export function doNextDeal(session: ScopaSession): ScopaSession | null {
  if (!canDealNextDeal(session)) return null;
  const dealNumber = session.dealNumber + 1;
  return {
    ...session,
    dealNumber,
    deal: dealDeal(session.seed, dealNumber, dealerOf(session.seed, dealNumber)),
    lastDeal: null,
  };
}

// ---------------------------------------------------------------------------
// The CPU's beats
// ---------------------------------------------------------------------------

export const isCpuTurn = (session: ScopaSession): boolean =>
  live(session) && seatToPlay(session.deal) === CPU;

/** The view the CPU will be given for its next card — for the screen and the tests. */
export const cpuViewOf = (session: ScopaSession): CpuView =>
  buildCpuView(session.deal, CPU, session.scores);

/**
 * One card from the CPU. Null when it is not the CPU's turn: the caller
 * schedules this off session state, and a stale schedule must land as nothing.
 * The tie-break float is the only randomness the CPU sees; the deal's seed
 * itself never crosses into cpu.ts.
 */
export function applyCpuStep(session: ScopaSession): TurnOutcome | null {
  if (!isCpuTurn(session)) return null;
  const tieBreak = createRng(`${session.seed}:cpu:${session.moveCount}`)();
  const move = chooseCpuMove(cpuViewOf(session), tieBreak);
  if (move === null) return null;
  return played(session, session.deal, move);
}

/** A beat the table owes: three cards each, or the CPU's card. */
export type Beat = 'refill' | 'cpu';

/**
 * The beat owed right now, or null when the table is waiting on the player —
 * for a card, or for the tap that deals the next deal. This is the whole of
 * the chain, in its one order (§4.2): settled → refill → CPU.
 */
export function beatOwed(session: ScopaSession): Beat | null {
  if (!live(session)) return null;
  const phase = phaseOf(session.deal);
  if (phase === 'over') return null;
  if (phase === 'refill') return 'refill';
  return isCpuTurn(session) ? 'cpu' : null;
}

/** Runs the beat `beatOwed` named. Null if it is no longer owed. */
export function applyBeat(session: ScopaSession, beat: Beat): TurnOutcome | null {
  if (beatOwed(session) !== beat) return null;
  return beat === 'refill' ? doRefill(session) : applyCpuStep(session);
}

/**
 * Restores a session from persisted state. The status and the settled deal's
 * result are recomputed rather than stored: both are functions of the score
 * and the deal, and a save that disagreed with itself could rewrite the match.
 *
 * A decided score is not restored at all (null): a finished match is never
 * saved — its save is deleted when it ends — so one arriving here was written
 * by something else, and this holds that rule on its own, independently of the
 * decoder (docs/SCOPA_RULES.md §9.2, the Hearts §9 shape).
 */
export function restoreSession(
  data: Omit<ScopaSession, 'status' | 'lastDeal'>,
): ScopaSession | null {
  const status = statusOf(data.scores);
  if (status !== 'playing') return null;
  return { ...data, status, lastDeal: settleDeal(data.deal) };
}
