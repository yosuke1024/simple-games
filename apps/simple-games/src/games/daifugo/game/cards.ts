/** Local card primitives: games remain independent. A=1 through K=13; 52 is Joker. */
export const SEATS = [0, 1, 2, 3] as const;
export type Seat = (typeof SEATS)[number];
export type Card = number;
export const rankOf = (card: Card) => (card % 13) + 1;
export const suitOf = (card: Card) => Math.floor(card / 13);
export const isCard = (x: unknown): x is Card =>
  Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 52;
export const isSeat = (x: unknown): x is Seat =>
  Number.isInteger(x) && Number(x) >= 0 && Number(x) < 4;
export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const cards = [...items],
    rng = random(seed);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}
export function deal(count: number, seed: number): Card[][] {
  const hands: Card[][] = [[], [], [], []];
  shuffled(
    Array.from({ length: count }, (_, i) => i),
    seed,
  ).forEach((c, i) => hands[i % 4]!.push(c));
  return hands.map((h) => h.sort((a, b) => a - b));
}
export const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
export const integer = (x: unknown, max = Number.MAX_SAFE_INTEGER): x is number =>
  Number.isSafeInteger(x) && Number(x) >= 0 && Number(x) <= max;
export function cardArray(x: unknown, count: number): x is Card[] {
  return (
    Array.isArray(x) &&
    x.length <= count &&
    x.every((c) => integer(c, count - 1)) &&
    new Set(x).size === x.length
  );
}
export function seats(x: unknown): x is Seat[] {
  return Array.isArray(x) && x.length <= 4 && x.every(isSeat) && new Set(x).size === x.length;
}
export function partition(hands: unknown, piles: unknown[], count: number): hands is Card[][] {
  if (
    !Array.isArray(hands) ||
    hands.length !== 4 ||
    !hands.every((h) => cardArray(h, count)) ||
    !piles.every((p) => cardArray(p, count))
  )
    return false;
  const all = [...hands.flat(), ...(piles as Card[][]).flat()];
  return all.length === count && new Set(all).size === count;
}
export interface GameEvent {
  kind: 'deal' | 'play' | 'pass' | 'clear' | 'exchange' | 'draw' | 'pair' | 'out';
  seat: Seat;
  cards: Card[];
  from?: Seat;
}
