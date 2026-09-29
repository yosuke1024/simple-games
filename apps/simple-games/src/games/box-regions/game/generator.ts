/**
 * Board generation — implements docs/BOX_REGIONS_RULES.md §8.
 *
 * Five steps per candidate. Tile the grid with rectangles by backtracking on
 * the first empty cell in reading order, trying sizes in a seed-shuffled
 * order; pick one clue cell per box and give it both its number and its kind;
 * prove the puzzle unique with the exact-cover search; thin the clues in seed
 * order, only while the tier's invariants hold and only as far as the tier
 * asks; then grade with the technique solver and ship if the grade is the
 * tier's. A candidate that misses costs one derived seed and another try
 * (`<seed>#2`, `#3`, …).
 *
 * The gate on all of this is work, never wall clock — `solverWork`.
 */
import { rectOfCells, kindOf, rectArea } from './rects';
import { createRng, shuffled } from './rng';
import { countSolutions, gradeLayout, solvableBasic, solverWork, type Grade } from './solver';
import {
  MAX_REGIONS,
  MAX_REGION_SIZE,
  MAX_UNIT_REGIONS,
  PRESETS,
  cellCount,
  neighbors,
  type Clue,
  type Difficulty,
  type Layout,
  type Preset,
} from './types';

/** Derived seeds tried before shipping the best candidate anyway (§8). */
export const ATTEMPT_LIMIT = 60;

/**
 * Clue-cell draws per tiling before the tiling is given up on (§8, step 3).
 * Where a clue sits decides whether two neighbouring boxes can trade cells,
 * so a tiling that is ambiguous under one draw is often unique under another
 * — and a draw costs one exact-cover count where a tiling costs a search.
 */
export const CLUE_DRAWS = 4;

/**
 * Backtracking nodes a tiling may spend before the seed is given up on. A
 * 7×7 tiles in a handful of nodes; this only keeps a pathological seed from
 * spinning, and a null tiling costs one derived seed like any other miss.
 */
export const TILING_NODE_LIMIT = 4000;

export interface TierSpec {
  /** How many clues to thin, given the clue count (§7). */
  readonly reduceTarget: (clueCount: number) => number;
  /** The fewest thinned clues the tier accepts, given the clue count (§7). */
  readonly reduceFloor: (clueCount: number) => number;
  /** Whether a clue may lose both sides and say nothing but `free` (§7). */
  readonly allowBare: boolean;
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
    allowBare: false,
    keepBasic: true,
    grades: ['basic'],
  },
  medium: {
    reduceTarget: (n) => Math.ceil(n * 0.5),
    reduceFloor: (n) => Math.ceil(n * 0.5),
    allowBare: true,
    keepBasic: true,
    grades: ['basic'],
  },
  hard: {
    reduceTarget: (n) => n,
    reduceFloor: () => 0,
    allowBare: true,
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
  /** How many clues lost their number, their kind, or both (§8, step 4). */
  readonly reducedCount: number;
  /** How many of those lost both and say only `free` (§2). */
  readonly bareCount: number;
  /** What the technique solver made of it (§7). */
  readonly grade: Grade;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Placements checked and nodes searched to build this puzzle (§8). */
  readonly work: number;
  /** True when the cap was hit and the best candidate shipped anyway (§8, step 7). */
  readonly fallback: boolean;
}

/** Every rectangle size a box may take on this board: area 1–12, inside the grid. */
function dimensionsFor(preset: Preset): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  for (let h = 1; h <= preset.height; h++) {
    for (let w = 1; w <= preset.width; w++) {
      if (w * h <= MAX_REGION_SIZE) out.push([w, h]);
    }
  }
  return out;
}

/**
 * Tiles the grid with rectangles (§8, step 1): the first empty cell in
 * reading order is always a box's top-left corner, since everything before
 * it is covered. Region indices follow placement order. Null when the node
 * budget runs out or no tiling keeps to 26 boxes and two 1×1s.
 */
