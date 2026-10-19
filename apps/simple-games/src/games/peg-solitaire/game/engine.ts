/**
 * The rules (docs/PEG_SOLITAIRE_RULES.md §2, §3): which jumps are legal, what
 * a jump does to the board, and when the game is over. Pure functions over a
 * plain array — no identity, no time, no randomness. The session, the solver
 * and the tests' replays all go through these same functions; there is one
 * set of rules, not a fast copy beside it (the solver keeps its own scratch
 * board for speed, but reads legality from the same jump table, boards.ts).
 */
import { isHole, type BoardGeometry } from './boards';
import type { Jump, Outcome, Pegs, Problem } from './types';

/** The opening position (§3): a peg in every hole but `start`. */
export function initialPegs(geometry: BoardGeometry, start: number): Pegs {
  return geometry.holes.map((_, i) => i !== start);
}

export function pegCount(pegs: Pegs): number {
  let count = 0;
  for (const peg of pegs) if (peg) count++;
  return count;
}

/**
 * The jump from `from` to `to` on this board's lines, whatever stands where:
 * two holes apart along one of the board's directions, with a hole between.
 * Null for anything else — a diagonal on the cross, a line the triangle does
 * not have, one hole or three holes away, or a spot off the board (§2).
 */
export function jumpBetween(geometry: BoardGeometry, from: number, to: number): Jump | null {
  if (!isHole(geometry, from) || !isHole(geometry, to)) return null;
  for (const jump of geometry.jumps) {
    if (jump.from === from && jump.to === to) return jump;
  }
  return null;
}

/**
 * Why a jump cannot be made (§2), checked in this order:
 * - 'no-hole': `from` or `to` is not a hole of this board (off the board);
 * - 'no-peg': there is no peg at `from` to move;
 * - 'not-a-line': `to` is not two holes away along one of the board's lines
 *   (this is where a diagonal on the cross is refused);
 * - 'nothing-to-jump': the hole between is empty;
 * - 'occupied': the landing hole already holds a peg.
 */
export type JumpRejection = 'no-hole' | 'no-peg' | 'not-a-line' | 'nothing-to-jump' | 'occupied';

export type JumpCheck =
  | { readonly ok: true; readonly jump: Jump }
  | { readonly ok: false; readonly reason: JumpRejection };

export function checkJump(
  geometry: BoardGeometry,
  pegs: Pegs,
  from: number,
  to: number,
): JumpCheck {
  if (!isHole(geometry, from) || !isHole(geometry, to)) return { ok: false, reason: 'no-hole' };
  if (!pegs[from]) return { ok: false, reason: 'no-peg' };
  const jump = jumpBetween(geometry, from, to);
  if (!jump) return { ok: false, reason: 'not-a-line' };
  if (!pegs[jump.over]) return { ok: false, reason: 'nothing-to-jump' };
  if (pegs[to]) return { ok: false, reason: 'occupied' };
  return { ok: true, jump };
}

/**
 * Plays a jump (§2): the jumper leaves `from`, the jumped peg is removed, the
 * jumper lands in `to`. Null when the jump is not legal here — the rules
 * offer nothing there, so the input is nothing.
 */
export function applyJump(
  geometry: BoardGeometry,
  pegs: Pegs,
  from: number,
  to: number,
): Pegs | null {
  const check = checkJump(geometry, pegs, from, to);
  if (!check.ok) return null;
  const next = [...pegs];
  next[check.jump.from] = false;
  next[check.jump.over] = false;
  next[check.jump.to] = true;
  return next;
}

/**
 * The exact inverse of a jump that was just played (Undo, §6): the jumper
 * goes back to `from`, the jumped peg comes back, `to` is empty again. The
 * caller passes a jump it applied; nothing here re-checks it.
 */
export function revertJump(pegs: Pegs, jump: Jump): Pegs {
  const next = [...pegs];
  next[jump.from] = true;
  next[jump.over] = true;
  next[jump.to] = false;
  return next;
}

const isLegal = (pegs: Pegs, jump: Jump): boolean =>
  pegs[jump.from] === true && pegs[jump.over] === true && pegs[jump.to] === false;

/** Every legal jump in this position, in the board's jump order. */
export function legalJumps(geometry: BoardGeometry, pegs: Pegs): Jump[] {
  return geometry.jumps.filter((jump) => isLegal(pegs, jump));
}

/** The legal jumps of the peg at `from` — the holes the screen marks (§4). */
export function jumpsFrom(geometry: BoardGeometry, pegs: Pegs, from: number): Jump[] {
  return geometry.jumps.filter((jump) => jump.from === from && isLegal(pegs, jump));
}

export function hasLegalJump(geometry: BoardGeometry, pegs: Pegs): boolean {
  return geometry.jumps.some((jump) => isLegal(pegs, jump));
}

/**
 * How the game stands (§3): null while any jump is left; otherwise perfect
 * (one peg, in the target), single (one peg, elsewhere) or stuck (two or
 * more pegs and no jump between them).
 */
export function outcomeOf(geometry: BoardGeometry, problem: Problem, pegs: Pegs): Outcome | null {
  if (hasLegalJump(geometry, pegs)) return null;
  const remaining = pegCount(pegs);
  if (remaining === 1) {
    return { kind: pegs[problem.target] ? 'perfect' : 'single', remaining };
  }
  return { kind: 'stuck', remaining };
}
