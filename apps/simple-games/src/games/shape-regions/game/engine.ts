/**
 * The board rules of docs/SHAPE_REGIONS_RULES.md §3, §4 and §5: how a region
 * grows and shrinks under the player's hand, what is currently broken, and
 * the win. Pure functions over a flat assignment array — no cell objects, no
 * state, nothing to keep in sync.
 *
 * The player's board is one array: the region each cell belongs to, or
 * UNASSIGNED. Clue cells are assigned to their own region from the first
 * moment and nothing here can move them (§4), which is what lets the save
 * format state "a clue cell in another region" as corruption rather than as a
 * state somebody has to think about (§11).
 */
import { classifyCells } from './shapes';
import {
  MAX_REGION_SIZE,
  MIN_REGION_SIZE,
  UNASSIGNED,
  neighbors,
  type Assignment,
  type Clue,
  type Layout,
} from './types';

/** A fresh board: every clue in its own region, everything else unassigned. */
export function initialAssignment(layout: Layout): number[] {
  const out = new Array<number>(layout.width * layout.height).fill(UNASSIGNED);
  layout.clues.forEach((clue, region) => {
    out[clue.index] = region;
  });
  return out;
}

/** The cells currently in one region, ascending. */
export function regionCells(assignment: Assignment, region: number): number[] {
  const out: number[] = [];
  for (let index = 0; index < assignment.length; index++) {
    if (assignment[index] === region) out.push(index);
  }
  return out;
}

/** Cells of `region` reachable from its clue through the region itself (§4). */
export function reachableFromClue(
  assignment: Assignment,
  layout: Layout,
  region: number,
): Set<number> {
  const clue = layout.clues[region];
  const reached = new Set<number>();
  if (clue === undefined || assignment[clue.index] !== region) return reached;
  const queue = [clue.index];
  reached.add(clue.index);
  while (queue.length > 0) {
    const index = queue.shift()!;
    for (const next of neighbors(index, layout.width, layout.height)) {
      if (assignment[next] === region && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return reached;
}

/**
 * One stroke (§4): the cells the finger crossed, in order, offered to a
 * region. A cell joins only while it is unassigned and touches the region as
 * it stands at that moment — so the region grows out from its clue and never
 * jumps, and a cell of another region is skipped rather than taken. Returns
 * null when nothing joined.
 */
export function addCells(
  assignment: Assignment,
  layout: Layout,
  region: number,
  cells: readonly number[],
): number[] | null {
  if (region < 0 || region >= layout.clues.length) return null;
  const next = [...assignment];
  let changed = false;
  for (const index of cells) {
    if (index < 0 || index >= next.length) continue;
    if (next[index] !== UNASSIGNED) continue;
    const touches = neighbors(index, layout.width, layout.height).some(
      (neighbor) => next[neighbor] === region,
    );
    if (!touches) continue;
    next[index] = region;
    changed = true;
  }
  return changed ? next : null;
}

/**
 * One tap (§4): the cell leaves its region, and so does anything the removal
 * cut off from the clue. A clue cell never leaves; an unassigned cell has
 * nothing to leave. Returns null when nothing changes.
 */
export function removeCell(assignment: Assignment, layout: Layout, index: number): number[] | null {
  if (index < 0 || index >= assignment.length) return null;
  const region = assignment[index];
  if (region === undefined || region === UNASSIGNED) return null;
  if (layout.clues[region]?.index === index) return null;
  const next = [...assignment];
  next[index] = UNASSIGNED;
  const kept = reachableFromClue(next, layout, region);
  for (let cell = 0; cell < next.length; cell++) {
    if (next[cell] === region && !kept.has(cell)) next[cell] = UNASSIGNED;
  }
  return next;
}

/**
 * Whether a finished region's cells answer to its clue (§3, rule 4). Every
 * region, symbol-clued or not, must land in one of the five categories of §2
 * — a number-only clue fixes the size, but the shape is still read from the
 * same catalog every solver and the generator's uniqueness proof assume
 * (`placementsFor` narrows candidates to the catalog regardless of whether
 * the clue names a symbol), so the win condition has to agree.
 */
export function regionSatisfiesClue(cells: readonly number[], clue: Clue, width: number): boolean {
  if (cells.length < MIN_REGION_SIZE || cells.length > MAX_REGION_SIZE) return false;
  if (clue.size !== null && cells.length !== clue.size) return false;
  const category = classifyCells(cells, width);
  if (category === null) return false;
  if (clue.shape !== null && category !== clue.shape) return false;
  return true;
}

/**
 * What the board currently breaks (§5), per region and per cell. A statement
 * about the rules, never a comparison against the hidden answer: a region that
 * is legal but not final is told nothing, because nothing is wrong yet.
 */
export interface Violations {
  readonly cells: readonly boolean[];
  readonly regions: readonly boolean[];
  readonly any: boolean;
}

export function findViolations(layout: Layout, assignment: Assignment): Violations {
  const cells = new Array<boolean>(assignment.length).fill(false);
  const regions = new Array<boolean>(layout.clues.length).fill(false);
  let any = false;

  layout.clues.forEach((clue, region) => {
    const held = regionCells(assignment, region);
    const count = held.length;
    // Bigger than the number, or bigger than any region may be.
    let broken = count > MAX_REGION_SIZE || (clue.size !== null && count > clue.size);
    // Complete — at the number, or at the ceiling when there is no number —
    // and either not one of the five categories at all, or not the shape the
    // symbol names (§3, rule 4).
    const complete = clue.size !== null ? count === clue.size : count === MAX_REGION_SIZE;
    if (!broken && complete) {
      const category = classifyCells(held, layout.width);
      if (category === null || (clue.shape !== null && category !== clue.shape)) {
        broken = true;
      }
    }
    if (broken) {
      regions[region] = true;
      for (const index of held) cells[index] = true;
      any = true;
    }
  });

  return { cells, regions, any };
}

export const isFull = (assignment: Assignment): boolean =>
  assignment.every((region) => region !== UNASSIGNED);

/**
 * Won when every cell is assigned and every region keeps the four rules of §3.
 * Read from the rules, not from the solution, so the display and the verdict
 * cannot disagree — and because the puzzle is unique the two coincide.
 *
 * The length guard is not paranoia: `every` on an empty array is true, and
 * without it an empty assignment would arrive at the result screen as a win.
 */
export function isSolved(layout: Layout, assignment: Assignment): boolean {
  if (assignment.length !== layout.width * layout.height) return false;
  if (!isFull(assignment)) return false;
  for (let region = 0; region < layout.clues.length; region++) {
    const clue = layout.clues[region]!;
    const held = regionCells(assignment, region);
    if (assignment[clue.index] !== region) return false;
    if (held.some((index) => index !== clue.index && layout.clues.some((c) => c.index === index))) {
      return false;
    }
    if (reachableFromClue(assignment, layout, region).size !== held.length) return false;
    if (!regionSatisfiesClue(held, clue, layout.width)) return false;
  }
  // Every cell belongs to a region that exists.
  return assignment.every((region) => region >= 0 && region < layout.clues.length);
}
