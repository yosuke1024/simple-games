import type { Session, Play, HandScore } from './index';
import {
  object,
  integer,
  numbers,
  cards,
  event,
  exactKeys,
  type Card,
  type GameEvent,
} from './cards';
export interface View {
  you: number;
  turn: number;
  over: boolean;
  hand: Card[];
  counts: number[];
  trick: Play[];
  lastTrick: Play[];
  dealer: number;
  handNumber: number;
  phase: Session['phase'];
  bids: number[];
  tricks: number[];
  broken: boolean;
  scores: number[];
  bags: number[];
  lastScore: HandScore | null;
  winners: number[];
  event: GameEvent;
}
export function project(s: Session, you: number): View {
  return {
    you,
    turn: s.turn,
    over: s.status !== 'playing',
    hand: [...s.hands[you]!],
    counts: s.hands.map((h) => h.length),
    trick: s.trick.map((p) => ({ ...p })),
    lastTrick: s.lastTrick.map((p) => ({ ...p })),
    dealer: s.dealer,
    handNumber: s.handNumber,
    phase: s.phase,
    bids: [...s.bids],
    tricks: [...s.tricks],
    broken: s.broken,
    scores: [...s.scores],
    bags: [...s.bags],
    lastScore: s.lastScore
      ? {
          bids: [...s.lastScore.bids],
          tricks: [...s.lastScore.tricks],
          delta: [...s.lastScore.delta],
          bags: [...s.lastScore.bags],
        }
      : null,
    winners: [...s.winners],
    event: { ...s.event, cards: [...s.event.cards] },
  };
}
function plays(v: unknown, max: number): v is Play[] {
  return (
    Array.isArray(v) &&
    v.length <= max &&
    v.every(
      (p) =>
        object(p) && exactKeys(p, ['seat', 'card']) && integer(p.seat, 3) && integer(p.card, 51),
    ) &&
    new Set(v.map((p) => p.seat)).size === v.length &&
    cards(v.map((p) => p.card))
  );
}
export function validView(v: unknown, you?: number): v is View {
  if (
    !object(v) ||
    !exactKeys(v, [
      'you',
      'turn',
      'over',
      'hand',
      'counts',
      'trick',
      'lastTrick',
      'dealer',
      'handNumber',
      'phase',
      'bids',
      'tricks',
      'broken',
      'scores',
      'bags',
      'lastScore',
      'winners',
      'event',
    ]) ||
    !integer(v.you, 3) ||
    (you !== undefined && you !== v.you) ||
    !integer(v.turn, 3) ||
    typeof v.over !== 'boolean' ||
    !cards(v.hand) ||
    !numbers(v.counts, 4, 13) ||
    v.counts[v.you] !== v.hand.length ||
    !plays(v.trick, 3) ||
    !plays(v.lastTrick, 4) ||
    ![0, 4].includes(v.lastTrick.length) ||
    !integer(v.dealer, 3) ||
    !integer(v.handNumber, 1e6, 1) ||
    !['bid', 'play', 'hand'].includes(String(v.phase)) ||
    !numbers(v.bids, 4, 13, -1) ||
    !numbers(v.tricks, 4, 13) ||
    typeof v.broken !== 'boolean' ||
    !numbers(v.scores, 2, 1e9, -1e9) ||
    !numbers(v.bags, 2, 9) ||
    !cards(v.winners, 3) ||
    v.winners.length !== (v.over ? 2 : 0) ||
    !event(v.event, 4, 51)
  )
    return false;
  if (
    v.lastScore !== null &&
    (!object(v.lastScore) ||
      !exactKeys(v.lastScore, ['bids', 'tricks', 'delta', 'bags']) ||
      !numbers(v.lastScore.bids, 4, 13) ||
      !numbers(v.lastScore.tricks, 4, 13) ||
      !numbers(v.lastScore.delta, 2, 1000, -1000) ||
      !numbers(v.lastScore.bags, 2, 9))
  )
    return false;
  return (
    cards([...v.hand, ...v.trick.map((p) => p.card), ...v.lastTrick.map((p) => p.card)]) &&
    (!v.over || v.phase === 'hand')
  );
}
