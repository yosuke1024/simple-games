/** The compact house rules in docs/DAIFUGO_RULES.md; this is not the federation ruleset. */
import {
  SEATS,
  deal,
  rankOf,
  isObject,
  integer,
  cardArray,
  seats,
  partition,
  isSeat,
  random,
  type Card,
  type Seat,
  type GameEvent,
} from './cards';
export * from './cards';
export interface Session {
  seed: number;
  hands: Card[][];
  discard: Card[];
  table: Card[];
  turn: Seat;
  leader: Seat;
  passed: Seat[];
  order: Seat[];
  previousOrder: Seat[];
  revolution: boolean;
  phase: 'exchange' | 'play';
  status: 'playing' | 'won' | 'lost';
  moves: number;
  elapsedSeconds: number;
  event: GameEvent;
}
export type Action =
  { kind: 'play'; cards: Card[] } | { kind: 'pass' } | { kind: 'exchange'; cards: Card[] };
export const power = (card: Card, revolution = false) =>
  card === 52 ? 20 : revolution ? 12 - ((rankOf(card) + 10) % 13) : (rankOf(card) + 10) % 13;
export const sortedHand = (cards: readonly Card[], revolution = false) =>
  [...cards].sort((a, b) => power(a, revolution) - power(b, revolution) || a - b);
