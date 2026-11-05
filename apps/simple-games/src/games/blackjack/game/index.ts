/** Four independent players against an automatic dealer. See BLACKJACK_RULES.md. */
import {
  rankOf,
  shuffle,
  object,
  integer,
  numbers,
  cards,
  partition,
  event,
  type Card,
  type Status,
  type GameEvent,
} from './cards';
export * from './cards';
const DECK = Array.from({ length: 312 }, (_, i) => i);
export interface Hand {
  cards: Card[];
  stake: 10 | 20;
  split: boolean;
  splitAces: boolean;
  status: 'playing' | 'stand' | 'bust';
  payout: number | null;
}
export interface Session {
  seed: number;
  hands: Hand[][];
  dealer: Card[];
  shoe: Card[];
  turn: number;
  handIndex: number;
  scores: number[];
  moves: number;
  elapsedSeconds: number;
  status: Status;
  event: GameEvent;
}
export type Action = { kind: 'hit' | 'stand' | 'double' | 'split' };
export function total(hand: readonly Card[]): { value: number; soft: boolean } {
  let value = hand.reduce((n, c) => n + Math.min(rankOf(c), 10), 0);
  const soft = hand.some((c) => rankOf(c) === 1) && value + 10 <= 21;
  if (soft) value += 10;
  return { value, soft };
}
export const natural = (h: Hand) => !h.split && h.cards.length === 2 && total(h.cards).value === 21;
function newHand(cs: Card[], split = false, splitAces = false): Hand {
  return {
    cards: cs,
    stake: 10,
    split,
    splitAces,
    status: splitAces || total(cs).value === 21 ? 'stand' : 'playing',
    payout: null,
  };
}
function settle(s: Session): void {
  const dealerNatural = s.dealer.length === 2 && total(s.dealer).value === 21;
  if (!dealerNatural && s.hands.flat().some((h) => h.status !== 'bust' && !natural(h)))
    while (total(s.dealer).value < 17) s.dealer.push(s.shoe.pop()!);
  const d = total(s.dealer).value;
  for (const h of s.hands.flat()) {
    const p = total(h.cards).value;
    h.payout =
      h.status === 'bust'
        ? -h.stake
        : dealerNatural
          ? natural(h)
            ? 0
            : -h.stake
          : natural(h)
            ? 15
            : d > 21 || p > d
              ? h.stake
              : p === d
                ? 0
                : -h.stake;
    if (h.status === 'playing') h.status = 'stand';
  }
  s.scores = s.hands.map((hs) => hs.reduce((n, h) => n + h.payout!, 0));
  s.status = s.scores[0]! > 0 ? 'won' : s.scores[0]! < 0 ? 'lost' : 'draw';
  s.turn = 0;
  s.handIndex = 0;
  s.event = { kind: 'settled', seat: 0, cards: [...s.dealer] };
}
function advance(s: Session): void {
  for (let p = s.turn; p < 4; p++)
    for (let i = p === s.turn ? s.handIndex : 0; i < s.hands[p]!.length; i++)
      if (s.hands[p]![i]!.status === 'playing') {
        s.turn = p;
        s.handIndex = i;
        return;
      }
  settle(s);
}
export function createSession(seed: number, entropy?: () => number): Session {
  const shoe = shuffle(DECK, seed, entropy),
    dealt = Array.from({ length: 4 }, () => [] as Card[]),
    dealer: Card[] = [];
  for (let round = 0; round < 2; round++) {
    for (const hand of dealt) hand.push(shoe.pop()!);
    dealer.push(shoe.pop()!);
  }
  const s: Session = {
    seed: seed >>> 0,
    hands: dealt.map((h) => [newHand(h)]),
    dealer,
    shoe,
    turn: 0,
    handIndex: 0,
    scores: [],
    moves: 0,
    elapsedSeconds: 0,
    status: 'playing',
    event: { kind: 'deal', seat: 0, cards: [dealer[0]!] },
  };
  if (total(dealer).value === 21) settle(s);
  else advance(s);
  return s;
}
export interface CpuView {
  hand: Hand;
  handCount: number;
  upcard: Card;
}
export const cpuView = (s: Session): CpuView => ({
  hand: { ...s.hands[s.turn]![s.handIndex]!, cards: [...s.hands[s.turn]![s.handIndex]!.cards] },
  handCount: s.hands[s.turn]!.length,
  upcard: s.dealer[0]!,
});
export function canDouble(v: CpuView): boolean {
  return v.hand.status === 'playing' && v.hand.cards.length === 2 && !v.hand.splitAces;
}
export function canSplit(v: CpuView): boolean {
  return canDouble(v) && v.handCount < 4 && rankOf(v.hand.cards[0]!) === rankOf(v.hand.cards[1]!);
}
export function step(s: Session, a: Action): Session | null {
  if (s.status !== 'playing' || !object(a) || !['hit', 'stand', 'double', 'split'].includes(a.kind))
    return null;
  const v = cpuView(s);
  if (
    v.hand.status !== 'playing' ||
    (a.kind === 'double' && !canDouble(v)) ||
    (a.kind === 'split' && !canSplit(v))
  )
    return null;
  const n: Session = {
      ...s,
      hands: s.hands.map((hs) => hs.map((h) => ({ ...h, cards: [...h.cards] }))),
      dealer: [...s.dealer],
      shoe: [...s.shoe],
      moves: s.moves + 1,
      event: { kind: a.kind, seat: s.turn, cards: [] },
    },
    h = n.hands[s.turn]![s.handIndex]!;
  if (a.kind === 'stand') h.status = 'stand';
  else if (a.kind === 'split') {
    const aces = rankOf(h.cards[0]!) === 1;
    n.hands[s.turn]!.splice(
      s.handIndex,
      1,
      newHand([h.cards[0]!, n.shoe.pop()!], true, aces),
      newHand([h.cards[1]!, n.shoe.pop()!], true, aces),
    );
  } else {
    h.cards.push(n.shoe.pop()!);
    if (a.kind === 'double') h.stake = 20;
    const value = total(h.cards).value;
    h.status = value > 21 ? 'bust' : value === 21 || a.kind === 'double' ? 'stand' : 'playing';
  }
  advance(n);
  return n;
}
export function chooseCpuMove(v: CpuView): Action {
  const { value, soft } = total(v.hand.cards),
    d = Math.min(rankOf(v.upcard), 10),
    r = rankOf(v.hand.cards[0]!);
  if (
    canSplit(v) &&
    (r === 1 ||
      r === 8 ||
      (r === 9 && d !== 7 && d !== 10 && d !== 1) ||
      (r === 7 && d <= 7 && d >= 2) ||
      ([2, 3, 6].includes(r) && d <= 6 && d >= 2))
  )
    return { kind: 'split' };
  if (soft) {
    if (
      canDouble(v) &&
      ((value <= 17 && value >= 13 && d >= 4 && d <= 6) || (value === 18 && d >= 3 && d <= 6))
    )
      return { kind: 'double' };
    return { kind: value >= 19 || (value === 18 && d >= 2 && d <= 8) ? 'stand' : 'hit' };
  }
  if (
    canDouble(v) &&
    ((value === 11 && d !== 1) ||
      (value === 10 && d >= 2 && d <= 9) ||
      (value === 9 && d >= 3 && d <= 6))
  )
    return { kind: 'double' };
  return {
    kind:
      value >= 17 || (value >= 13 && d >= 2 && d <= 6) || (value === 12 && d >= 4 && d <= 6)
        ? 'stand'
        : 'hit',
  };
}
export function restore(v: unknown): Session | null {
  if (
    !object(v) ||
    !integer(v.seed, 0xffffffff) ||
    !integer(v.moves) ||
    !integer(v.elapsedSeconds, 1e12) ||
    v.status !== 'playing' ||
    !integer(v.turn, 3) ||
    !integer(v.handIndex, 3) ||
    !cards(v.shoe, 311) ||
    !cards(v.dealer, 311) ||
    v.dealer.length !== 2 ||
    total(v.dealer).value === 21 ||
    !numbers(v.scores, 0) ||
    !event(v.event, 4, 311) ||
    !Array.isArray(v.hands) ||
    v.hands.length !== 4 ||
    !v.hands.every(
      (hs) =>
        Array.isArray(hs) &&
        hs.length >= 1 &&
        hs.length <= 4 &&
        hs.every(
          (h) =>
            object(h) &&
            cards(h.cards, 311) &&
            h.cards.length >= 2 &&
            (h.stake === 10 || h.stake === 20) &&
            typeof h.split === 'boolean' &&
            typeof h.splitAces === 'boolean' &&
            ['playing', 'stand', 'bust'].includes(String(h.status)) &&
            h.payout === null,
        ),
    )
  )
    return null;
  const hands = v.hands as Hand[][];
  if (
    !partition([...hands.flat().map((h) => h.cards), v.dealer, v.shoe], DECK) ||
    !hands[v.turn]![v.handIndex] ||
    hands[v.turn]![v.handIndex]!.status !== 'playing'
  )
    return null;
  for (let p = 0; p < 4; p++)
    for (let i = 0; i < hands[p]!.length; i++) {
      const h = hands[p]![i]!,
        value = total(h.cards).value;
      if (
        (h.status === 'bust') !== value > 21 ||
        (h.status === 'playing' && value >= 21) ||
        (h.stake === 20 && (h.cards.length !== 3 || h.status === 'playing')) ||
        (h.splitAces &&
          (!h.split ||
            h.cards.length !== 2 ||
            rankOf(h.cards[0]!) !== 1 ||
            h.status !== 'stand')) ||
        h.split !== hands[p]!.length > 1 ||
        ((p < v.turn || (p === v.turn && i < v.handIndex)) && h.status === 'playing')
      )
        return null;
    }
  return JSON.parse(JSON.stringify(v)) as Session;
}
