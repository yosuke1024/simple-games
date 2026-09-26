/**
 * Board generation — implements docs/SHAPE_REGIONS_RULES.md §8.
 *
 * Five steps per candidate. Tile the grid with catalog shapes (§2) by
 * backtracking on the first empty cell in a seed-shuffled shape order; pick
 * one clue cell per region and give it both its number and its symbol; prove
 * the puzzle unique with the exact-cover search; reduce clues to one side
 * each, in seed order, only while the tier's invariants hold and only as far
 * as the tier asks; then grade with the technique solver and ship if the
 * grade is the tier's. A candidate that misses costs one derived seed and
 * another try (`<seed>#2`, `#3`, …), the same shape Takuzu §6 uses.
 *
 * The gate on all of this is work, never wall clock — `solverWork`.
 */
import { createRng, shuffled } from './rng';
import { SHAPE_CATALOG, classifyCells, type CatalogShape } from './shapes';
import { countSolutions, gradeLayout, solvableBasic, solverWork, type Grade } from './solver';
import {
  PRESETS,
  cellCount,
  neighbors,
  type Clue,
  type Difficulty,
  type Layout,
  type Preset,
  type ShapeCategory,
} from './types';

/** Derived seeds tried before shipping the best candidate anyway (§8). */
export const ATTEMPT_LIMIT = 60;

/**
 * Clue-cell draws per tiling before the tiling is given up on (§8, step 2).
 * Where a clue sits decides whether two neighbouring regions can trade cells,
 * so a tiling that is ambiguous under one draw is often unique under another
 * — and a draw costs one exact-cover count where a tiling costs a search.
 */
export const CLUE_DRAWS = 4;

/**
 * Backtracking nodes a tiling may spend before the seed is given up on. A
 * 7×7 tiles in a few dozen nodes; this only keeps a pathological seed from
 * spinning, and a null tiling costs one derived seed like any other miss.
 */
export const TILING_NODE_LIMIT = 4000;

export interface TierSpec {
  /** How many clues to reduce to one side, given the clue count (§7). */
  readonly reduceTarget: (clueCount: number) => number;
  /** The fewest reductions the tier accepts, given the clue count (§7). */
  readonly reduceFloor: (clueCount: number) => number;
  /**
   * Whether a reduction must also leave the puzzle T1–T3 solvable (§8, step
   * 4). Easy and Medium keep that invariant step by step; Hard keeps only
   * uniqueness and asks the grade afterwards.
   */
  readonly keepBasic: boolean;
  /** The grades the tier accepts (§7). */
  readonly grades: readonly Grade[];
}

/** The tier table of §7, verbatim. */
export const TIERS: Record<Difficulty, TierSpec> = {
  easy: {
    reduceTarget: (n) => Math.floor(n * 0.25),
    reduceFloor: () => 0,
    keepBasic: true,
    grades: ['basic'],
  },
  medium: {
    reduceTarget: (n) => Math.ceil(n * 0.5),
    reduceFloor: (n) => Math.ceil(n * 0.5),
    keepBasic: true,
    grades: ['basic'],
  },
  hard: {
    reduceTarget: (n) => n,
    reduceFloor: () => 0,
    keepBasic: false,
    grades: ['advanced'],
  },
};

export interface GeneratedPuzzle {
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  /** Region index per cell, row-major. */
  readonly solution: readonly number[];
  /** How many clues carry only one of number / symbol (§8, step 4). */
  readonly reducedCount: number;
  /** What the technique solver made of it (§7). */
  readonly grade: Grade;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Placements checked and nodes searched to build this puzzle (§8). */
  readonly work: number;
  /** True when the cap was hit and the best candidate shipped anyway (§8, step 7). */
  readonly fallback: boolean;
}

/**
 * Tiles the grid with catalog shapes (§8, step 1). Region indices follow
 * placement order. Null when the node budget runs out.
 */
export function tileGrid(preset: Preset, rng: () => number): number[] | null {
  const { width, height } = preset;
  const cells = cellCount(preset);
  const filled = new Array<number>(cells).fill(-1);
  let regionCount = 0;
  let nodes = 0;

  const fits = (shape: CatalogShape, originRow: number, originCol: number): number[] | null => {
    if (originRow < 0 || originCol < 0) return null;
    if (originRow + shape.height > height || originCol + shape.width > width) return null;
    const indices: number[] = [];
    for (const cell of shape.cells) {
      const index = (originRow + cell.r) * width + (originCol + cell.c);
      if (filled[index] !== -1) return null;
      indices.push(index);
    }
    return indices;
  };

  /** An empty cell with no empty neighbour can never be covered (§8). */
  const strandsNothing = (placed: readonly number[]): boolean => {
    for (const index of placed) {
      for (const next of neighbors(index, width, height)) {
        if (filled[next] !== -1) continue;
        const free = neighbors(next, width, height).some((n) => filled[n] === -1);
        if (!free) return false;
      }
    }
    return true;
  };

  const place = (): boolean => {
    if (++nodes > TILING_NODE_LIMIT) return false;
    const first = filled.indexOf(-1);
    if (first === -1) return true;
    const row = Math.floor(first / width);
    const col = first % width;
    for (const shape of shuffled(SHAPE_CATALOG, rng)) {
      // The first empty cell in reading order must be the shape's first cell
      // in reading order: everything before it is already covered.
      const anchor = shape.cells[0]!;
      const indices = fits(shape, row - anchor.r, col - anchor.c);
      if (indices === null) continue;
      const region = regionCount++;
      for (const index of indices) filled[index] = region;
      if (strandsNothing(indices) && place()) return true;
      for (const index of indices) filled[index] = -1;
      regionCount--;
      if (nodes > TILING_NODE_LIMIT) return false;
    }
    return false;
  };

  return place() ? filled : null;
}

