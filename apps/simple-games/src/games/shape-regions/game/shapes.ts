/**
 * The five shape categories of docs/SHAPE_REGIONS_RULES.md §2, and the catalog
 * of every fixed polyomino that belongs to one of them.
 *
 * `classifyShape` is the one reading of "what shape is this": the violation
 * display (§5), the win (§3), the fail-closed loader (§11) and the placement
 * enumeration (§7) all call it. The five predicates are mutually exclusive —
 * shapes.test.ts proves it over all 306 fixed polyominoes of sizes 2–6 — so a
 * symbol names exactly one family of shapes, which is what makes a symbol-only
 * clue a clue at all.
 *
 * The catalog is built once per module from that same classification: every
 * fixed polyomino of size 2–6 that lands in a category, 101 in all. Anything
 * the classifier rejects (the plus, the W, the U, the F, the P, the X, the
 * T-pentomino with its two-cell stem …) is therefore never generated (§14).
 */
import {
  MAX_REGION_SIZE,
  MIN_REGION_SIZE,
  type ShapeCategory,
  SHAPE_CATEGORIES,
  colOf,
  rowOf,
} from './types';

export interface Offset {
  readonly r: number;
  readonly c: number;
}

/** Sorted row-major, translated so the smallest row and column are 0. */
export type Polyomino = readonly Offset[];

const byRowMajor = (a: Offset, b: Offset): number => a.r - b.r || a.c - b.c;

/** Translates to the origin and sorts row-major, so equal shapes compare equal. */
export function normalize(cells: readonly Offset[]): Offset[] {
  let minR = Infinity;
  let minC = Infinity;
  for (const cell of cells) {
    if (cell.r < minR) minR = cell.r;
    if (cell.c < minC) minC = cell.c;
  }
  return cells.map((cell) => ({ r: cell.r - minR, c: cell.c - minC })).sort(byRowMajor);
}

export const shapeKey = (shape: Polyomino): string =>
  shape.map((cell) => `${cell.r},${cell.c}`).join(';');

/** Cell indices of one board turned into offsets, for classification. */
export function offsetsOf(indices: readonly number[], width: number): Offset[] {
  return indices.map((index) => ({ r: rowOf(index, width), c: colOf(index, width) }));
}

/** Row → the columns held in it, sorted; and the same for columns. */
function lines(cells: readonly Offset[]): {
  rows: Map<number, number[]>;
  cols: Map<number, number[]>;
} {
  const rows = new Map<number, number[]>();
  const cols = new Map<number, number[]>();
  for (const { r, c } of cells) {
    rows.set(r, [...(rows.get(r) ?? []), c]);
    cols.set(c, [...(cols.get(c) ?? []), r]);
  }
  for (const list of rows.values()) list.sort((a, b) => a - b);
  for (const list of cols.values()) list.sort((a, b) => a - b);
  return { rows, cols };
}

/** True when the sorted positions form one unbroken run. */
const contiguous = (sorted: readonly number[]): boolean =>
  sorted.every((value, i) => i === 0 || value === sorted[i - 1]! + 1);

const span = (sorted: readonly number[]): number => sorted[sorted.length - 1]! - sorted[0]! + 1;

/** Line (§2): every cell in one row, or every cell in one column. */
export function isLine(cells: readonly Offset[]): boolean {
  if (cells.length < 2) return false;
  const { rows, cols } = lines(cells);
  return rows.size === 1 || cols.size === 1;
}

/** Block (§2): the bounding box is full, and both sides are at least 2. */
export function isBlock(cells: readonly Offset[]): boolean {
  const { rows, cols } = lines(cells);
  const rowSpan = span([...rows.keys()].sort((a, b) => a - b));
  const colSpan = span([...cols.keys()].sort((a, b) => a - b));
  return rowSpan >= 2 && colSpan >= 2 && cells.length === rowSpan * colSpan;
}

/**
 * Corner (§2): one corner cell, every cell in its row or its column, each of
 * the two arms one unbroken run with the corner at its end and at least one
 * cell beyond it.
 */
export function isCorner(cells: readonly Offset[]): boolean {
  const { rows, cols } = lines(cells);
  const wideRows = [...rows.entries()].filter(([, list]) => list.length >= 2);
  const tallCols = [...cols.entries()].filter(([, list]) => list.length >= 2);
  if (wideRows.length !== 1 || tallCols.length !== 1) return false;
  const [r0, rowCols] = wideRows[0]!;
  const [c0, colRows] = tallCols[0]!;
  if (!contiguous(rowCols) || !contiguous(colRows)) return false;
  // The corner sits where the two arms meet, and at the end of each of them.
  if (!rowCols.includes(c0) || !colRows.includes(r0)) return false;
  if (rowCols[0] !== c0 && rowCols[rowCols.length - 1] !== c0) return false;
  if (colRows[0] !== r0 && colRows[colRows.length - 1] !== r0) return false;
  // Nothing may lie off the two arms.
  return cells.every((cell) => cell.r === r0 || cell.c === c0);
}

/**
 * Tee (§2): a bar of at least three in one line, plus exactly one cell
 * attached orthogonally to a non-end cell of it. Where along the bar it
 * attaches is free, so the lopsided ones are tees too.
 */