export function group(cards: readonly Card[]): { rank: number; count: number } | null {
  if (
    !cards.length ||
    cards.length > 4 ||
    new Set(cards).size !== cards.length ||
    !cards.every((c) => integer(c, 52))
  )
    return null;
  const ordinary = cards.filter((c) => c !== 52),
    rank = ordinary.length ? rankOf(ordinary[0]!) : 0;
  return ordinary.every((c) => rankOf(c) === rank) ? { rank, count: cards.length } : null;
}
export function beats(
  cards: readonly Card[],
  table: readonly Card[],
  revolution: boolean,
): boolean {
  const g = group(cards),
    previous = group(table);
  if (!g || (previous && g.count !== previous.count)) return false;
  if (!previous) return true;
  if (table.length === 1 && table[0] === 52) return cards.length === 1 && cards[0] === 2;
  if (cards.length === 1 && cards[0] === 52) return true;
  return (
    power(
      cards.find((c) => c !== 52)!,
      revolution,
    ) >
    power(
      table.find((c) => c !== 52)!,
      revolution,
    )
  );
}
const nextSeat = (s: Session, after: Seat, allowPassed = false): Seat => {
  for (let d = 1; d <= 4; d++) {
    const seat = ((after + d) % 4) as Seat;
    if (s.hands[seat]!.length && (allowPassed || !s.passed.includes(seat))) return seat;
  }
  return after;
};
export function exchangeCount(s: Session): number {
  const position = s.previousOrder.indexOf(0);
  return s.phase === 'exchange' && position >= 0 && position < 2 ? 2 - position : 0;
}
function exchanged(s: Session, chosen: Card[] | null): Session {
  const hands = s.hands.map((h) => [...h]);
  for (let place = 0; place < 2; place++) {
    const high = s.previousOrder[place]!,
      low = s.previousOrder[3 - place]!,
      count = 2 - place;
    const give = high === 0 && chosen ? chosen : sortedHand(s.hands[high]!).slice(0, count);
    const take = sortedHand(s.hands[low]!).slice(-count);
    hands[high] = [...hands[high]!.filter((c) => !give.includes(c)), ...take];
    hands[low] = [...hands[low]!.filter((c) => !take.includes(c)), ...give];
  }
  return {
    ...s,
    hands,
    phase: 'play',
    turn: s.previousOrder[3]!,
    leader: s.previousOrder[3]!,
    event: { kind: 'exchange', seat: 0, cards: [] },
  };
}
export function createSession(seed: number, previousOrder: Seat[] = []): Session {
  const hands = deal(53, seed),
    first = hands.findIndex((h) => h.includes(28)) as Seat;
  let s: Session = {
    seed: seed >>> 0,
    hands,
    discard: [],
    table: [],
    turn: first,
    leader: first,
    passed: [],
    order: [],
    previousOrder: [...previousOrder],
    revolution: false,
    phase: 'play',
    status: 'playing',
    moves: 0,
    elapsedSeconds: 0,
    event: { kind: 'deal', seat: first, cards: [] },
  };
  if (previousOrder.length === 4) {
    if (previousOrder.indexOf(0) < 2) s = { ...s, phase: 'exchange', turn: 0 };
    else s = exchanged(s, null);
  }
  return s;
}
export function legalGroups(
  hand: readonly Card[],
  table: readonly Card[],
  revolution: boolean,
): Card[][] {
  const groups: Card[][] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const cards = hand.filter((c) => c !== 52 && rankOf(c) === rank);
    for (let mask = 1; mask < 1 << cards.length; mask++) {
      const chosen = cards.filter((_, i) => mask & (1 << i));
      if (beats(chosen, table, revolution)) groups.push(chosen);
      if (hand.includes(52) && chosen.length < 4 && beats([...chosen, 52], table, revolution))
        groups.push([...chosen, 52]);
    }
  }
  if (hand.includes(52) && beats([52], table, revolution)) groups.push([52]);
  return groups;
}
function step(s: Session, action: Action): Session | null {
  if (s.status !== 'playing' || !isObject(action)) return null;
  if (s.phase === 'exchange') {
    const n = exchangeCount(s);
    if (
      action.kind !== 'exchange' ||
      !cardArray(action.cards, 53) ||
      action.cards.length !== n ||
      !action.cards.every((c) => s.hands[0]!.includes(c))
    )
      return null;
    return { ...exchanged(s, action.cards), moves: s.moves + 1 };
  }
  const seat = s.turn,
    hand = s.hands[seat]!;
  if (!hand.length || s.passed.includes(seat)) return null;
  const next: Session = {
    ...s,
    hands: s.hands.map((h) => [...h]),
    passed: [...s.passed],
    order: [...s.order],
    discard: [...s.discard],
    moves: s.moves + 1,
  };
  let clear = false;
  if (action.kind === 'pass') {
    if (!s.table.length) return null;
    next.passed.push(seat);
    next.event = { kind: 'pass', seat, cards: [] };
  } else if (action.kind === 'play') {
    if (
      !cardArray(action.cards, 53) ||
      !action.cards.every((c) => hand.includes(c)) ||
      !beats(action.cards, s.table, s.revolution)
    )
      return null;
    next.hands[seat] = hand.filter((c) => !action.cards.includes(c));
    next.discard.push(...s.table);
    next.table = [...action.cards];
    next.leader = seat;
    const g = group(action.cards)!;
    if (g.count === 4) next.revolution = !s.revolution;
    clear = g.rank === 8 || (s.table.length === 1 && s.table[0] === 52 && action.cards[0] === 2);
    next.event = { kind: clear ? 'clear' : 'play', seat, cards: [...action.cards] };
    if (!next.hands[seat]!.length) next.order.push(seat);
  } else return null;
  const remaining = SEATS.filter((p) => next.hands[p]!.length);
  if (remaining.length <= 1) {
    next.order.push(...remaining);
    next.status = next.order[0] === 0 ? 'won' : 'lost';
    return next;
  }
  if (clear || remaining.every((p) => p === next.leader || next.passed.includes(p))) {
    next.discard.push(...next.table);
    next.table = [];
    next.passed = [];
    next.turn = next.hands[next.leader]!.length ? next.leader : nextSeat(next, next.leader, true);
  } else next.turn = nextSeat(next, seat);
  return next;
}
export interface CpuView {
  hand: Card[];
  table: Card[];
  revolution: boolean;
  counts: number[];
  turn: Seat;
  randomSeed: number;
}
export function cpuView(s: Session): CpuView {
  return {
    hand: [...s.hands[s.turn]!],
    table: [...s.table],
    revolution: s.revolution,
    counts: s.hands.map((h) => h.length),
    turn: s.turn,
    randomSeed: (s.seed ^ Math.imul(s.moves + 1, 0x9e3779b9)) >>> 0,
  };
}
export function chooseCpuMove(v: CpuView): Action {
  const options = legalGroups(v.hand, v.table, v.revolution);
  if (!options.length) return { kind: 'pass' };
  const urgent = v.counts.some((n, p) => p !== v.turn && n > 0 && n <= 2),
    rng = random(v.randomSeed);
  const scored = options.map((cards) => ({
    cards,
    score:
      cards.length * 12 -
      power(cards.find((c) => c !== 52) ?? 52, v.revolution) * 0.65 -
      (cards.includes(52) ? 10 : 0) +
      (cards.some((c) => c !== 52 && rankOf(c) === 8) ? (urgent ? 8 : -3) : 0) +
      (cards.length === v.hand.length ? 1000 : 0) +
      rng() * 0.25,
  }));
  scored.sort((a, b) => b.score - a.score);
  return { kind: 'play', cards: scored[0]!.cards };
}
export function act(s: Session, action: Action): Session | null {
  let next = step(s, action);
  if (!next) return null;
  // Once the player's place is known, settle only the remaining CPU hands without a spectator wait.
  if (next.order.includes(0))
    for (let i = 0; i < 300 && next.status === 'playing'; i++) {
      const moved = step(next, chooseCpuMove(cpuView(next)));
      if (!moved) break;
      next = moved;
    }
  return next;
}
export const resultPlace = (s: Session) => s.order.indexOf(0) + 1;
export function restore(raw: unknown): Session | null {
  if (
    !isObject(raw) ||
    !integer(raw.seed, 0xffffffff) ||
    !integer(raw.moves, 1e9) ||
    !integer(raw.elapsedSeconds, 1e12) ||
    !isSeat(raw.turn) ||
    !isSeat(raw.leader) ||
    !seats(raw.passed) ||
    !seats(raw.order) ||
    !seats(raw.previousOrder) ||
    (raw.previousOrder.length !== 0 && raw.previousOrder.length !== 4) ||
    typeof raw.revolution !== 'boolean' ||
    !['play', 'exchange'].includes(String(raw.phase)) ||
    raw.status !== 'playing' ||
    !cardArray(raw.discard, 53) ||
    !cardArray(raw.table, 53) ||
    !partition(raw.hands, [raw.discard, raw.table], 53)
  )
    return null;
  const order = raw.order;
  if (
    raw.order.length > 2 ||
    raw.order.includes(0) ||
    raw.hands.some((h, p) => !h.length !== order.includes(p as Seat)) ||
    raw.passed.some((p) => order.includes(p)) ||
    (raw.table.length > 0 && !group(raw.table))
  )
    return null;
  if (raw.phase === 'exchange') {
    if (
      raw.previousOrder.length !== 4 ||
      raw.previousOrder.indexOf(0) > 1 ||
      raw.turn !== 0 ||
      raw.moves !== 0 ||
      raw.table.length ||
      raw.discard.length ||
      raw.order.length ||
      raw.passed.length ||
      raw.revolution
    )
      return null;
  } else if (
    !raw.hands[raw.turn]!.length ||
    raw.passed.includes(raw.turn) ||
    (!raw.table.length && raw.passed.length)
  )
    return null;
  return { ...raw, event: { kind: 'deal', seat: raw.turn, cards: [] } } as unknown as Session;
}
