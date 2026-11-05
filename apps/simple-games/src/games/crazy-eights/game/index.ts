/** One-deal Crazy Eights. See docs/CRAZY_EIGHTS_RULES.md. */
import {
  rankOf,
  suitOf,
  shuffle,
  object,
  integer,
  numbers,
  cards,
  partition,
  event,
  outcome,
  type Card,
  type Status,
  type GameEvent,
} from './cards';
export * from './cards';
const DECK = Array.from({ length: 52 }, (_, i) => i);
export interface Session {
  seed: number;
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  suit: number;
  turn: number;
  passes: number;
  moves: number;
  elapsedSeconds: number;
  status: Status;
  winners: number[];
  penalties: number[];
  event: GameEvent;
}
export type Action =
  { kind: 'play'; card: Card; suit?: number } | { kind: 'draw' } | { kind: 'pass' };
export function createSession(seed: number, entropy?: () => number): Session {
  const deck = shuffle(DECK, seed, entropy),
    hands = Array.from({ length: 4 }, () => deck.splice(0, 5));
  const at = deck.findIndex((c) => rankOf(c) !== 8),
    top = deck.splice(at, 1)[0]!;
  return {
    seed: seed >>> 0,
    hands,
    stock: deck,
    discard: [top],
    suit: suitOf(top),
    turn: 0,
    passes: 0,
    moves: 0,
    elapsedSeconds: 0,
    status: 'playing',
    winners: [],
    penalties: [],
    event: { kind: 'deal', seat: 0, cards: [top] },
  };
}
export const penalty = (hand: readonly Card[]) =>
  hand.reduce((n, c) => n + (rankOf(c) === 8 ? 50 : Math.min(rankOf(c), 10)), 0);
export function canPlay(card: Card, top: Card, suit: number): boolean {
  return rankOf(card) === 8 || rankOf(card) === rankOf(top) || suitOf(card) === suit;
}
export interface CpuView {
  hand: Card[];
  top: Card;
  suit: number;
  drawable: boolean;
  counts: number[];
}
export const cpuView = (s: Session): CpuView => ({
  hand: [...s.hands[s.turn]!],
  top: s.discard[s.discard.length - 1]!,
  suit: s.suit,
  drawable: s.stock.length > 0 || s.discard.length > 1,
  counts: s.hands.map((h) => h.length),
});
export function legalCards(v: CpuView): Card[] {
  return v.hand.filter((c) => canPlay(c, v.top, v.suit));
}
export function step(s: Session, a: Action, entropy?: () => number): Session | null {
  if (s.status !== 'playing' || !object(a)) return null;
  const seat = s.turn,
    hand = s.hands[seat]!,
    v = cpuView(s);
  const n: Session = {
    ...s,
    hands: s.hands.map((h) => [...h]),
    stock: [...s.stock],
    discard: [...s.discard],
    moves: s.moves + 1,
  };
  if (a.kind === 'play') {
    if (
      !hand.includes(a.card) ||
      !canPlay(a.card, v.top, v.suit) ||
      (rankOf(a.card) === 8 ? !integer(a.suit, 3) : a.suit !== undefined)
    )
      return null;
    n.hands[seat] = hand.filter((c) => c !== a.card);
    n.discard.push(a.card);
    n.suit = rankOf(a.card) === 8 ? a.suit! : suitOf(a.card);
    n.passes = 0;
    n.event = { kind: 'play', seat, cards: [a.card] };
    n.turn = (seat + 1) % 4;
    if (!n.hands[seat]!.length) n.winners = [seat];
  } else if (a.kind === 'draw') {
    if (!v.drawable) return null;
    if (!n.stock.length) {
      n.stock = shuffle(
        n.discard.slice(0, -1),
        (s.seed ^ Math.imul(n.moves, 0x9e3779b9)) >>> 0,
        entropy,
      );
      n.discard = [v.top];
    }
    const c = n.stock.pop()!;
    n.hands[seat]!.push(c);
    n.passes = 0;
    // Draw events contain no private card, even on the host's public event feed.
    n.event = { kind: 'draw', seat, cards: [] };
  } else if (a.kind === 'pass') {
    if (v.drawable || legalCards(v).length) return null;
    n.passes++;
    n.turn = (seat + 1) % 4;
    n.event = { kind: 'pass', seat, cards: [] };
    if (n.passes === 4) {
      const p = n.hands.map(penalty),
        best = Math.min(...p);
      n.winners = p.flatMap((x, i) => (x === best ? [i] : []));
    }
  } else return null;
  if (n.winners.length) {
    n.status = outcome(n.winners);
    n.penalties = n.hands.map(penalty);
  }
  return n;
}
export function chooseCpuMove(v: CpuView): Action {
  const legal = legalCards(v).sort(
    (a, b) => (rankOf(a) === 8 ? -50 : penalty([a])) - (rankOf(b) === 8 ? -50 : penalty([b])),
  );
  if (!legal.length) return { kind: v.drawable ? 'draw' : 'pass' };
  const card = legal[legal.length - 1]!;
  if (rankOf(card) !== 8) return { kind: 'play', card };
  const totals = [0, 1, 2, 3].map(
    (suit) => v.hand.filter((c) => c !== card && rankOf(c) !== 8 && suitOf(c) === suit).length,
  );
  return { kind: 'play', card, suit: totals.indexOf(Math.max(...totals)) };
}
export function restore(v: unknown): Session | null {
  if (
    !object(v) ||
    !integer(v.seed, 0xffffffff) ||
    !integer(v.moves) ||
    !integer(v.elapsedSeconds, 1e12) ||
    v.status !== 'playing' ||
    !integer(v.turn, 3) ||
    !integer(v.suit, 3) ||
    !integer(v.passes, 3) ||
    !Array.isArray(v.hands) ||
    v.hands.length !== 4 ||
    !v.hands.every((h) => cards(h) && h.length > 0) ||
    !cards(v.stock) ||
    !cards(v.discard) ||
    !v.discard.length ||
    !partition([...v.hands, v.stock, v.discard], DECK) ||
    !numbers(v.winners, 0) ||
    !numbers(v.penalties, 0) ||
    !event(v.event, 4, 51)
  )
    return null;
  if (
    rankOf(v.discard[v.discard.length - 1]!) !== 8 &&
    suitOf(v.discard[v.discard.length - 1]!) !== v.suit
  )
    return null;
  return JSON.parse(JSON.stringify(v)) as Session;
}
