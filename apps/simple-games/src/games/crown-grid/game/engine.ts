/**
 * The board rules of docs/CROWN_GRID_RULES.md §2, §3, §4 and §5: one crown per
 * row, column and region, no two crowns touching, the tap cycle, the drag that
 * writes ×, the always-on violation display, and the win. Pure functions over
 * flat arrays — no cell objects, no state, nothing to keep in sync.
 *
 * The × mark is the player's own note (§1). Nothing here reads it as a rule:
 * violations are about crowns, the win is about crowns, and a wrong × costs
 * nothing but the tap that removes it.
 */
import {
  CROSS,
  CROWN,
  EMPTY,
  cellCount,
  type House,
  type Mark,
  type Regions,
  type Solution,
} from './types';

export const rowOf = (index: number, size: number): number => Math.floor(index / size);
export const colOf = (index: number, size: number): number => index % size;
export const indexOf = (row: number, col: number, size: number): number => row * size + col;

/** The row-major indices of one house, whichever kind it is. */
export function houseIndices(size: number, regions: Regions, house: House): number[] {
  const out: number[] = [];
  if (house.kind === 'row') {
    for (let col = 0; col < size; col++) out.push(indexOf(house.index, col, size));
  } else if (house.kind === 'col') {
    for (let row = 0; row < size; row++) out.push(indexOf(row, house.index, size));
  } else {
    for (let index = 0; index < regions.length; index++) {
      if (regions[index] === house.index) out.push(index);
    }
  }
  return out;
}

/** The up-to-eight cells around one, row-major (§3, rule 2). */
export function neighbours(index: number, size: number): number[] {
  const row = rowOf(index, size);
  const col = colOf(index, size);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      out.push(indexOf(r, c, size));
    }
  }
  return out;
}

/** True when two cells touch, diagonals included (§3, rule 2). */
export function touching(a: number, b: number, size: number): boolean {
  return (
    a !== b &&
    Math.abs(rowOf(a, size) - rowOf(b, size)) <= 1 &&
    Math.abs(colOf(a, size) - colOf(b, size)) <= 1
  );
}

/** An empty player board: nothing written anywhere. */
export function emptyMarks(size: number): Mark[] {
  return new Array<Mark>(cellCount(size)).fill(EMPTY);
}

/**
 * One tap: empty → × → crown → empty (§4). Returns null when nothing can
 * change — an index off the board.
 *
 * The cycle is the whole of the tap vocabulary, and every state of a cell is
 * two taps away from every other, which is also why there is no Undo (§14).
 */
export function cycleCell(marks: readonly Mark[], index: number): Mark[] | null {
  if (index < 0 || index >= marks.length) return null;
  const next = [...marks];
  const current = marks[index] ?? EMPTY;
  next[index] = current === EMPTY ? CROSS : current === CROSS ? CROWN : EMPTY;
  return next;
}

/**
 * A drag: × onto every listed cell that is still empty (§4). Crowns and
 * existing ×s are left exactly as they are — a stroke only ever adds notes,
 * so a finger wandering back over its own path unpicks nothing. Null when the
 * stroke changed nothing at all, so the caller need not re-render or save.
 */
export function markCross(marks: readonly Mark[], indices: readonly number[]): Mark[] | null {
  let next: Mark[] | null = null;
  for (const index of indices) {
    if (index < 0 || index >= marks.length) continue;
    if ((next ?? marks)[index] !== EMPTY) continue;
    next ??= [...marks];
    next[index] = CROSS;
  }
  return next;
}

/** Row-major indices of every crown on the board. */
export function crownIndices(marks: readonly Mark[]): number[] {
  const out: number[] = [];
  for (let index = 0; index < marks.length; index++) if (marks[index] === CROWN) out.push(index);
  return out;
}

/**
 * What the board currently breaks (§5), flagged per crown so the board can
 * tint the offending pieces. A statement about the two rules, never a
 * comparison against the hidden solution: a crown that is legal but not final
 * is told nothing, because nothing is wrong yet.
 */
export interface Violations {
  /** One flag per cell, row-major: this crown takes part in a broken rule. */
  readonly cells: readonly boolean[];
  /** True when anything at all is flagged — the cheap read for the hint (§6). */
  readonly any: boolean;
}

