/** Seven-outwards play; see docs/SEVENS_RULES.md. */
import {
  SEATS,
  deal,
  rankOf,
  suitOf,
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
  table: Card[];
  turn: Seat;
  passes: number[];
  finished: Seat[];
  eliminated: Seat[];
  order: Seat[];
  status: 'playing' | 'won' | 'lost';
  moves: number;
  elapsedSeconds: number;
  event: GameEvent;
}
export type Action = { kind: 'play'; card: Card } | { kind: 'pass' };
export function createSession(seed: number, entropy?: () => number): Session {
  const dealt = deal(52, seed, entropy),
    turn = dealt.findIndex((h) => h.includes(32)) as Seat;
  return {
    seed: seed >>> 0,
    hands: dealt.map((h) => h.filter((c) => rankOf(c) !== 7)),
    table: [6, 19, 32, 45],
    turn,
    passes: [0, 0, 0, 0],
    finished: [],
    eliminated: [],
    order: [],
    status: 'playing',
    moves: 0,
    elapsedSeconds: 0,
    event: { kind: 'deal', seat: turn, cards: [] },
  };
}
export function canPlay(card: Card, table: readonly Card[]): boolean {
  if (!integer(card, 51) || table.includes(card)) return false;
  const rank = rankOf(card),
    suit = suitOf(card);
  for (let r = Math.min(rank + 1, 7); r <= Math.max(rank - 1, 7); r++)
    if (!table.includes(suit * 13 + r - 1)) return false;
  return true;
}
export const legalCards = (s: Pick<Session, 'hands' | 'turn' | 'table'>) =>
  s.hands[s.turn]!.filter((c) => canPlay(c, s.table));
export function step(s: Session, a: Action): Session | null {
  if (s.status !== 'playing' || !isObject(a)) return null;
  const seat = s.turn,
    hand = s.hands[seat]!;
  if (!hand.length) return null;
  const next: Session = {
    ...s,
    hands: s.hands.map((h) => [...h]),
    table: [...s.table],
    passes: [...s.passes],
    finished: [...s.finished],
    eliminated: [...s.eliminated],
    moves: s.moves + 1,
  };
  if (a.kind === 'play') {
    if (!hand.includes(a.card) || !canPlay(a.card, s.table)) return null;
    next.hands[seat] = hand.filter((c) => c !== a.card);
    next.table.push(a.card);
    next.event = { kind: 'play', seat, cards: [a.card] };
    if (!next.hands[seat]!.length) next.finished.push(seat);
  } else if (a.kind === 'pass') {
    next.passes[seat] = next.passes[seat]! + 1;
    next.event = { kind: 'pass', seat, cards: [] };
    if (next.passes[seat]! > 3) {
      next.table.push(...hand);
      next.hands[seat] = [];
      next.eliminated.push(seat);
      next.event = { kind: 'out', seat, cards: [...hand] };
    }
  } else return null;
  const remaining = SEATS.filter((p) => next.hands[p]!.length);
  if (remaining.length <= 1) {
    next.order = [...next.finished, ...remaining, ...[...next.eliminated].reverse()];
    next.status = next.order[0] === 0 ? 'won' : 'lost';
    return next;
  }
  for (let d = 1; d <= 4; d++) {
    const p = ((seat + d) % 4) as Seat;
    if (next.hands[p]!.length) {
      next.turn = p;
      break;
    }
  }
  return next;
}
export interface CpuView {
  hand: Card[];
  table: Card[];
  passes: number;
  counts: number[];
  turn: Seat;
  randomSeed: number;
}
export function cpuView(s: Session): CpuView {
  return {
    hand: [...s.hands[s.turn]!],
    table: [...s.table],
    passes: s.passes[s.turn]!,
    counts: s.hands.map((h) => h.length),
    turn: s.turn,
    randomSeed: (s.seed ^ Math.imul(s.moves + 1, 0x9e3779b9)) >>> 0,
  };
}
export function chooseCpuMove(v: CpuView): Action {
  const legal = v.hand.filter((c) => canPlay(c, v.table));
  if (!legal.length) return { kind: 'pass' };
  const rng = random(v.randomSeed);
  const scored = legal
    .map((card) => {
      const r = rankOf(card),
        suit = suitOf(card);
      const behind = v.hand.filter(
        (c) => suitOf(c) === suit && (r < 7 ? rankOf(c) < r : rankOf(c) > r),
      ).length;
      const distance = r < 7 ? r - 1 : 13 - r;
      return {
        card,
        score: behind * 3 - (distance - behind) * 1.5 + (r === 1 || r === 13 ? 8 : 0) + rng() * 0.5,
      };
    })
    .sort((a, b) => b.score - a.score);
  // Delay an opening only when no own card needs it and enough passes remain.
  if (
    scored[0]!.score < 0 &&
    v.passes < 2 &&
    v.hand.length > 2 &&
    !v.counts.some((n, p) => p !== v.turn && n > 0 && n < 3)
  )
    return { kind: 'pass' };
  return { kind: 'play', card: scored[0]!.card };
}
export function act(s: Session, a: Action): Session | null {
  let next = step(s, a);
  if (!next) return null;
  if (!next.hands[0]!.length)
    for (let i = 0; i < 80 && next.status === 'playing'; i++) {
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
    raw.status !== 'playing' ||
    !Array.isArray(raw.passes) ||
    raw.passes.length !== 4 ||
    !raw.passes.every((p) => integer(p, 4)) ||
    !seats(raw.finished) ||
    !seats(raw.eliminated) ||
    !seats(raw.order) ||
    raw.order.length ||
    !cardArray(raw.table, 52) ||
    !partition(raw.hands, [raw.table], 52)
  )
    return null;
  const table = raw.table,
    eliminated = raw.eliminated;
  if (
    ![6, 19, 32, 45].every((c) => table.includes(c)) ||
    raw.finished.includes(0) ||
    raw.eliminated.includes(0) ||
    raw.finished.some((p) => eliminated.includes(p)) ||
    !raw.hands[raw.turn]!.length ||
    !raw.hands[0]!.length
  )
    return null;
  for (const p of SEATS)
    if (
      !raw.hands[p]!.length !== (raw.finished.includes(p) || eliminated.includes(p)) ||
      (raw.passes[p] === 4) !== eliminated.includes(p)
    )
      return null;
  return { ...raw, event: { kind: 'deal', seat: raw.turn, cards: [] } } as unknown as Session;
}
