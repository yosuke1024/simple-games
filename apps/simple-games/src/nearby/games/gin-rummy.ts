import { isCard, type Card } from '../../games/gin-rummy/game/cards';
import {
  applyAction,
  canDiscard,
  canKnock,
  dealHand,
  settleHand,
  type HandOutcome,
} from '../../games/gin-rummy/game/engine';
import { type HandAction, type HandState } from '../../games/gin-rummy/game/types';
import { defineGame, type Seat } from '../gameTypes';
import { cards, copy, integer, keys, record, scores, seat } from './hidden';

export interface GinFull {
  hand: HandState;
  handNumber: number;
  scores: [number, number];
  outcome: HandOutcome | null;
}
export interface GinView {
  seat: Seat;
  turn: Seat;
  handNumber: number;
  scores: [number, number];
  cards: readonly Card[];
  opponentCount: number;
  stockCount: number;
  discardTop: Card | null;
  phase: HandState['phase'];
  mustDrawStock: boolean;
  discardable: readonly Card[];
  knockable: readonly Card[];
  outcome: HandOutcome | null;
}
export type GinAction = HandAction | { kind: 'next' };
function isOutcome(x: unknown): x is HandOutcome {
  if (
    !record(x) ||
    !keys(
      x,
      'kind knocker winner points knockerDeadwood defenderDeadwood knockerMelds defenderMelds layoffs',
    ) ||
    !['gin', 'knock', 'undercut', 'dead'].includes(String(x.kind)) ||
    !(x.knocker === null || seat(x.knocker)) ||
    !(x.winner === null || seat(x.winner)) ||
    !integer(x.points, 125) ||
    !integer(x.knockerDeadwood, 100) ||
    !integer(x.defenderDeadwood, 100)
  )
    return false;
  const melds = (v: unknown) =>
    Array.isArray(v) &&
    v.length <= 3 &&
    v.every(
      (m) =>
        record(m) &&
        keys(m, 'kind cards') &&
        (m.kind === 'run' || m.kind === 'set') &&
        cards(m.cards, 51, 10) &&
        m.cards.length >= 3,
    );
  return (
    melds(x.knockerMelds) &&
    melds(x.defenderMelds) &&
    Array.isArray(x.layoffs) &&
    x.layoffs.length <= 10 &&
    x.layoffs.every(
      (l) => record(l) && keys(l, 'card meldIndex') && isCard(l.card) && integer(l.meldIndex, 2),
    ) &&
    (x.kind === 'dead'
      ? x.knocker === null && x.winner === null && x.points === 0
      : seat(x.knocker) && seat(x.winner))
  );
}
export function isGinView(x: unknown): x is GinView {
  if (
    !record(x) ||
    !keys(
      x,
      'seat turn handNumber scores cards opponentCount stockCount discardTop phase mustDrawStock discardable knockable outcome',
    ) ||
    !seat(x.seat) ||
    !seat(x.turn) ||
    !integer(x.handNumber, 1_000_000, 1) ||
    !scores(x.scores) ||
    !cards(x.cards, 51, 11) ||
    x.cards.length < 10 ||
    !integer(x.opponentCount, 11, 10) ||
    !integer(x.stockCount, 31, 2) ||
    !(x.discardTop === null || isCard(x.discardTop)) ||
    !['upcard', 'draw', 'discard', 'over'].includes(String(x.phase)) ||
    typeof x.mustDrawStock !== 'boolean' ||
    !cards(x.discardable, 51, 11) ||
    !cards(x.knockable, 51, 11)
  )
    return false;
  if (
    !x.discardable.every((c) => (x.cards as number[]).includes(c)) ||
    !x.knockable.every((c) => (x.discardable as number[]).includes(c))
  )
    return false;
  if (
    (x.turn !== x.seat || x.phase !== 'discard') &&
    (x.discardable.length > 0 || x.knockable.length > 0)
  )
    return false;
  return x.phase === 'over'
    ? x.turn === 0 && isOutcome(x.outcome)
    : x.outcome === null && x.scores.every((n) => n < 100);
}
export const adapter = defineGame<GinFull, GinView, GinAction>({
  id: 'gin-rummy',
  create: (random) => ({
    hand: dealHand('', 1, random() < 0.5 ? 0 : 1, random),
    handNumber: 1,
    scores: [0, 0],
    outcome: null,
  }),
  project: (full, local) => {
    const h = full.hand;
    const active = h.phase === 'discard' && h.turn === local;
    return copy({
      seat: local,
      turn: h.phase === 'over' ? 0 : h.turn,
      handNumber: full.handNumber,
      scores: full.scores,
      cards: h.hands[local],
      opponentCount: h.hands[local === 0 ? 1 : 0].length,
      stockCount: h.stock.length,
      discardTop: h.discard.at(-1) ?? null,
      phase: h.phase,
      mustDrawStock: h.mustDrawStock,
      discardable: active ? h.hands[local].filter((c) => canDiscard(h, c)) : [],
      knockable: active ? h.hands[local].filter((c) => canKnock(h, c)) : [],
      outcome: full.outcome,
    });
  },
  isView: isGinView,
  isAction: (x): x is GinAction =>
    record(x) &&
    ((keys(x, 'kind') &&
      ['next', 'take-upcard', 'pass-upcard', 'draw-stock', 'draw-discard'].includes(
        String(x.kind),
      )) ||
      (keys(x, 'kind card') && (x.kind === 'discard' || x.kind === 'knock') && isCard(x.card))),
  turn: (v) => v.turn,
  finished: (v) => v.scores.some((n) => n >= 100),
  apply: (full, player, action, random) => {
    if (full.scores.some((n) => n >= 100)) return null;
    if (action.kind === 'next') {
      if (player !== 0 || full.hand.phase !== 'over' || full.handNumber >= 1_000_000) return null;
      return {
        ...full,
        hand: dealHand('', full.handNumber + 1, full.outcome?.winner ?? full.hand.dealer, random),
        handNumber: full.handNumber + 1,
        outcome: null,
      };
    }
    if (full.hand.turn !== player || full.hand.phase === 'over') return null;
    const changed = applyAction(full.hand, action);
    if (!changed) return null;
    // Engine history is public, but potentially unbounded. This adapter has no CPU
    // memory consumer; retain just the latest beat, never a complete session log.
    const hand = { ...changed, log: changed.log.slice(-1) };
    const outcome = hand.phase === 'over' ? settleHand(hand) : null;
    const nextScores: [number, number] = [...full.scores];
    if (outcome?.winner !== null && outcome?.winner !== undefined)
      nextScores[outcome.winner] += outcome.points;
    return { ...full, hand, scores: nextScores, outcome };
  },
  result: (v) => ({
    scores: [...v.scores],
    winner: v.scores[0] >= 100 ? 0 : v.scores[1] >= 100 ? 1 : null,
  }),
});
