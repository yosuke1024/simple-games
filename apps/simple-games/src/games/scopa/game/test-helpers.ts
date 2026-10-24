/**
 * Shared by the game/ tests only: card notation, the two random players of
 * docs/SCOPA_RULES.md §4.1, and a match driver that seats any strategy on
 * either side. Nothing in the game imports this file.
 */
import { cardOf, SUITS, type Card, type Suit } from './cards';
import { buildCpuView, chooseCpuMove, type WorkMeter } from './cpu';
import {
  applyMove,
  applyRefill,
  dealDeal,
  dealerOf,
  firstDealerOf,
  legalMoves,
  phaseOf,
  seatToPlay,
  settleDeal,
  type DealOutcome,
  type Move,
} from './engine';
import { createRng } from './rng';
import { statusOf } from './session';
import { CPU, YOU, type BySeat, type DealState, type MatchStatus, type Seat } from './types';

const SUIT_LETTERS = 'SHDC';
const VALUE_LETTERS = 'A234567JQK';

/** `'7D'` is 7♦, `'KS'` is K♠, `'AH'` is A♥ — value letter, then suit letter. */
export function card(text: string): Card {
  const value = VALUE_LETTERS.indexOf(text[0]!) + 1;
  const suit = SUIT_LETTERS.indexOf(text[1]!) as Suit;
  if (value < 1 || suit < 0 || text.length !== 2) throw new Error(`not a card: ${text}`);
  return cardOf(suit, value);
}

export const cards = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(card);

export const nameOf = (c: Card): string =>
  `${VALUE_LETTERS[c % 10]}${SUIT_LETTERS[SUITS[Math.floor(c / 10)]!]}`;

/** A deal state built by hand, for the rule tests. Unlisted fields are empty. */
export function dealWith(fields: Partial<DealState>): DealState {
  return {
    dealer: CPU,
    hands: [[], []],
    table: [],
    stock: [],
    captured: [[], []],
    scopas: [0, 0],
    lastCapturer: null,
    rounds: 1,
    redeals: 0,
    plays: [],
    sweep: null,
    ...fields,
  };
}

/** What a strategy is told: the full deal (a strategy may only read its own side). */
export interface Turn {
  readonly deal: DealState;
  readonly seat: Seat;
  readonly scores: BySeat<number>;
  readonly seed: string;
  readonly moveCount: number;
}

export type Strategy = (turn: Turn, meter?: WorkMeter) => Move;

/**
 * The CPU of cpu.ts. On the CPU's seat this is exactly `applyCpuStep` (same
 * view, same tie-break stream); on the player's seat it draws its tie-break
 * from a stream of its own, so the two sides do not share coins.
 */
export const cpuStrategy: Strategy = (turn, meter) => {
  const stream = turn.seat === CPU ? 'cpu' : 'you';
  const tieBreak = createRng(`${turn.seed}:${stream}:${turn.moveCount}`)();
  return chooseCpuMove(buildCpuView(turn.deal, turn.seat, turn.scores), tieBreak, meter)!;
};

/**
 * Random player A (§4.1): uniform over every legal (card, capture) pair — a
 * card with more ways to take is likelier to be chosen.
 */
export const randomPairs: Strategy = (turn) => {
  const moves = legalMoves(turn.deal);
  const rng = createRng(`${turn.seed}:random-pairs:${turn.seat}:${turn.moveCount}`);
  return moves[Math.floor(rng() * moves.length)]!;
};

/** Random player B (§4.1): a card uniformly, then one of its ways uniformly. */
export const randomCardThenOption: Strategy = (turn) => {
  const moves = legalMoves(turn.deal);
  const rng = createRng(`${turn.seed}:random-card:${turn.seat}:${turn.moveCount}`);
  const hand = [...new Set(moves.map((move) => move.card))];
  const chosen = hand[Math.floor(rng() * hand.length)]!;
  const ways = moves.filter((move) => move.card === chosen);
  return ways[Math.floor(rng() * ways.length)]!;
};

export interface PlayRecord {
  readonly seat: Seat;
  readonly move: Move;
  /** Table size just before the card was played. */
  readonly tableBefore: number;
  /** Subsets the strategy's decision visited (0 for the random players). */
  readonly nodes: number;
  /** Wall-clock milliseconds of the decision, when timed — reported, never a limit. */
  readonly ms: number;
}

export interface DealRecord {
  readonly outcome: DealOutcome;
  readonly redeals: number;
  readonly dealer: Seat;
  readonly lastCapturer: Seat | null;
  /** The deal after its thirty-sixth card. */
  readonly final: DealState;
}

export interface MatchRecord {
  readonly seed: string;
  readonly status: MatchStatus;
  readonly scores: BySeat<number>;
  readonly deals: readonly DealRecord[];
  readonly plays: readonly PlayRecord[];
  /** Every state the match passed through, each with the scores and move count at that point. */
  readonly states: readonly {
    deal: DealState;
    dealNumber: number;
    scores: BySeat<number>;
    moveCount: number;
  }[];
}

/**
 * Plays one match to its end with a strategy on each seat, through the
 * engine's own functions — the same order of beats session.ts runs.
 */
export function playMatch(
  seed: string,
  strategies: BySeat<Strategy>,
  options: { keepStates?: boolean; time?: boolean; maxDeals?: number } = {},
): MatchRecord {
  let scores: BySeat<number> = [0, 0];
  let moveCount = 0;
  let dealNumber = 1;
  let deal = dealDeal(seed, 1, firstDealerOf(seed));
  const deals: DealRecord[] = [];
  const plays: PlayRecord[] = [];
  const states: MatchRecord['states'][number][] = [];
  const keep = (): void => {
    if (options.keepStates) states.push({ deal, dealNumber, scores, moveCount });
  };
  keep();
  for (;;) {
    const phase = phaseOf(deal);
    if (phase === 'refill') {
      deal = applyRefill(deal)!;
      keep();
      continue;
    }
    if (phase === 'over') {
      const outcome = settleDeal(deal)!;
      scores = [scores[YOU] + outcome.points[YOU], scores[CPU] + outcome.points[CPU]];
      deals.push({
        outcome,
        redeals: deal.redeals,
        dealer: deal.dealer,
        lastCapturer: deal.lastCapturer,
        final: deal,
      });
      const status = statusOf(scores);
      if (status !== 'playing' || deals.length >= (options.maxDeals ?? 999)) {
        return { seed, status, scores, deals, plays, states };
      }
      keep();
      dealNumber += 1;
      deal = dealDeal(seed, dealNumber, dealerOf(seed, dealNumber));
      keep();
      continue;
    }
    const seat = seatToPlay(deal)!;
    const meter: WorkMeter = { nodes: 0 };
    const started = options.time ? performance.now() : 0;
    const move = strategies[seat]({ deal, seat, scores, seed, moveCount }, meter);
    const ms = options.time ? performance.now() - started : 0;
    plays.push({ seat, move, tableBefore: deal.table.length, nodes: meter.nodes, ms });
    const next = applyMove(deal, move);
    if (next === null) throw new Error(`strategy played an illegal move in ${seed}`);
    deal = next;
    moveCount += 1;
    if (phaseOf(deal) !== 'over') keep();
  }
}

/** Seats: [player, CPU]. */
export const seats = (you: Strategy, cpu: Strategy): BySeat<Strategy> => [you, cpu];

export const percentile = (sorted: readonly number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;

export function histogram(values: readonly number[]): string {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return JSON.stringify(Object.fromEntries([...counts].sort((a, b) => a[0] - b[0])));
}