/** The cells of each region of a tiling, ascending, indexed by region. */
export function regionsOf(tiling: readonly number[]): number[][] {
  const out: number[][] = [];
  tiling.forEach((region, index) => {
    (out[region] ??= []).push(index);
  });
  return out;
}

export interface Candidate {
  readonly layout: Layout;
  readonly solution: readonly number[];
  readonly reducedCount: number;
  readonly grade: Grade;
}

/**
 * One candidate from one seed (§8, steps 1–5), or null when the tiling
 * failed or no clue draw made the full-clue puzzle unique. Exported for the
 * tests that pin the tier definitions; play goes through `generatePuzzle`.
 */
export function buildCandidate(seed: string, preset: Preset, tier: TierSpec): Candidate | null {
  const rng = createRng(seed);
  const tiling = tileGrid(preset, rng);
  if (tiling === null) return null;
  const regions = regionsOf(tiling);
  const layoutWith = (next: readonly Clue[]): Layout => ({
    width: preset.width,
    height: preset.height,
    clues: next,
  });

  // Steps 2–3: one clue cell per region with both sides given, redrawn a few
  // times if the first draw is not unique. Every region came from the
  // catalog, so it has a category by construction.
  let unique: Clue[] | null = null;
  for (let draw = 0; draw < CLUE_DRAWS && unique === null; draw++) {
    const drawn: Clue[] = regions.map((cells) => ({
      index: cells[Math.floor(rng() * cells.length)]!,
      size: cells.length,
      shape: classifyCells(cells, preset.width) as ShapeCategory,
    }));
    if (countSolutions(layoutWith(drawn)) === 1) unique = drawn;
  }
  if (unique === null) return null;
  let clues: Clue[] = unique;

  // Step 4: reduce in seed order, one side per clue, while the invariants hold.
  const target = tier.reduceTarget(clues.length);
  const order = shuffled(
    clues.map((_, region) => region),
    rng,
  );
  let reducedCount = 0;
  for (const region of order) {
    if (reducedCount >= target) break;
    const full = clues[region]!;
    const dropShapeFirst = rng() < 0.5;
    const options: Clue[] = dropShapeFirst
      ? [
          { ...full, shape: null },
          { ...full, size: null },
        ]
      : [
          { ...full, size: null },
          { ...full, shape: null },
        ];
    for (const option of options) {
      const next: Clue[] = clues.map((clue, i) => (i === region ? option : clue));
      const layout = layoutWith(next);
      if (countSolutions(layout) !== 1) continue;
      if (tier.keepBasic && !solvableBasic(layout)) continue;
      clues = next;
      reducedCount++;
      break;
    }
  }

  const layout = layoutWith(clues);
  return { layout, solution: tiling, reducedCount, grade: gradeLayout(layout) };
}

/** Whether a candidate meets its tier (§7). */
export function meetsTier(candidate: Candidate, tier: TierSpec): boolean {
  if (!tier.grades.includes(candidate.grade)) return false;
  return candidate.reducedCount >= tier.reduceFloor(candidate.layout.clues.length);
}

/**
 * The same seed always returns the same puzzle (§8): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the puzzle that ships is a
 * pure function of the seed and the difficulty alone.
 *
 * When the cap is reached the most-reduced candidate the tier's techniques
 * can solve ships with `fallback` set (§8, step 7). It is still unique and
 * still solvable; Hard alone loses its "needs T4" promise. Tests watch the
 * rate (it is zero across every walked seed today).
 */
export function generatePuzzle(seed: string, difficulty: Difficulty): GeneratedPuzzle {
  const preset = PRESETS[difficulty];
  const tier = TIERS[difficulty];
  const before = solverWork.read();
  const acceptable: readonly Grade[] = difficulty === 'hard' ? ['basic', 'advanced'] : tier.grades;

  let best: Candidate | null = null;

  for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const candidate = buildCandidate(derived, preset, tier);
    if (candidate === null) continue;
    if (meetsTier(candidate, tier)) {
      return {
        width: preset.width,
        height: preset.height,
        clues: candidate.layout.clues,
        solution: candidate.solution,
        reducedCount: candidate.reducedCount,
        grade: candidate.grade,
        attempts: attempt,
        work: solverWork.read() - before,
        fallback: false,
      };
    }
    if (
      acceptable.includes(candidate.grade) &&
      (best === null || candidate.reducedCount > best.reducedCount)
    ) {
      best = candidate;
    }
  }

  // Two failures live here and only one may ship. A candidate short of its
  // tier is a real, unique, solvable puzzle that is easier than promised, so
  // it goes out with `fallback` set (§8). No candidate at all would mean no
  // tiling was unique and solvable across sixty seeds, which cannot happen for
  // a legal preset and would mean this file is broken.
  if (best === null) {
    throw new Error(
      `shape-regions: no ${preset.width}x${preset.height} puzzle after ${ATTEMPT_LIMIT} seeds from "${seed}"`,
    );
  }
  return {
    width: preset.width,
    height: preset.height,
    clues: best.layout.clues,
    solution: best.solution,
    reducedCount: best.reducedCount,
    grade: best.grade,
    attempts: ATTEMPT_LIMIT,
    work: solverWork.read() - before,
    fallback: true,
  };
}
