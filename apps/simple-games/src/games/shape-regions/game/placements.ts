/**
 * Candidate placements (docs/SHAPE_REGIONS_RULES.md §7): for each clue, every
 * catalog shape (§2) laid over the board so that it covers the clue's cell,
 * fits inside the grid, and covers no other clue's cell. The clue's size and
 * category narrow the catalog first.
 *
 * Each placement carries its cells as a 64-bit mask split across two 32-bit
 * numbers, so the solvers can ask "does this placement clash with what is
 * fixed" in two ANDs. A 7×7 board is 49 cells, so two words are enough with
 * room to spare; the split is the whole of the bit arithmetic in this game.
 *
 * Enumerated once per clue and never mutated: the solvers filter these lists
 * against the current assignment rather than rebuilding them. Generation
 * re-asks for the same layout with one clue changed dozens of times per
 * board, so a clue's list is memoised by what it depends on — the board, the
 * set of clue cells, and the clue itself. The cache changes no answer, and the
 * work counter never reads it (it counts list lengths, cached or not).
 */
import { catalogFor } from './shapes';
import { colOf, rowOf, type Clue, type Layout } from './types';

/** A set of cells as two 32-bit words: `lo` for cells 0–31, `hi` for 32–63. */
export interface Mask {
  readonly lo: number;
  readonly hi: number;
}

export const EMPTY_MASK: Mask = { lo: 0, hi: 0 };

export function maskOf(cells: readonly number[]): Mask {
  let lo = 0;
  let hi = 0;
  for (const cell of cells) {
    if (cell < 32) lo |= 1 << cell;
    else hi |= 1 << (cell - 32);
  }
  return { lo, hi };
}

export const maskHas = (mask: Mask, cell: number): boolean =>
  cell < 32 ? (mask.lo & (1 << cell)) !== 0 : (mask.hi & (1 << (cell - 32))) !== 0;

export const maskUnion = (a: Mask, b: Mask): Mask => ({ lo: a.lo | b.lo, hi: a.hi | b.hi });
export const maskIntersect = (a: Mask, b: Mask): Mask => ({ lo: a.lo & b.lo, hi: a.hi & b.hi });
/** The cells of `a` that are not in `b`. */
export const maskWithout = (a: Mask, b: Mask): Mask => ({ lo: a.lo & ~b.lo, hi: a.hi & ~b.hi });
export const maskIsEmpty = (mask: Mask): boolean => mask.lo === 0 && mask.hi === 0;
export const masksOverlap = (a: Mask, b: Mask): boolean =>
  (a.lo & b.lo) !== 0 || (a.hi & b.hi) !== 0;
/** True when every cell of `inner` is in `outer`. */
export const maskContains = (outer: Mask, inner: Mask): boolean =>
  (outer.lo & inner.lo) === inner.lo && (outer.hi & inner.hi) === inner.hi;

/** The cells of a mask, ascending. */
export function maskCells(mask: Mask, cellCount: number): number[] {
  const out: number[] = [];
  for (let cell = 0; cell < cellCount; cell++) if (maskHas(mask, cell)) out.push(cell);
  return out;
}

export interface Placement {
  /** The clue (and so the region) this placement is for. */
  readonly region: number;
  /** Position in the region's full list — what T4's exclusions are keyed by. */
  readonly id: number;
  readonly cells: readonly number[];
  readonly mask: Mask;
}

/** Bounded: generation walks many boards, and nothing here needs to outlive one. */
const CACHE_LIMIT = 4096;
const cache = new Map<string, readonly Placement[]>();

function placementsFor(
  layout: Layout,
  region: number,
  clue: Clue,
  clueCells: ReadonlySet<number>,
  key: string,
): readonly Placement[] {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const { width, height } = layout;
  const clueRow = rowOf(clue.index, width);
  const clueCol = colOf(clue.index, width);
  const placements: Placement[] = [];

  for (const shape of catalogFor(clue.size, clue.shape)) {
    // Lay the shape so that each of its cells in turn lands on the clue.
    for (const anchor of shape.cells) {
      const originRow = clueRow - anchor.r;
      const originCol = clueCol - anchor.c;
      if (originRow < 0 || originCol < 0) continue;
      if (originRow + shape.height > height || originCol + shape.width > width) continue;

      const cells: number[] = [];
      let blocked = false;
      for (const cell of shape.cells) {
        const index = (originRow + cell.r) * width + (originCol + cell.c);
        if (index !== clue.index && clueCells.has(index)) {
          blocked = true;
          break;
        }
        cells.push(index);
      }
      if (blocked) continue;
      cells.sort((a, b) => a - b);
      placements.push({ region, id: placements.length, cells, mask: maskOf(cells) });
    }
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, placements);
  return placements;
}

/**
 * Every placement of every clue, indexed by region. A placement for region R
 * always contains R's clue cell and never another clue's, so the solvers only
 * ever have to check it against cells the *player* or a deduction has fixed.
 */
export function enumeratePlacements(layout: Layout): Placement[][] {
  const clueCells = new Set(layout.clues.map((clue) => clue.index));
  const prefix = `${layout.width}x${layout.height}|${[...clueCells].sort((a, b) => a - b).join(',')}|`;
  return layout.clues.map((clue, region) =>
    // The region index is part of the key: the same clue at the same cell is
    // a different placement list when it is clue 3 rather than clue 2.
    [
      ...placementsFor(
        layout,
        region,
        clue,
        clueCells,
        `${prefix}${region}:${clue.index}/${clue.size ?? '*'}/${clue.shape ?? '*'}`,
      ),
    ],
  );
}
