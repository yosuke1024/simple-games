/** Local card primitives; rule modules remain independent of other games. */
export type Card = number;
export const suitOf = (card: Card): number => Math.floor((card % 52) / 13);
export const rankOf = (card: Card): number => ((card % 52) % 13) + 1;
export const highRank = (card: Card): number => (rankOf(card) === 1 ? 14 : rankOf(card));
export const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
export const integer = (v: unknown, max = 1e9, min = 0): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export const numbers = (v: unknown, length: number, max = 1e9, min = 0): v is number[] =>
  Array.isArray(v) && v.length === length && v.every((n) => integer(n, max, min));
export const cards = (v: unknown, max = 51): v is Card[] =>
  Array.isArray(v) &&
  v.length <= max + 1 &&
  v.every((c) => integer(c, max)) &&
  new Set(v).size === v.length;
export function random(seed: number): () => number {
  let n = seed >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) | 0;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(
  items: readonly Card[],
  seed: number,
  entropy?: (upperBound: number) => number,
): Card[] {
  const a = [...items],
    rng = random(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = entropy ? entropy(i + 1) : Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
export function partition(groups: unknown[], deck: readonly Card[]): boolean {
  if (!groups.every((g) => cards(g, Math.max(...deck)))) return false;
  const all = (groups as Card[][]).flat();
  return (
    all.length === deck.length &&
    new Set(all).size === deck.length &&
    all.every((c) => deck.includes(c))
  );
}
export interface GameEvent {
  kind: string;
  seat: number;
  cards: Card[];
}
export function event(v: unknown, seats: number, max: number): v is GameEvent {
  return (
    object(v) &&
    exactKeys(v, ['kind', 'seat', 'cards']) &&
    typeof v.kind === 'string' &&
    v.kind.length <= 32 &&
    integer(v.seat, seats - 1) &&
    cards(v.cards, max)
  );
}
export type Status = 'playing' | 'won' | 'lost' | 'draw';
export function outcome(winners: readonly number[]): Status {
  return winners.includes(0) ? (winners.length === 1 ? 'won' : 'draw') : 'lost';
}

export function exactKeys(v: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(v).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(v, key))
  );
}
