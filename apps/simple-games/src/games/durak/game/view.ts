import { beats, tableCards, DECK, type Session, type Pair } from './index';
import {
  object,
  integer,
  numbers,
  cards,
  event,
  exactKeys,
  suitOf,
  type Card,
  type GameEvent,
} from './cards';
export interface View {
  you: number;
  turn: number;
  over: boolean;
  hand: Card[];
  counts: number[];
  trump: Card;
  stockCount: number;
  table: Pair[];
  attacker: number;
  limit: number;
  taking: boolean;
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
    trump: s.trump,
    stockCount: s.stock.length,
    table: s.table.map((p) => ({ ...p })),
    attacker: s.attacker,
    limit: s.limit,
    taking: s.taking,
    winners: [...s.winners],
    event: { ...s.event, cards: [...s.event.cards] },
  };
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
      'trump',
      'stockCount',
      'table',
      'attacker',
      'limit',
      'taking',
      'winners',
      'event',
    ]) ||
    !integer(v.you, 1) ||
    (you !== undefined && v.you !== you) ||
    !integer(v.turn, 1) ||
    typeof v.over !== 'boolean' ||
    !cards(v.hand) ||
    !numbers(v.counts, 2, 36) ||
    v.counts[v.you] !== v.hand.length ||
    !integer(v.trump, 51) ||
    !DECK.includes(v.trump) ||
    !integer(v.stockCount, 24) ||
    !integer(v.attacker, 1) ||
    !integer(v.limit, 6) ||
    typeof v.taking !== 'boolean' ||
    !cards(v.winners, 1) ||
    Boolean(v.winners.length) !== v.over ||
    !event(v.event, 2, 51) ||
    !Array.isArray(v.table) ||
    v.table.length > v.limit ||
    !v.table.every(
      (p) =>
        object(p) &&
        exactKeys(p, ['attack', 'defense']) &&
        integer(p.attack, 51) &&
        (p.defense === null ||
          (integer(p.defense, 51) && beats(p.defense, p.attack, suitOf(v.trump as Card)))),
    )
  )
    return false;
  const known = [...v.hand, ...tableCards(v.table as Pair[])];
  return (
    cards(known) &&
    known.every((c) => DECK.includes(c)) &&
    (!v.stockCount || !known.includes(v.trump))
  );
}
