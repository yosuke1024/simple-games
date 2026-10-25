import { FULL_DECK, isCard, type Card } from '../../games/scopa/game/cards';
import {
  applyMove,
  applyRefill,
  dealDeal,
  phaseOf,
  seatToPlay,
  settleDeal,
  type DealOutcome,
  type Move,
} from '../../games/scopa/game/engine';
import { shuffled } from '../../games/scopa/game/rng';
import type { DealState } from '../../games/scopa/game/types';
import { defineGame, type Seat } from '../gameTypes';
import { cards, copy, integer, keys, pair, record, scores, seat } from './hidden';

export interface ScopaFull {
  deal: DealState;
  dealNumber: number;
  scores: [number, number];
  outcome: DealOutcome | null;
}
export interface ScopaView {
  seat: Seat;
  turn: Seat;
  dealer: Seat;
  dealNumber: number;
  scores: [number, number];
  hand: readonly Card[];
  opponentCount: number;
  stockCount: number;
  table: readonly Card[];
  captured: readonly [readonly Card[], readonly Card[]];
  scopas: readonly [number, number];
  phase: 'play' | 'refill' | 'over';
  outcome: DealOutcome | null;
}
export type ScopaAction =
  { kind: 'play'; card: Card; captured: readonly Card[] } | { kind: 'next' | 'refill' };
const tally = (x: unknown): boolean =>
  record(x) &&
  keys(x, 'best suits total') &&
  Array.isArray(x.best) &&
  x.best.length === 4 &&
  x.best.every((n) => n === null || isCard(n)) &&
  integer(x.suits, 4) &&
  integer(x.total, 84);
function isOutcome(x: unknown): x is DealOutcome {
  return (
    record(x) &&
    keys(x, 'cards diamonds primiera scopas awards points sweep') &&
    pair(x.cards, (n): n is number => integer(n, 40)) &&
    pair(x.diamonds, (n): n is number => integer(n, 10)) &&
    Array.isArray(x.primiera) &&
    x.primiera.length === 2 &&
    x.primiera.every(tally) &&
    pair(x.scopas, (n): n is number => integer(n, 18)) &&
    pair(x.points, (n): n is number => integer(n, 22)) &&
    record(x.awards) &&
    keys(x.awards, 'cards diamonds settebello primiera') &&
    Object.values(x.awards).every((v) => v === null || seat(v)) &&
    (x.sweep === null ||
      (record(x.sweep) &&
        keys(x.sweep, 'seat cards') &&
        seat(x.sweep.seat) &&
        cards(x.sweep.cards, 39, 13)))
  );
}
export function isScopaView(x: unknown): x is ScopaView {
  if (
    !record(x) ||
    !keys(
      x,
      'seat turn dealer dealNumber scores hand opponentCount stockCount table captured scopas phase outcome',
    ) ||
    !seat(x.seat) ||
    !seat(x.turn) ||
    !seat(x.dealer) ||
    !integer(x.dealNumber, 1_000_000, 1) ||
    !scores(x.scores) ||
    !cards(x.hand, 39, 3) ||
    !integer(x.opponentCount, 3) ||
    !integer(x.stockCount, 30) ||
    !cards(x.table, 39, 13) ||
    !pair(x.captured, (v): v is number[] => cards(v, 39, 40)) ||
    !pair(x.scopas, (v): v is number => integer(v, 18))
  )
    return false;
  const exposed = [...x.hand, ...x.table, ...x.captured[0], ...x.captured[1]];
  if (
    new Set(exposed).size !== exposed.length ||
    exposed.length + x.opponentCount + x.stockCount !== 40
  )
    return false;
  return x.phase === 'over'
    ? x.turn === 0 &&
        x.hand.length === 0 &&
        x.opponentCount === 0 &&
        x.stockCount === 0 &&
        isOutcome(x.outcome)
    : (x.phase === 'play' ||
        (x.phase === 'refill' &&
          x.turn === 0 &&
          x.hand.length === 0 &&
          x.opponentCount === 0 &&
          x.stockCount > 0)) &&
        x.outcome === null;
}
const won = (scores: readonly number[]): Seat | null =>
  scores[0]! >= 11 && scores[0]! > scores[1]!
    ? 0
    : scores[1]! >= 11 && scores[1]! > scores[0]!
      ? 1
      : null;
export const adapter = defineGame<ScopaFull, ScopaView, ScopaAction>({
  id: 'scopa',
  create: (random) => ({
    deal: dealDeal('', 1, random() < 0.5 ? 0 : 1, () => shuffled(FULL_DECK, random)),
    dealNumber: 1,
    scores: [0, 0],
    outcome: null,
  }),
  project: (full, local) =>
    copy({
      seat: local,
      turn: seatToPlay(full.deal) ?? 0,
      dealer: full.deal.dealer,
      dealNumber: full.dealNumber,
      scores: full.scores,
      hand: full.deal.hands[local],
      opponentCount: full.deal.hands[local === 0 ? 1 : 0].length,
      stockCount: full.deal.stock.length,
      table: full.deal.table,
      captured: full.deal.captured,
      scopas: full.deal.scopas,
      phase: phaseOf(full.deal),
      outcome: full.outcome,
    }),
  isView: isScopaView,
  isAction: (x): x is ScopaAction =>
    record(x) &&
    ((keys(x, 'kind') && (x.kind === 'next' || x.kind === 'refill')) ||
      (keys(x, 'kind card captured') &&
        x.kind === 'play' &&
        isCard(x.card) &&
        cards(x.captured, 39, 6))),
  turn: (v) => v.turn,
  finished: (v) => v.phase === 'over' && won(v.scores) !== null,
  apply: (full, player, action, random) => {
    if (won(full.scores) !== null) return null;
    if (action.kind === 'next') {
      if (player !== 0 || full.outcome === null || full.dealNumber >= 1_000_000) return null;
      return {
        ...full,
        deal: dealDeal('', full.dealNumber + 1, full.deal.dealer === 0 ? 1 : 0, () =>
          shuffled(FULL_DECK, random),
        ),
        dealNumber: full.dealNumber + 1,
        outcome: null,
      };
    }
    if (action.kind === 'refill') {
      if (player !== 0) return null;
      const deal = applyRefill(full.deal);
      return deal ? { ...full, deal } : null;
    }
    if (seatToPlay(full.deal) !== player) return null;
    const deal = applyMove(full.deal, action as Move);
    if (!deal) return null;
    const outcome = settleDeal(deal);
    return {
      ...full,
      deal,
      outcome,
      scores: outcome
        ? [full.scores[0] + outcome.points[0], full.scores[1] + outcome.points[1]]
        : full.scores,
    };
  },
  result: (v) => ({ scores: [...v.scores], winner: v.phase === 'over' ? won(v.scores) : null }),
});
