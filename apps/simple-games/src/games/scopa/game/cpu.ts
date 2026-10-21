/**
 * The opponent (docs/SCOPA_RULES.md §4, §5). One strength, no search: every
 * legal (card, capture) pair is priced as "what this takes" minus "what the
 * table it leaves could hand the other side", and the best price is played.
 * There is no tree to bound — one decision is a fixed amount of arithmetic,
 * bounded by the rules themselves (§4: at most 168 candidates, each one
 * enumeration of at most 236 subsets, plus the one enumeration of the table).
 *
 * **What it can see is a type.** Everything this file reads arrives as a
 * `CpuView`, and a `CpuView` has no place for the other side's hand or for the
 * order of the stock — add one and the peek is right there in the diff. The
 * only bridge from a full deal is `buildCpuView`, and it copies. The deal's
 * seed never crosses into this file; the tie-break arrives as a number.
 *
 * v1 reads only its own hand, the table, the two card counts and who deals.
 * The rest of the view is public fact it is allowed to know and does not use
 * (§4.1 — no inference from the public history, as Dominoes §6).
 */
import { isDiamond, MAX_VALUE, SEVEN_OF_DIAMONDS, sortedCards, valueOf, type Card } from './cards';
import { enumerateCaptures, type Move } from './engine';
import { opponentOf, type BySeat, type DealState, type Seat } from './types';

export interface CpuView {
  readonly seat: Seat;
  /** The seat's own hand, ascending. */
  readonly hand: readonly Card[];
  /** The table, ascending — the order cards arrived in is not information. */
  readonly table: readonly Card[];
  /** Both seats' taken cards, ascending: every capture happens in the open. */
  readonly captured: BySeat<readonly Card[]>;
  /** How many cards the other side holds — the count only. */
  readonly opponentCardCount: number;
  /** How many cards are left face down — the count only, never which or in what order. */
  readonly stockCount: number;
  readonly dealer: Seat;
  readonly scopas: BySeat<number>;
  readonly lastCapturer: Seat | null;
  readonly scores: BySeat<number>;
}

/** The only bridge from a deal to the CPU. Copies; never hands over a reference. */
export function buildCpuView(deal: DealState, seat: Seat, scores: BySeat<number>): CpuView {
  return {
    seat,
    hand: sortedCards(deal.hands[seat]),
    table: sortedCards(deal.table),
    captured: [sortedCards(deal.captured[0]), sortedCards(deal.captured[1])],
    opponentCardCount: deal.hands[opponentOf(seat)].length,
    stockCount: deal.stock.length,
    dealer: deal.dealer,
    scopas: [deal.scopas[0], deal.scopas[1]],
    lastCapturer: deal.lastCapturer,
    scores: [scores[0], scores[1]],
  };
}

// ---------------------------------------------------------------------------
// The weights (§4.1). Initial values; the self-play numbers in §15 are what
// they were measured at.
// ---------------------------------------------------------------------------

export const WEIGHT_CARD = 1;
export const WEIGHT_DIAMOND = 2;
export const WEIGHT_SEVEN = 3;
export const WEIGHT_SIX = 2;
export const WEIGHT_ACE = 1;
export const WEIGHT_SETTEBELLO = 10;
export const WEIGHT_SCOPA = 10;
/** The move's price is `GAIN_SCALE × gain − risk`, so prices compare as integers. */
export const GAIN_SCALE = 10;

/** What a value is worth regardless of suit: the card, plus the primiera stand-in. */
const valueGain = (value: number): number =>
  WEIGHT_CARD +
  (value === 7 ? WEIGHT_SEVEN : value === 6 ? WEIGHT_SIX : value === 1 ? WEIGHT_ACE : 0);

/** One real card's worth: its value's, plus ♦ and 7♦. */
export const cardGain = (card: Card): number =>
  valueGain(valueOf(card)) +
  (isDiamond(card) ? WEIGHT_DIAMOND : 0) +
  (card === SEVEN_OF_DIAMONDS ? WEIGHT_SETTEBELLO : 0);

