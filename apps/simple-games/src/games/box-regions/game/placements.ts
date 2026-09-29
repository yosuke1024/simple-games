/**
 * Candidate placements (docs/BOX_REGIONS_RULES.md §7): for each clue, every
 * rectangle that contains the clue's cell, contains no other clue's cell,
 * fits the board, has area 1–12, and answers to the clue's number and kind
 * (`rectSatisfiesClue`, the same reading the win uses).
 *
 * Each placement carries its cells as a 64-bit mask split across two 32-bit
 * numbers, so the solvers can ask "does this placement clash with what is
 * fixed" in two ANDs. A 7×7 board is 49 cells, so two words are enough.
 *
 * Enumerated once per clue and never mutated: the solvers filter these lists
 * against the current assignment rather than rebuilding them. Generation
 * re-asks for the same layout with one clue changed dozens of times per
 * board, so a clue's list is memoised by what it depends on — the board, the
 * set of clue cells, and the clue itself. The cache changes no answer, and the
 * work counter never reads it (it counts list lengths, cached or not).
 */
import { rectCells, rectSatisfiesClue, type Rect } from './rects';
import { MAX_REGION_SIZE, colOf, rowOf, type Clue, type Layout } from './types';

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
export const maskEquals = (a: Mask, b: Mask): boolean => a.lo === b.lo && a.hi === b.hi;
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
  readonly rect: Rect;
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

  // Every rectangle size, then every position of it that covers the clue —
  // a fixed order, so a placement's id is the same on every run.
  for (let h = 1; h <= height; h++) {
    for (let w = 1; w <= width; w++) {
      if (w * h > MAX_REGION_SIZE) continue;
      for (let top = Math.max(0, clueRow - h + 1); top <= clueRow && top + h <= height; top++) {
        for (
          let left = Math.max(0, clueCol - w + 1);
          left <= clueCol && left + w <= width;
          left++
        ) {
          const rect: Rect = { top, left, width: w, height: h };
          if (!rectSatisfiesClue(rect, clue)) continue;
          const cells = rectCells(rect, width);
          if (cells.some((cell) => cell !== clue.index && clueCells.has(cell))) continue;
          placements.push({ region, id: placements.length, rect, cells, mask: maskOf(cells) });
        }
      }
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
  return layout.clues.map((clue, region) => [
    ...placementsFor(
      layout,
      region,
      clue,
      clueCells,
      `${prefix}${region}:${clue.index}/${clue.size ?? '*'}/${clue.kind}`,
    ),
  ]);
}
