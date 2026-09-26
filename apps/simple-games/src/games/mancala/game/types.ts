/**
 * Core Mancala types. See docs/MANCALA_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * The board is fourteen counts in one array (§1): the player's six pits left
 * to right (0–5), the player's store (6), the CPU's six pits (7–12, left to
 * right from the CPU's own seat, so right to left on screen), the CPU's store
 * (13). Walking the indices upward is walking the board counter-clockwise,
 * which is the whole of the sowing direction.
 */

/** Six pits a side, four seeds a pit (§1). Kalah(6,4), and only that. */
export const PITS_PER_SIDE = 6;
export const SEEDS_PER_PIT = 4;
export const TOTAL_SEEDS = 2 * PITS_PER_SIDE * SEEDS_PER_PIT;

/** Twelve pits and two stores. */
export const BOARD_SIZE = 2 * PITS_PER_SIDE + 2;

export const PLAYER_STORE = PITS_PER_SIDE;
export const CPU_STORE = BOARD_SIZE - 1;

/**
 * The two seats. 1 and 2, as in Connect Four, rather than 0 and 1: a side is
 * persisted (§8), and a seat that reads as falsy is one careless `if` away
 * from being mistaken for "none".
 */
export const PLAYER = 1;
export const CPU = 2;

export type Side = typeof PLAYER | typeof CPU;

export const isSide = (value: unknown): value is Side => value === PLAYER || value === CPU;

/** Seed counts, indexed as above. Always BOARD_SIZE long. */
export type Pits = readonly number[];

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

export const opponentOf = (side: Side): Side => (side === PLAYER ? CPU : PLAYER);

/** The store `side` sows into and collects in (§2, §3). */
export const storeOf = (side: Side): number => (side === PLAYER ? PLAYER_STORE : CPU_STORE);

/** The index of `side`'s first pit — the one furthest from its own store. */
export const firstPitOf = (side: Side): number => (side === PLAYER ? 0 : PLAYER_STORE + 1);

/** Whether `index` is one of `side`'s six pits (never a store). */
export const isPitOf = (side: Side, index: number): boolean => {
  const first = firstPitOf(side);
  return index >= first && index < first + PITS_PER_SIDE;
};

/** The pit straight across the board (§1): pit 0 faces 12, pit 5 faces 7. */
export const oppositeOf = (index: number): number => 2 * PITS_PER_SIDE - index;

/** The opening position: four seeds in every pit, both stores empty (§1). */
export function initialPits(): Pits {
  const pits = new Array<number>(BOARD_SIZE).fill(SEEDS_PER_PIT);
  pits[PLAYER_STORE] = 0;
  pits[CPU_STORE] = 0;
  return pits;
}

/** Seeds still in `side`'s six pits (the stores are not counted). */
export function seedsOnSide(pits: Pits, side: Side): number {
  const first = firstPitOf(side);
  let total = 0;
  for (let i = first; i < first + PITS_PER_SIDE; i++) total += pits[i]!;
  return total;
}

/**
 * A board that could exist at all: fourteen non-negative whole counts that
 * add up to every seed in the game — seeds are moved, never made or lost
 * (§1, §8).
 */
export function isValidPits(pits: readonly unknown[]): pits is Pits {
  if (pits.length !== BOARD_SIZE) return false;
  let total = 0;
  for (const count of pits) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return false;
    total += count;
  }
  return total === TOTAL_SEEDS;
}

/** Whether two boards hold the same count in every pit and store. */
export function samePits(a: Pits, b: Pits): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
