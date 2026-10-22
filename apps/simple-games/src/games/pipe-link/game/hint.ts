/**
 * The Hint of docs/PIPE_LINK_RULES.md §6.
 *
 * 1. Technique stage: walk the technique solver's fixing order — the order
 *    tiles became certain from the types-only board, L1 → L2 → L3 — and
 *    show the first tile whose current orientation differs from the
 *    orientation the techniques proved, with that orientation.
 * 2. Solution stage: only when no tile in that order differs (the
 *    techniques did not decide the whole board), show the first tile,
 *    row-major, that differs from the stored answer.
 *
 * The techniques run from the types-only board, never from the player's
 * orientations: without tile locks an orientation is not a claim the player
 * made (§6). So the result is the same for every state of one board, and
 * the session may keep it after the first hint (session.ts).
 */
import { isSolved, type Board } from './board';
import type { SolveResult } from './solver';

export type HintKind = 'technique' | 'solution';

export interface Hint {
  readonly cell: number;
  /** The orientation to turn the tile to. */
  readonly orientation: number;
  readonly kind: HintKind;
}

function single(domain: number): number {
  return 31 - Math.clz32(domain & -domain);
}

/**
 * The hint for the current orientations, or null when the board is solved
 * (§2: a solved board takes no hint). `techniques` is `solve(board)` from
 * the types-only board.
 */
export function findHint(
  board: Board,
  solution: readonly number[],
  current: readonly number[],
  techniques: SolveResult,
): Hint | null {
  if (isSolved(board, current)) return null;
  for (const cell of techniques.order) {
    const proved = single(techniques.domains[cell]!);
    if (current[cell] !== proved) return { cell, orientation: proved, kind: 'technique' };
  }
  for (let cell = 0; cell < current.length; cell++) {
    if (current[cell] !== solution[cell]) {
      return { cell, orientation: solution[cell]!, kind: 'solution' };
    }
  }
  return null;
}

export const sameHint = (a: Hint, b: Hint): boolean =>
  a.cell === b.cell && a.orientation === b.orientation && a.kind === b.kind;
