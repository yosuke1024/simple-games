/**
 * Core Scopa types: the two seats, one deal of the match, and the constants the
 * rules are made of (docs/SCOPA_RULES.md §1–§3 — that document is the source of
 * truth and this file follows it).
 *
 * A deal's **public history** (`plays`) is a first-class part of the state: it
 * is exactly what a player at the table saw happen, it is what the saved game
 * stores (serialize.ts replays it from the seed), and every other field of a
 * deal is what that history leaves behind. `hands` and `stock` hold what one
 * side cannot see, which is precisely why the CPU is never handed a
 * `DealState` — `buildCpuView` (cpu.ts) copies out the seat's own cards and
 * the public facts, and nothing else has a way through.
 */
import type { Card } from './cards';

/** The player's seat; the CPU takes the other. Two seats, and only two. */
export const YOU = 0;
export const CPU = 1;
export type Seat = typeof YOU | typeof CPU;
export const SEATS: readonly Seat[] = [YOU, CPU];

export const opponentOf = (seat: Seat): Seat => (seat === YOU ? CPU : YOU);
export const isSeat = (value: unknown): value is Seat => value === YOU || value === CPU;

/** A value per seat, indexed by `Seat`. */
export type BySeat<T> = readonly [T, T];

/** Three cards each, every round (§2.1). */
export const HAND_SIZE = 3;
/** Four cards face up on the table at the start of a deal, and never added to by a refill. */
export const TABLE_START = 4;
/** 4 + 6 × 6 = 40: six rounds of three cards each empty the deck exactly. */
export const ROUNDS_PER_DEAL = 6;
/** Plays per round: three cards each. */
export const PLAYS_PER_ROUND = HAND_SIZE * 2;
/** Thirty-six cards played per deal; the thirty-sixth is always the dealer's. */
export const PLAYS_PER_DEAL = ROUNDS_PER_DEAL * PLAYS_PER_ROUND;
/** Cards, ♦, 7♦ and primiera: one point each to one side, or to nobody when level (§3.2). */
export const CATEGORY_POINTS = 4;
/**
 * The most scopas one deal can hold, by arithmetic (§9.2): a scopa empties
 * the table, so the next card cannot take and no two plays in a row both
 * score; the thirty-sixth never does (§2.4). Every other play of the first
 * thirty-five is 18.
 */
export const MAX_SCOPAS_PER_DEAL = Math.ceil((PLAYS_PER_DEAL - 1) / 2);
/** The most points one deal can give out, both sides together (§9.2) — an upper bound, not a reachable score. */
export const MAX_DEAL_POINTS = CATEGORY_POINTS + MAX_SCOPAS_PER_DEAL;
/** Three or more kings among the first four on the table: the deal is reshuffled (§2.1). */
export const REDEAL_KINGS = 3;
/** Reshuffles after the first, at most; the ninth shuffle is used as it falls. */
export const MAX_REDEALS = 8;
/** Eleven or more, and ahead, takes the match — judged only when a deal ends (§3.4). */
export const MATCH_TARGET = 11;

/** From the player's side of the table: there is no draw (§3.4). */
export type MatchStatus = 'playing' | 'won' | 'lost';

/**
 * One card played: who played it, the card, and the table cards it took —
 * ascending, and empty when the card was placed on the table instead.
 */
export interface Play {
  readonly seat: Seat;
  readonly card: Card;
  readonly captured: readonly Card[];
}

/**
 * Where a deal is:
 *
 * - `play` — `seatToPlay` must put down one card from hand.
 * - `refill` — both hands are empty and the stock is not: three cards each are
 *   owed. A state of its own, so the screen can show the table for a beat
 *   before the new cards arrive (§2.1, §4.2).
 * - `over` — thirty-six cards have been played and the table has gone to the
 *   side that took last (§3.1). `settleDeal` scores it.
 */
export type DealPhase = 'play' | 'refill' | 'over';

/** The table cards that went to the last side to take, when the deal ended (§3.1). */
export interface Sweep {
  readonly seat: Seat;
  readonly cards: readonly Card[];
}

export interface DealState {
  readonly dealer: Seat;
  /** Each seat's hand, ascending — the order cards were dealt in is not information. */
  readonly hands: BySeat<readonly Card[]>;
  /** The table, in the order the cards arrived (§11.2). */
  readonly table: readonly Card[];
  /** Face down, top first. Neither side sees it; the CPU sees only its length. */
  readonly stock: readonly Card[];
  /** Each seat's taken cards, ascending. Public: every capture happens in the open. */
  readonly captured: BySeat<readonly Card[]>;
  /** Scopas taken this deal, per seat (§2.4). */
  readonly scopas: BySeat<number>;
  /** The side that took last, or null before anyone has (§3.1). */
  readonly lastCapturer: Seat | null;
  /** Rounds dealt so far, 1..6 (the opening deal is round 1). */
  readonly rounds: number;
  /** Reshuffles the opening needed for three kings on the table, 0..MAX_REDEALS (§2.1). */
  readonly redeals: number;
  /** Every card played this deal, in order — the deal's public history. */
  readonly plays: readonly Play[];
  /** Where the table went when the deal ended; null until then. */
  readonly sweep: Sweep | null;
}
