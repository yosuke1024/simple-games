/**
 * Core Peg Solitaire types. See docs/PEG_SOLITAIRE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A board is a fixed list of holes (boards.ts); a position is one boolean per
 * hole, `true` where a peg stands (§1). Holes are named by their index in
 * that list, and the index order is part of the save format (§11): a saved
 * game is its problem and the jumps played, each jump a pair of hole indices.
 * compatibility.test.ts pins the order so it can never drift silently.
 */

/**
 * The two boards (§1). The cross-shaped board of 33 holes is called
 * 'english' after the name the format is generally known by; the 15-hole
 * board is 'triangle'. Both are persisted strings — never rename them.
 */
export type BoardKind = 'english' | 'triangle';

export const BOARD_KINDS: readonly BoardKind[] = ['english', 'triangle'];

export const isBoardKind = (value: unknown): value is BoardKind =>
  value === 'english' || value === 'triangle';

/**
 * Where a hole sits. For the cross, `row` and `col` are the 7×7 grid it is
 * cut from (the four 2×2 corners are not holes). For the triangle, `row` is
 * 0 (the apex) to 4 and `col` is the hole's place in its row, 0 to `row`.
 */
export interface Hole {
  readonly row: number;
  readonly col: number;
}

/** A peg at `from` jumps the peg at `over` and lands in the empty `to` (§2). */
export interface Jump {
  readonly from: number;
  readonly over: number;
  readonly to: number;
}

/** One entry per hole, in the board's hole order: `true` where a peg stands. */
export type Pegs = readonly boolean[];

/**
 * One puzzle (§3, §8): which board, the one hole that starts empty, and the
 * hole the last peg should finish in for a perfect clear. Only problems in
 * the verified table (problems.ts) are ever dealt, saved or restored.
 */
export interface Problem {
  readonly kind: BoardKind;
  /** The hole that is empty at the start; every other hole holds a peg. */
  readonly start: number;
  /** The ringed hole: one peg left here is a perfect clear (§3). */
  readonly target: number;
}

/**
 * How a finished game stands (§3). A game is finished when no jump is left.
 * - perfect: one peg left, in the target hole — the clear.
 * - single: one peg left, somewhere else.
 * - stuck: two or more pegs left with no jump between them.
 */
export type OutcomeKind = 'perfect' | 'single' | 'stuck';

export interface Outcome {
  readonly kind: OutcomeKind;
  /** Pegs still on the board. Never 0 — a jump always leaves its jumper. */
  readonly remaining: number;
}

export type GameStatus = 'playing' | 'over';
