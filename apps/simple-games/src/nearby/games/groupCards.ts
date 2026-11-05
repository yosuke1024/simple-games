import { integer, record } from '../gameTypes';
import { exactKeys } from './validation';
export const hostRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000;
export const cardList = (v: unknown, max = 52): v is number[] =>
  Array.isArray(v) &&
  v.length <= max + 1 &&
  v.every((c) => integer(c, 0, max)) &&
  new Set(v).size === v.length;
export const seatList = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length <= 4 &&
  v.every((s) => integer(s, 0, 3)) &&
  new Set(v).size === v.length;
export const fourNumbers = (v: unknown, max: number): v is number[] =>
  Array.isArray(v) && v.length === 4 && v.every((n) => integer(n, 0, max));
export interface CardEvent {
  kind: string;
  seat: number;
  cards: number[];
  from?: number;
}
export function validEvent(v: unknown): v is CardEvent {
  return (
    record(v) &&
    exactKeys(
      v,
      v.from === undefined ? ['kind', 'seat', 'cards'] : ['kind', 'seat', 'cards', 'from'],
    ) &&
    ['deal', 'play', 'pass', 'clear', 'exchange', 'draw', 'pair', 'out'].includes(String(v.kind)) &&
    integer(v.seat, 0, 3) &&
    cardList(v.cards) &&
    (v.from === undefined || integer(v.from, 0, 3))
  );
}
export function publicEvent(event: CardEvent, you: number): CardEvent {
  return { ...event, cards: event.kind === 'draw' && event.seat !== you ? [] : [...event.cards] };
}
export interface CardView {
  you: number;
  turn: number;
  hand: number[];
  counts: number[];
  order: number[];
  over: boolean;
  event: CardEvent;
}
export function cardView(v: unknown, you?: number): v is CardView {
  return (
    record(v) &&
    integer(v.you, 0, 3) &&
    (you === undefined || v.you === you) &&
    integer(v.turn, 0, 3) &&
    cardList(v.hand) &&
    fourNumbers(v.counts, 53) &&
    v.hand.length === v.counts[v.you] &&
    seatList(v.order) &&
    typeof v.over === 'boolean' &&
    validEvent(v.event)
  );
}
export const places = (order: readonly number[]) => [0, 1, 2, 3].map((s) => order.indexOf(s) + 1);
