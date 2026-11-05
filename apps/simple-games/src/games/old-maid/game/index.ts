/** Joker Old Maid (Japanese baba-nuki); docs/OLD_MAID_RULES.md. */
import {
  SEATS,
  deal,
  rankOf,
  shuffled,
  random,
  isObject,
  integer,
  cardArray,
  seats,
  partition,
  isSeat,
  type Card,
  type Seat,
  type GameEvent,
} from './cards';
export * from './cards';
export interface Session {
  seed: number;
  hands: Card[][];
  discard: Card[];
  turn: Seat;
  order: Seat[];
  status: 'playing' | 'won' | 'lost';
  moves: number;
  elapsedSeconds: number;
  event: GameEvent;
}
export type Action = { kind: 'draw'; index: number };
function removePairs(cards: Card[]): { hand: Card[]; pairs: Card[] } {
  const hand: Card[] = [],
    pairs: Card[] = [];
  for (const c of cards) {
    const i = c === 52 ? -1 : hand.findIndex((x) => x !== 52 && rankOf(x) === rankOf(c));
    if (i < 0) hand.push(c);
    else pairs.push(hand.splice(i, 1)[0]!, c);
  }
  return { hand, pairs };
}
export function sourceSeat(s: Pick<Session, 'turn' | 'hands'>): Seat {
  for (let d = 1; d <= 3; d++) {
    const p = ((s.turn + d) % 4) as Seat;
    if (s.hands[p]!.length) return p;
  }
  return s.turn;
}
function settle(s: Session, multiplayer = false): Session {
  const active = SEATS.filter((p) => s.hands[p]!.length);
  if (!multiplayer && !s.hands[0]!.length) return { ...s, status: 'won' };
  if (active.length === 1)
    return { ...s, status: active[0] === 0 ? 'lost' : 'won', order: [...s.order, active[0]!] };
  if (!s.hands[s.turn]!.length) {
    for (let d = 1; d <= 4; d++) {
      const p = ((s.turn + d) % 4) as Seat;
      if (s.hands[p]!.length) {
        s = { ...s, turn: p };
        break;
      }
    }
  }
  return s;
}
export function createSession(seed: number, entropy?: () => number, multiplayer = false): Session {
  const dealt = deal(53, seed, entropy).map(removePairs),
    hands = dealt.map((p) => p.hand);
  return settle(
    {
      seed: seed >>> 0,
      hands,
      discard: dealt.flatMap((p) => p.pairs),
      turn: 0,
      order: SEATS.filter((p) => !hands[p]!.length),
      status: 'playing',
      moves: 0,
      elapsedSeconds: 0,
      event: { kind: 'deal', seat: 0, cards: [] },
    },
    multiplayer,
  );
}
export function act(
  s: Session,
  a: Action,
  entropy?: () => number,
  multiplayer = false,
): Session | null {
  if (s.status !== 'playing' || !isObject(a) || a.kind !== 'draw') return null;
  const from = sourceSeat(s),
    hand = s.hands[from]!;
  if (from === s.turn || !integer(a.index, hand.length - 1)) return null;
  const card = hand[a.index]!,
    seat = s.turn,
    hands = s.hands.map((h) => [...h]);
  hands[from]!.splice(a.index, 1);
  const paired = removePairs([...hands[seat]!, card]);
  hands[seat] = paired.hand;
  const order = [...s.order];
  // The source empties as its card is drawn, then the drawing player discards a possible pair.
  for (const p of [from, seat]) if (!hands[p]!.length && !order.includes(p)) order.push(p);
  const nextMove = s.moves + 1;
  for (const p of SEATS)
    hands[p] = shuffled(
      hands[p]!,
      (s.seed ^ Math.imul(nextMove, 0x9e3779b9) ^ Math.imul(p + 1, 0x85ebca6b)) >>> 0,
      entropy,
    );
  const next: Session = {
    ...s,
    hands,
    discard: [...s.discard, ...paired.pairs],
    order,
    turn: ((seat + 1) % 4) as Seat,
    moves: nextMove,
    event: {
      kind: paired.pairs.length ? 'pair' : 'draw',
      seat,
      from,
      cards: paired.pairs.length ? paired.pairs : multiplayer || seat === 0 ? [card] : [],
    },
  };
  return settle(next, multiplayer);
}
/** Only a count and fresh deterministic randomness; no private cards enter the CPU's choice. */
export interface CpuView {
  count: number;
  randomSeed: number;
}
export function cpuView(s: Session): CpuView {
  return {
    count: s.hands[sourceSeat(s)]!.length,
    randomSeed: (s.seed ^ Math.imul(s.moves + 1, 0x27d4eb2d)) >>> 0,
  };
}
export function chooseCpuMove(v: CpuView): Action {
  return { kind: 'draw', index: Math.floor(random(v.randomSeed)() * v.count) };
}
export const resultPlace = (s: Session) => s.order.indexOf(0) + 1;
export function restore(raw: unknown): Session | null {
  if (
    !isObject(raw) ||
    !integer(raw.seed, 0xffffffff) ||
    !integer(raw.moves, 1e9) ||
    !integer(raw.elapsedSeconds, 1e12) ||
    !isSeat(raw.turn) ||
    raw.status !== 'playing' ||
    !seats(raw.order) ||
    raw.order.includes(0) ||
    !cardArray(raw.discard, 53) ||
    raw.discard.includes(52) ||
    !partition(raw.hands, [raw.discard], 53) ||
    !raw.hands[0]!.length ||
    !raw.hands[raw.turn]!.length ||
    raw.hands.filter((h) => h.length).length < 2
  )
    return null;
  for (const p of SEATS) {
    const h = raw.hands[p]!;
    if (
      !h.length !== raw.order.includes(p) ||
      new Set(h.filter((c) => c !== 52).map(rankOf)).size !== h.filter((c) => c !== 52).length
    )
      return null;
  }
  for (let rank = 1; rank <= 13; rank++)
    if (raw.discard.filter((c) => rankOf(c) === rank).length % 2) return null;
  return { ...raw, event: { kind: 'deal', seat: raw.turn, cards: [] } } as unknown as Session;
}