export function findViolations(marks: readonly Mark[], regions: Regions, size: number): Violations {
  const cells = new Array<boolean>(cellCount(size)).fill(false);
  let any = false;
  const flag = (group: readonly number[]): void => {
    for (const index of group) cells[index] = true;
    any = true;
  };

  const crowns = crownIndices(marks);

  // Rule 1: two crowns in one row, column or region — every crown of that
  // house is part of the break, since any one of them could be the extra.
  const byRow = new Map<number, number[]>();
  const byCol = new Map<number, number[]>();
  const byRegion = new Map<number, number[]>();
  for (const index of crowns) {
    const push = (map: Map<number, number[]>, key: number) => {
      const list = map.get(key);
      if (list) list.push(index);
      else map.set(key, [index]);
    };
    push(byRow, rowOf(index, size));
    push(byCol, colOf(index, size));
    push(byRegion, regions[index] ?? -1);
  }
  for (const map of [byRow, byCol, byRegion]) {
    for (const group of map.values()) if (group.length >= 2) flag(group);
  }

  // Rule 2: two crowns touching, diagonals included.
  for (let a = 0; a < crowns.length; a++) {
    for (let b = a + 1; b < crowns.length; b++) {
      if (touching(crowns[a]!, crowns[b]!, size)) flag([crowns[a]!, crowns[b]!]);
    }
  }

  return { cells, any };
}

/**
 * Won when N crowns stand and no rule is broken (§2).
 *
 * Read through `findViolations` on purpose, so the display and the verdict can
 * never disagree. The two readings coincide: N crowns with no two sharing a
 * row (column, region) put exactly one in each, by counting.
 */
export function isSolved(marks: readonly Mark[], regions: Regions, size: number): boolean {
  // The length check is not paranoia about a caller: a short board would read
  // as "zero crowns, nothing broken", and `isSolved([], 6)` must not be a win
  // any more than an empty board is (Takuzu §2 guards the same way).
  if (marks.length !== cellCount(size) || regions.length !== cellCount(size)) return false;
  if (crownIndices(marks).length !== size) return false;
  return !findViolations(marks, regions, size).any;
}

/**
 * Whether a partition is one the game could have dealt (§1, §11): every cell
 * carries a region id in 0..N-1, every id is used, and every region is
 * connected through its sides.
 */
export function isValidRegions(regions: unknown, size: number): regions is number[] {
  const total = cellCount(size);
  if (!Array.isArray(regions) || regions.length !== total) return false;
  const ids = regions as unknown[];
  if (!ids.every((id) => Number.isInteger(id) && (id as number) >= 0 && (id as number) < size)) {
    return false;
  }
  const typed = ids as number[];
  const seen = new Array<boolean>(total).fill(false);
  const found = new Set<number>();
  for (let start = 0; start < total; start++) {
    if (seen[start]) continue;
    const id = typed[start]!;
    // A second component of an id already flooded is a region in two pieces.
    if (found.has(id)) return false;
    found.add(id);
    const stack = [start];
    seen[start] = true;
    while (stack.length > 0) {
      const index = stack.pop()!;
      const row = rowOf(index, size);
      const col = colOf(index, size);
      const sides = [
        row > 0 ? index - size : -1,
        row < size - 1 ? index + size : -1,
        col > 0 ? index - 1 : -1,
        col < size - 1 ? index + 1 : -1,
      ];
      for (const side of sides) {
        if (side < 0 || seen[side] || typed[side] !== id) continue;
        seen[side] = true;
        stack.push(side);
      }
    }
  }
  return found.size === size;
}

/**
 * Whether a solution keeps both rules under a partition (§3, §11): one column
 * per row with no column twice, crowns in neighbouring rows at least two
 * columns apart, and one crown per region.
 */
export function isValidSolution(solution: unknown, regions: Regions, size: number): boolean {
  if (!Array.isArray(solution) || solution.length !== size) return false;
  const cols = solution as unknown[];
  if (
    !cols.every((col) => Number.isInteger(col) && (col as number) >= 0 && (col as number) < size)
  ) {
    return false;
  }
  const typed = cols as number[];
  const usedCol = new Set<number>();
  const usedRegion = new Set<number>();
  for (let row = 0; row < size; row++) {
    const col = typed[row]!;
    if (usedCol.has(col)) return false;
    usedCol.add(col);
    if (row > 0 && Math.abs(col - typed[row - 1]!) <= 1) return false;
    const region = regions[indexOf(row, col, size)];
    if (region === undefined || usedRegion.has(region)) return false;
    usedRegion.add(region);
  }
  return true;
}

/** The marks board a solution reads as: a crown in each row's column, nothing else. */
export function marksOf(solution: Solution, size: number): Mark[] {
  const marks = emptyMarks(size);
  solution.forEach((col, row) => {
    marks[indexOf(row, col, size)] = CROWN;
  });
  return marks;
}