export function isTee(cells: readonly Offset[]): boolean {
  const { rows, cols } = lines(cells);
  const tee = (axis: Map<number, number[]>): boolean => {
    if (axis.size !== 2) return false;
    const [a, b] = [...axis.values()];
    const [bar, stem] = a!.length >= b!.length ? [a!, b!] : [b!, a!];
    if (bar.length < 3 || stem.length !== 1 || !contiguous(bar)) return false;
    const at = stem[0]!;
    return at > bar[0]! && at < bar[bar.length - 1]!;
  };
  return tee(rows) || tee(cols);
}

/**
 * Step (§2): two adjacent rows (or columns), one unbroken run in each, the
 * runs overlapping in exactly one column (row), and each run at least two
 * long — which is what keeps the three-cell L and the upright domino out.
 */
export function isStep(cells: readonly Offset[]): boolean {
  const { rows, cols } = lines(cells);
  const step = (axis: Map<number, number[]>): boolean => {
    if (axis.size !== 2) return false;
    const keys = [...axis.keys()].sort((a, b) => a - b);
    if (keys[1] !== keys[0]! + 1) return false;
    const [a, b] = keys.map((key) => axis.get(key)!);
    if (a!.length < 2 || b!.length < 2 || !contiguous(a!) || !contiguous(b!)) return false;
    const lo = Math.max(a![0]!, b![0]!);
    const hi = Math.min(a![a!.length - 1]!, b![b!.length - 1]!);
    return lo === hi;
  };
  return step(rows) || step(cols);
}

const PREDICATES: Record<ShapeCategory, (cells: readonly Offset[]) => boolean> = {
  line: isLine,
  block: isBlock,
  corner: isCorner,
  tee: isTee,
  step: isStep,
};

/** Every category a set of cells satisfies — the test of exclusivity reads this. */
export function categoriesOf(cells: readonly Offset[]): ShapeCategory[] {
  if (cells.length < 2) return [];
  return SHAPE_CATEGORIES.filter((category) => PREDICATES[category](cells));
}

/**
 * The one category a set of cells belongs to, or null for a shape outside the
 * five (§2). Callers pass connected cells; the predicates do not re-check
 * connectivity beyond the runs they read.
 */
export function classifyShape(cells: readonly Offset[]): ShapeCategory | null {
  if (cells.length < 2) return null;
  for (const category of SHAPE_CATEGORIES) if (PREDICATES[category](cells)) return category;
  return null;
}

/** `classifyShape` over board indices. */
export const classifyCells = (indices: readonly number[], width: number): ShapeCategory | null =>
  classifyShape(offsetsOf(indices, width));

/**
 * Every fixed polyomino (orientation counts) of one size, grown cell by cell
 * from the monomino and deduplicated after normalisation. 1, 2, 6, 19, 63,
 * 216 for sizes 1–6 — the whole enumeration is a few thousand operations.
 */
export function fixedPolyominoes(size: number): Polyomino[] {
  let current = new Map<string, Polyomino>([['0,0', [{ r: 0, c: 0 }]]]);
  for (let n = 1; n < size; n++) {
    const next = new Map<string, Polyomino>();
    for (const shape of current.values()) {
      const taken = new Set(shape.map((cell) => `${cell.r},${cell.c}`));
      for (const cell of shape) {
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const grown = { r: cell.r + dr, c: cell.c + dc };
          if (taken.has(`${grown.r},${grown.c}`)) continue;
          const normalized = normalize([...shape, grown]);
          next.set(shapeKey(normalized), normalized);
        }
      }
    }
    current = next;
  }
  return [...current.values()];
}

export interface CatalogShape {
  readonly cells: Polyomino;
  readonly size: number;
  readonly category: ShapeCategory;
  readonly width: number;
  readonly height: number;
}

function buildCatalog(): CatalogShape[] {
  const out: CatalogShape[] = [];
  for (let size = MIN_REGION_SIZE; size <= MAX_REGION_SIZE; size++) {
    for (const cells of fixedPolyominoes(size)) {
      const category = classifyShape(cells);
      if (category === null) continue;
      out.push({
        cells,
        size,
        category,
        width: Math.max(...cells.map((cell) => cell.c)) + 1,
        height: Math.max(...cells.map((cell) => cell.r)) + 1,
      });
    }
  }
  return out;
}

/**
 * The 101 shapes a region may take (§2), in a fixed order so everything built
 * on top — tilings, placements, the golden boards — is deterministic.
 */
export const SHAPE_CATALOG: readonly CatalogShape[] = buildCatalog();

const filtered = new Map<string, readonly CatalogShape[]>();

/** The catalog narrowed to what a clue allows; memoised per (size, category). */
export function catalogFor(
  size: number | null,
  category: ShapeCategory | null,
): readonly CatalogShape[] {
  const key = `${size ?? '*'}/${category ?? '*'}`;
  const cached = filtered.get(key);
  if (cached !== undefined) return cached;
  const list = SHAPE_CATALOG.filter(
    (shape) =>
      (size === null || shape.size === size) && (category === null || shape.category === category),
  );
  filtered.set(key, list);
  return list;
}
