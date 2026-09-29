/**
 * The board rules of docs/BOX_REGIONS_RULES.md §3, §4 and §5: what one drawn
 * rectangle or one tap does to the player's board, what is currently broken,
 * and the win. Pure functions over a flat assignment array — no cell objects,
 * no state, nothing to keep in sync.
 *
 * The player's board is one array: the region each cell belongs to, or
 * UNASSIGNED. Every clue cell starts unassigned (§4) — a 1×1 is legal here,
 * so a clue that had not been drawn yet would otherwise count as a finished
 * one-cell box. Only what the player drew is a region.
 */
import {
  kindOf,
  rectArea,
  rectCells,
  rectContains,
  rectOfCells,
  rectSatisfiesClue,
  spanRect,
  type Rect,
} from './rects';
import { MAX_REGION_SIZE, UNASSIGNED, type Assignment, type Clue, type Layout } from './types';

/** A fresh board: nothing drawn, clue cells included (§4). */
export function initialAssignment(layout: Layout): number[] {
  return new Array<number>(layout.width * layout.height).fill(UNASSIGNED);
}

/** The cells currently in one region, ascending. */
export function regionCells(assignment: Assignment, region: number): number[] {
  const out: number[] = [];
  for (let index = 0; index < assignment.length; index++) {
    if (assignment[index] === region) out.push(index);
  }
  return out;
}

/** The clues whose cells lie inside a rectangle, as region indices. */
export function cluesInside(layout: Layout, rect: Rect): number[] {
  const out: number[] = [];
  layout.clues.forEach((clue, region) => {
    if (rectContains(rect, clue.index, layout.width)) out.push(region);
  });
  return out;
}

/**
 * What the stroke from `from` to `to` would draw (§4, §13): the rectangle,
 * and the one region it would become — or null when it holds no clue or more
 * than one, which is the preview's warn colour.
 */
export interface DrawPreview {
  readonly cells: readonly number[];
  readonly region: number | null;
}

export function previewDraw(layout: Layout, from: number, to: number): DrawPreview {
  const rect = spanRect(from, to, layout.width);
  const inside = cluesInside(layout, rect);
  return {
    cells: rectCells(rect, layout.width),
    region: inside.length === 1 ? inside[0]! : null,
  };
}

/**
 * One stroke (§4): the rectangle spanned by `from` and `to` becomes the
 * region of the one clue inside it. Every region it overlaps goes whole — a
 * rectangle with a bite out of it is no rectangle — and so does that clue's
 * old region, since a clue has one region. Null when the rectangle holds no
 * clue or two, or when the board would not change.
 */
export function drawRect(
  assignment: Assignment,
  layout: Layout,
  from: number,
  to: number,
): number[] | null {
  const cellTotal = layout.width * layout.height;
  if (from < 0 || from >= cellTotal || to < 0 || to >= cellTotal) return null;
  const preview = previewDraw(layout, from, to);
  const region = preview.region;
  if (region === null) return null;

  const cleared = new Set<number>([region]);
  for (const cell of preview.cells) {
    const owner = assignment[cell] ?? UNASSIGNED;
    if (owner !== UNASSIGNED) cleared.add(owner);
  }
  const next = assignment.map((owner) => (cleared.has(owner) ? UNASSIGNED : owner));
  for (const cell of preview.cells) next[cell] = region;

  const changed = next.some((owner, cell) => owner !== assignment[cell]);
  return changed ? next : null;
}

/**
 * One tap (§4): on a region's cell, the whole region goes; on a clue cell
 * with no region yet, that clue becomes a 1×1 box; anywhere else, nothing.
 */
export function tapCell(assignment: Assignment, layout: Layout, index: number): number[] | null {
  if (index < 0 || index >= assignment.length) return null;
  const owner = assignment[index] ?? UNASSIGNED;
  if (owner !== UNASSIGNED) {
    return assignment.map((region) => (region === owner ? UNASSIGNED : region));
  }
  const region = layout.clues.findIndex((clue) => clue.index === index);
  if (region === -1) return null;
  const next = [...assignment];
  next[index] = region;
  return next;
}

/**
 * Whether a region's cells answer to its clue (§3): one filled rectangle,
 * area 1–12, holding its own clue cell and no other, with the clue's number
 * and kind.
 */
export function regionSatisfiesClue(
  cells: readonly number[],
  layout: Layout,
  region: number,
): boolean {
  const clue = layout.clues[region];
  if (clue === undefined) return false;
  const rect = rectOfCells(cells, layout.width);
  if (rect === null) return false;
  if (!rectContains(rect, clue.index, layout.width)) return false;
  if (cluesInside(layout, rect).length !== 1) return false;
  return rectSatisfiesClue(rect, clue);
}

/**
 * Why a drawn region breaks a rule (§5), or false when it keeps them all. A
 * drawn region is finished the moment it is drawn, so a count short of the
 * number is as wrong as one over it.
 */
function regionBroken(cells: readonly number[], clue: Clue, width: number): boolean {
  const rect = rectOfCells(cells, width);
  // Play only ever draws rectangles; anything else came from somewhere else.
  if (rect === null) return true;
  const area = rectArea(rect);
  if (area > MAX_REGION_SIZE) return true;
  if (clue.size !== null && area !== clue.size) return true;
  if (clue.kind !== 'free' && kindOf(rect.width, rect.height) !== clue.kind) return true;
  return false;
}

/**
 * What the board currently breaks (§5), per region and per cell. A statement
 * about the rules, never a comparison against the hidden answer: a region that
 * is legal but not the answer is told nothing.
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
    if (held.length === 0) return;
    if (!regionBroken(held, clue, layout.width)) return;
    regions[region] = true;
    for (const index of held) cells[index] = true;
    any = true;
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
  if (!assignment.every((region) => region >= 0 && region < layout.clues.length)) return false;
  for (let region = 0; region < layout.clues.length; region++) {
    if (!regionSatisfiesClue(regionCells(assignment, region), layout, region)) return false;
  }
  return true;
}
