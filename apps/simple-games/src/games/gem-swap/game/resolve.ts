/**
 * One move, resolved in one call (docs/GEM_SWAP_RULES.md §4.2–§4.4).
 *
 * `resolveSwap` returns everything the move does — the swap, every cascade
 * stage (clear → gravity → refill), the final board, the tape positions after
 * it, and the score — so the UI only replays a finished result and holds no
 * rule of its own (the same shape as Bubble Pop's placeAndResolve).
 *
 * Refills come from per-column tapes that never look at the board: column
 * c's k-th gem is a function of (seed, c, k, colors) alone. That is what
 * makes Undo a step back rather than a reroll (§6) — and, said plainly in
 * the rules, a look-ahead.
 */
import { applyGravity, clearedCells, isValidSwap, swapCells, type Drop } from './board';
import { createRng } from './rng';
import {
  BOARD_SIZE,
  CASCADE_STAGE_LIMIT,
  EMPTY,
  indexAt,
  type Board,
  type ColorCount,
  type Tape,
} from './types';

/** The rng key of column `col`'s `index`-th refill (§4.2). */
export const tapeKey = (seed: string, col: number, index: number): string =>
  `${seed}:${col}:${index}`;

/** The kind column `col` receives as its `index`-th refill (§4.2). */
export function tapeGem(seed: string, colors: ColorCount, col: number, index: number): number {
  return Math.floor(createRng(tapeKey(seed, col, index))() * colors);
}

export interface Spawn {
  readonly index: number;
  readonly kind: number;
}

/** One cascade stage: what it cleared, what fell, what arrived, and the board after. */
export interface Stage {
  /** Cells cleared this stage, ascending; an L / T crossing appears once. */
  readonly cleared: readonly number[];
  readonly drops: readonly Drop[];
  /** Refilled cells with their kinds, bottom-most first within each column. */
  readonly spawns: readonly Spawn[];
  readonly board: Board;
}

export interface MoveResult {
  /** The board right after the exchange, before anything clears. */
  readonly swapped: Board;
  readonly stages: readonly Stage[];
  /** The board after the last stage: settled, unless `capped`. */
  readonly board: Board;
  readonly tape: Tape;
  /** Gems cleared over every stage (§1, §5). */
  readonly score: number;
  /** True when CASCADE_STAGE_LIMIT stages ran and a run still remains (§4.4). */
  readonly capped: boolean;
}

export interface ResolveContext {
  readonly seed: string;
  readonly colors: ColorCount;
  readonly tape: Tape;
}

/**
 * Resolves one swap. Returns null when the swap is not valid (§1) — nothing
 * changes, and the caller has nothing to replay.
 *
 * `stageLimit` exists for the tests that drive the cap; play always uses
 * CASCADE_STAGE_LIMIT.
 */
export function resolveSwap(
  board: Board,
  a: number,
  b: number,
  context: ResolveContext,
  stageLimit: number = CASCADE_STAGE_LIMIT,
): MoveResult | null {
  if (!isValidSwap(board, a, b)) return null;
  const swapped = swapCells(board, a, b);
  const tape = [...context.tape];
  const stages: Stage[] = [];
  let current = swapped;
  let score = 0;
  let capped = false;

  for (;;) {
    const cleared = clearedCells(current);
    if (cleared.length === 0) break;
    if (stages.length >= stageLimit) {
      capped = true;
      break;
    }
    const emptied = [...current];
    for (const cell of cleared) emptied[cell] = EMPTY;
    const fallen = applyGravity(emptied);
    const next = [...fallen.board];
    const spawns: Spawn[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      // The first gem off the tape lands lowest: it is the first to fall (§4.2).
      for (let row = fallen.emptyPerColumn[col]! - 1; row >= 0; row--) {
        const index = indexAt(row, col);
        const kind = tapeGem(context.seed, context.colors, col, tape[col]!);
        tape[col] = tape[col]! + 1;
        next[index] = kind;
        spawns.push({ index, kind });
      }
    }
    stages.push({ cleared, drops: fallen.drops, spawns, board: next });
    score += cleared.length;
    current = next;
  }

  return { swapped, stages, board: current, tape, score, capped };
}