/** `gain(G)`: the cards taken, the played card included; a scopa adds its 10 once. */
export function gainOf(cards: readonly Card[], scopa: boolean): number {
  let gain = scopa ? WEIGHT_SCOPA : 0;
  for (const card of cards) gain += cardGain(card);
  return gain;
}

/** Accumulates the subsets visited, for the work-bound tests (§4, §15). */
export interface WorkMeter {
  nodes: number;
}

/**
 * `risk(T′)`: for each value w = 1..10 the other side's next card might have,
 * the best `gain` a card of that value could take from T′ — summed over the
 * ten. The supposed card has no suit, so it is worth only its value's part
 * (no ♦, no 7♦); the table cards it would take are real and count in full.
 * Taking all of T′ adds the scopa's 10 unless that card is the deal's last.
 */
export function riskOf(
  tableAfter: readonly Card[],
  opponentLastPlay: boolean,
  meter?: WorkMeter,
): number {
  if (tableAfter.length === 0) return 0;
  const { byValue, nodes } = enumerateCaptures(tableAfter);
  if (meter) meter.nodes += nodes;
  let risk = 0;
  for (let w = 1; w <= MAX_VALUE; w++) {
    let best = 0;
    for (const option of byValue[w]!) {
      const scopa = option.length === tableAfter.length && !opponentLastPlay;
      const gain = gainOf(option, scopa) + valueGain(w);
      if (gain > best) best = gain;
    }
    risk += best;
  }
  return risk;
}

/** One priced candidate. */
export interface PricedMove {
  readonly move: Move;
  readonly gain: number;
  readonly risk: number;
  /** `GAIN_SCALE × gain − risk` — the CPU plays the largest. */
  readonly price: number;
}

/**
 * Every legal move for the view's seat, priced, in canonical order (by card,
 * then by captured set). Exposed for the tests and the work-bound count.
 */
export function priceMoves(view: CpuView, meter?: WorkMeter): PricedMove[] {
  const opponent = opponentOf(view.seat);
  const ownLastPlay =
    view.hand.length === 1 && view.stockCount === 0 && view.opponentCardCount === 0;
  const opponentMoves = !(view.opponentCardCount === 0 && view.stockCount === 0);
  const opponentLastPlay =
    view.dealer === opponent && view.stockCount === 0 && view.opponentCardCount === 1;

  const { byValue, nodes } = enumerateCaptures(view.table);
  if (meter) meter.nodes += nodes;

  const priced: PricedMove[] = [];
  for (const card of view.hand) {
    const options = byValue[valueOf(card)]!;
    const candidates: readonly (readonly Card[])[] = options.length > 0 ? options : [[]];
    for (const captured of candidates) {
      const tableAfter =
        captured.length === 0
          ? [...view.table, card]
          : view.table.filter((onTable) => !captured.includes(onTable));
      const scopa = captured.length > 0 && tableAfter.length === 0 && !ownLastPlay;
      const gain = captured.length === 0 ? 0 : gainOf([card, ...captured], scopa);
      const risk = opponentMoves ? riskOf(tableAfter, opponentLastPlay, meter) : 0;
      priced.push({ move: { card, captured }, gain, risk, price: GAIN_SCALE * gain - risk });
    }
  }
  return priced;
}

/**
 * The CPU's move: the highest price, ties broken by one float drawn by the
 * caller from `${seed}:cpu:${moveCount}` — `floor(f × ties)` into the tied
 * candidates in canonical order. Null when the view holds no card.
 */
export function chooseCpuMove(view: CpuView, tieBreak: number, meter?: WorkMeter): Move | null {
  const priced = priceMoves(view, meter);
  if (priced.length === 0) return null;
  if (priced.length === 1) return priced[0]!.move;
  let best = -Infinity;
  for (const candidate of priced) if (candidate.price > best) best = candidate.price;
  const tied = priced.filter((candidate) => candidate.price === best);
  const pick = Math.min(tied.length - 1, Math.max(0, Math.floor(tieBreak * tied.length)));
  return tied[pick]!.move;
}
