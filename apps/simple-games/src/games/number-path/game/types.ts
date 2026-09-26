/**
 * Core Number Path types. See docs/NUMBER_PATH_RULES.md — the single source
 * of truth for the rules these shapes serve.
 *
 * A board is addressed by one row-major index, never by a pair, so the solver
 * and the generator keep their hot loops on flat arrays. Width and height
 * travel with the board because the record format allows for boards that are
 * not square, even though the three tiers are (§1).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

/** An inclusive range of whole numbers. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

/**
 * What a tier promises about the board it ships (§6「ティア」): its size, how
 * many numbered cells and walls it may carry, and how far from a single road
 * the uniqueness search had to wander — the number of nodes at which two or
 * more continuations survived the solver's pruning.
 */
export interface Tier {
  readonly width: number;
  readonly height: number;
  /** Numbered cells 1..K on the shipped board, K inclusive. */
  readonly numbers: Range;
  /** Walls on the shipped board. */
  readonly walls: Range;
  /** Branch points of the uniqueness search (`SolveResult.branches`). */
  readonly branches: Range;
}

/**
 * The three tiers (§1, §6). Sizes are chosen so a cell stays big enough to
 * drag a finger through on a phone held in portrait; 7×7 is the largest that
 * fits 320px at a finger-sized cell. Difficulty comes from fewer clues and a
 * less forced search, not from a wider board alone.
 */
export const TIERS: Record<Difficulty, Tier> = {
  easy: {
    width: 5,
    height: 5,
    numbers: { min: 6, max: 8 },
    walls: { min: 0, max: 5 },
    branches: { min: 0, max: 12 },
  },
  medium: {
    width: 6,
    height: 6,
    numbers: { min: 5, max: 7 },
    walls: { min: 0, max: 9 },
    branches: { min: 12, max: 120 },
  },
  hard: {
    width: 7,
    height: 7,
    numbers: { min: 4, max: 6 },
    walls: { min: 0, max: 14 },
    branches: { min: 30, max: 800 },
  },
};

export const inRange = (value: number, range: Range): boolean =>
  value >= range.min && value <= range.max;

/** The largest board any tier ships, and the cap a record may claim (§9). */
export const MAX_SIDE = 7;

export type GameMode = 'difficulty' | 'daily';

/** There is no losing a Number Path — no mistakes counted, no lives (§2, §12). */
export type GameStatus = 'playing' | 'solved';

/** The four steps a path may take, as bits of a cell's `open` mask. */
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;

export type Direction = typeof UP | typeof RIGHT | typeof DOWN | typeof LEFT;

/** Reading order: up, right, down, left — the order the solver tries moves. */
export const DIRECTIONS: readonly Direction[] = [UP, RIGHT, DOWN, LEFT];

/**
 * A puzzle: the grid, its numbered cells and its walls. Immutable; the
 * player's path lives beside it in the session, never in it.
 *
 * `open` and `adjacent` say the same thing twice on purpose: the bitmask is
 * what the board draws and serialises against, the neighbour lists are what
 * the solver walks — building both once keeps every hot loop free of wall
 * lookups.
 */
export interface Board {
  readonly width: number;
  readonly height: number;
  /** One entry per cell, row-major: the number written there, or 0. */
  readonly numbers: readonly number[];
  /** K — the last number, where the path has to end (§2). At least 2. */
  readonly last: number;
  /** `cellOf[n]` is the cell carrying number n (1..K); index 0 is unused (-1). */
  readonly cellOf: readonly number[];
  /** Per cell: which of UP / RIGHT / DOWN / LEFT can be stepped to (§1, §3). */
  readonly open: readonly number[];
  /** Per cell: the cells it can step to, in DIRECTIONS order. */
  readonly adjacent: readonly (readonly number[])[];
  /** Every wall as an edge id (`h<i>` below cell i, `v<i>` right of cell i), sorted. */
  readonly walls: readonly string[];
}

/** A path: cell indices in the order they were drawn. Always starts at 1 (§3). */
export type Path = readonly number[];