export function tileGrid(preset: Preset, rng: () => number): number[] | null {
  const { width, height } = preset;
  const cells = cellCount(preset);
  const dimensions = dimensionsFor(preset);
  const filled = new Array<number>(cells).fill(-1);
  let regionCount = 0;
  let units = 0;
  let nodes = 0;

  const fits = (row: number, col: number, w: number, h: number): boolean => {
    if (row + h > height || col + w > width) return false;
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) if (filled[r * width + c] !== -1) return false;
    }
    return true;
  };

  const paint = (row: number, col: number, w: number, h: number, value: number): void => {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) filled[r * width + c] = value;
    }
  };

  /**
   * An empty cell with no empty neighbour can only ever be a 1×1 (§8). More
   * of those than the unit budget has left means this branch cannot finish.
   */
  const stranded = (): boolean => {
    let isolated = 0;
    for (let index = 0; index < cells; index++) {
      if (filled[index] !== -1) continue;
      if (neighbors(index, width, height).some((next) => filled[next] === -1)) continue;
      if (units + ++isolated > MAX_UNIT_REGIONS) return true;
    }
    return false;
  };

  const place = (): boolean => {
    if (++nodes > TILING_NODE_LIMIT) return false;
    const first = filled.indexOf(-1);
    if (first === -1) return true;
    if (regionCount >= MAX_REGIONS) return false;
    const row = Math.floor(first / width);
    const col = first % width;
    for (const [w, h] of shuffled(dimensions, rng)) {
      const unit = w * h === 1;
      if (unit && units >= MAX_UNIT_REGIONS) continue;
      if (!fits(row, col, w, h)) continue;
      const region = regionCount++;
      if (unit) units++;
      paint(row, col, w, h, region);
      if (!stranded() && place()) return true;
      paint(row, col, w, h, -1);
      if (unit) units--;
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
  readonly bareCount: number;
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

  // Steps 2–3: one clue cell per box with both sides given, redrawn a few
  // times if the first draw is not unique. Every region came from the tiling
  // as a rectangle, so its kind is read straight off its sides.
  let unique: Clue[] | null = null;
  for (let draw = 0; draw < CLUE_DRAWS && unique === null; draw++) {
    const drawn: Clue[] = regions.map((cells) => {
      const rect = rectOfCells(cells, preset.width)!;
      return {
        index: cells[Math.floor(rng() * cells.length)]!,
        size: rectArea(rect),
        kind: kindOf(rect.width, rect.height),
      };
    });
    if (countSolutions(layoutWith(drawn)) === 1) unique = drawn;
  }
  if (unique === null) return null;
  let clues: Clue[] = unique;

  // Step 4: thin in seed order while the invariants hold.
  const accepts = (next: Clue[]): boolean => {
    const layout = layoutWith(next);
    if (countSolutions(layout) !== 1) return false;
    return !tier.keepBasic || solvableBasic(layout);
  };
  const withClue = (region: number, clue: Clue): Clue[] =>
    clues.map((current, i) => (i === region ? clue : current));

  const target = tier.reduceTarget(clues.length);
  const order = shuffled(
    clues.map((_, region) => region),
    rng,
  );
  let reducedCount = 0;
  let bareCount = 0;
  for (const region of order) {
    if (reducedCount >= target) break;
    const full = clues[region]!;
    const dropKindFirst = rng() < 0.5;
    const noNumber: Clue = { ...full, size: null };
    const noKind: Clue = { ...full, kind: 'free' };
    const options = dropKindFirst ? [noKind, noNumber] : [noNumber, noKind];
    for (const option of options) {
      const next = withClue(region, option);
      if (!accepts(next)) continue;
      clues = next;
      reducedCount++;
      if (tier.allowBare) {
        const bare = withClue(region, { ...full, size: null, kind: 'free' });
        if (accepts(bare)) {
          clues = bare;
          bareCount++;
        }
      }
      break;
    }
  }

  const layout = layoutWith(clues);
  return { layout, solution: tiling, reducedCount, bareCount, grade: gradeLayout(layout) };
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
 * When the cap is reached the most-thinned candidate the tier's techniques
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
  const ship = (candidate: Candidate, attempts: number, fallback: boolean): GeneratedPuzzle => ({
    width: preset.width,
    height: preset.height,
    clues: candidate.layout.clues,
    solution: candidate.solution,
    reducedCount: candidate.reducedCount,
    bareCount: candidate.bareCount,
    grade: candidate.grade,
    attempts,
    work: solverWork.read() - before,
    fallback,
  });

  for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const candidate = buildCandidate(derived, preset, tier);
    if (candidate === null) continue;
    if (meetsTier(candidate, tier)) return ship(candidate, attempt, false);
    if (
      acceptable.includes(candidate.grade) &&
      (best === null || candidate.reducedCount > best.reducedCount)
    ) {
      best = candidate;
    }
  }

  // No candidate at all would mean no tiling was unique and solvable across
  // sixty seeds, which cannot happen for a legal preset and would mean this
  // file is broken.
  if (best === null) {
    throw new Error(
      `box-regions: no ${preset.width}x${preset.height} puzzle after ${ATTEMPT_LIMIT} seeds from "${seed}"`,
    );
  }
  return ship(best, ATTEMPT_LIMIT, true);
}
