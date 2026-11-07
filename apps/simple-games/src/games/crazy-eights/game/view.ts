import type { Session } from './index';
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
  top: Card;
  suit: number;
  drawable: boolean;
  passes: number;
  winners: number[];
  penalties: number[];
  event: GameEvent;
}
export function project(s: Session, you: number): View {
  return {
    you,
    turn: s.turn,
    over: s.status !== 'playing',
    hand: [...s.hands[you]!],
    counts: s.hands.map((h) => h.length),
    top: s.discard[s.discard.length - 1]!,
    suit: s.suit,
    drawable: s.stock.length > 0 || s.discard.length > 1,
    passes: s.passes,
    winners: [...s.winners],
    penalties: [...s.penalties],
    event: { ...s.event, cards: [...s.event.cards] },
  };
}
export function validView(v: unknown, you?: number): v is View {
  return (
    object(v) &&
    exactKeys(v, [
      'you',
      'turn',
      'over',
      'hand',
      'counts',
      'top',
      'suit',
      'drawable',
      'passes',
      'winners',
      'penalties',
      'event',
    ]) &&
    integer(v.you, 3) &&
    (you === undefined || v.you === you) &&
    integer(v.turn, 3) &&
    typeof v.over === 'boolean' &&
    cards(v.hand) &&
    numbers(v.counts, 4, 51) &&
    v.counts[v.you] === v.hand.length &&
    integer(v.top, 51) &&
    !v.hand.includes(v.top) &&
    integer(v.suit, 3) &&
    typeof v.drawable === 'boolean' &&
    integer(v.passes, 4) &&
    cards(v.winners, 3) &&
    numbers(v.penalties, v.over ? 4 : 0, 508) &&
    Boolean(v.winners.length) === v.over &&
    event(v.event, 4, 51)
  );
}
