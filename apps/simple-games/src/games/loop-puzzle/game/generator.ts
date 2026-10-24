/**
 * Board generation — implements docs/LOOP_PUZZLE_RULES.md §8.
 *
 * Per candidate: grow a random region of cells that stays one piece with no
 * hole (its boundary is then one simple loop); count every cell's loop edges
 * for the full set of clues; thin the clues in seed order while the tier's
 * techniques still solve the board (sound techniques that settle every edge
 * prove the board unique on their own); prove uniqueness again with the
 * counting search; and grade. A candidate that misses its tier costs one
 * derived seed (`<seed>#2`, `#3`, …).
 *
 * The gate on all of this is work, never wall clock — `solverWork`. Every
 * solver call gets what is left of GENERATION_WORK_LIMIT (and never more
 * than its own limit); when the budget is spent, or no derived seed lands
 * within ATTEMPT_LIMIT, a bundled board this generator produced (and a test
 * re-proves) ships instead, marked `fallback`.
 */
import { BUNDLED_BOARDS } from './bundled';
import { decodeClues } from './serialize';
import { gridFor } from './grid';
import { createRng, hashSeed, shuffled } from './rng';
import {
  TECHNIQUE_WORK_LIMIT,
  gradeOf,
  solveWithTechniques,
  solverWork,
  uniqueSolution,
  type Level,
} from './solver';
import {
  CROSS,
  LINE,
  PRESETS,
  cellCount,
  type Clue,
  type Difficulty,
  type Layout,
  type Mark,
  type Preset,
} from './types';

/** Derived seeds tried before the bundled fallback ships (§8). */
export const ATTEMPT_LIMIT = 24;

/**
 * Solver work one `generatePuzzle` call may spend on derived seeds (§8).
 * Every solver call inside gets what is left of it, so the total is bounded
 * by the budget plus one region growth, one propagation's overshoot and the
 * bundled board's own check — never by the product of the separate limits.
 * Once it is spent, the bundled fallback ships. Every Easy and Medium board
 * measured stays far below it, and one Hard seed in 35,000 reached it (§8):
 * it is a ceiling, not a target.
 */
export const GENERATION_WORK_LIMIT = 400_000;

/**
 * Search nodes one removal check may spend while Hard thins with T3 (§8,
 * step 3). Almost every check settles in a few dozen; the rare one that runs
 * out keeps its clue — not proven unique is never treated as unique — so a
 * pathological removal costs a bounded amount and nothing else. Removals
 * that do prove unique almost never need more than 400 nodes (§8), while
 * the ones that run out are most of the cost of the slowest boards.
 */
export const THINNING_NODE_LIMIT = 400;

export interface TierSpec {
  /** The technique set that must solve the board (§7). */
  readonly level: Level;
  /**
   * The board must need that set — not be solvable by the one below it
   * (§7). Easy needs nothing beyond T1, so it is false there.
   */
  readonly needsLevel: boolean;
  /** Thinning stops once this many clues are left (§7); 0 thins as far as the techniques allow. */
  readonly clueTarget: number;
  /** The most clues the tier ships with (§7). */
  readonly clueMax: number;
  /** The region's share of the cells, as a range (§8, step 1). */
  readonly regionShare: readonly [number, number];
}

/** The tier table of §7, verbatim. */
export const TIERS: Record<Difficulty, TierSpec> = {
  easy: { level: 1, needsLevel: false, clueTarget: 9, clueMax: 11, regionShare: [0.4, 0.6] },
  medium: { level: 2, needsLevel: true, clueTarget: 12, clueMax: 14, regionShare: [0.4, 0.6] },
  hard: { level: 3, needsLevel: true, clueTarget: 0, clueMax: 16, regionShare: [0.4, 0.6] },
};

export interface GeneratedPuzzle {
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  /** The answer: LINE on every loop edge, CROSS elsewhere. */
  readonly solution: readonly Mark[];
  /** The cheapest technique set that solves it (§7). */
  readonly grade: Level;
  /** Edges T3 had to decide by trial — 0 below Hard (§7). */
  readonly trials: number;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Solver work spent to build this puzzle (§8). */
  readonly work: number;
  /**
   * True when no seed landed within ATTEMPT_LIMIT or GENERATION_WORK_LIMIT
   * and a bundled board shipped instead (§8, step 6).
   */
  readonly fallback: boolean;
}

/** The region grown in step 1: which cells are inside, and how many. */
export interface Region {
  readonly inside: readonly boolean[];
  readonly size: number;
}

/**
 * Whether the cells outside the region — together with the world beyond the
 * board's edge — stay one connected piece once `added` joins the region. It
 * is what keeps the region free of holes, and so its boundary one loop (§8).
 */
function outsideStaysConnected(preset: Preset, inside: Uint8Array, added: number): boolean {
  const { width, height } = preset;
  const cells = width * height;
  const seen = new Uint8Array(cells);
  const stack: number[] = [];
  let outside = 0;
  for (let cell = 0; cell < cells; cell++) {
    if (inside[cell] === 1 || cell === added) continue;
    outside++;
    const row = Math.floor(cell / width);
    const col = cell % width;
    if (row === 0 || col === 0 || row === height - 1 || col === width - 1) {
      seen[cell] = 1;
      stack.push(cell);
    }
  }
  let reached = stack.length;
  while (stack.length > 0) {
    const cell = stack.pop()!;
    solverWork.add(1);
    const row = Math.floor(cell / width);
    const col = cell % width;
    const next = [
      row > 0 ? cell - width : -1,
      col < width - 1 ? cell + 1 : -1,
      row < height - 1 ? cell + width : -1,
      col > 0 ? cell - 1 : -1,
    ];
    for (const n of next) {
      if (n < 0 || seen[n] === 1 || inside[n] === 1 || n === added) continue;
      seen[n] = 1;
      reached++;
      stack.push(n);
    }
  }
  return reached === outside;
}

/**
 * How likely a neighbouring cell is to join the region, by how many of its
 * sides already touch it (§8, step 1): one side six times as likely as
 * three, so the loop winds instead of filling a blob. Four sides would fill
 * a hole, which the region never has.
 */
const GROWTH_WEIGHTS = [0, 6, 2, 1, 0] as const;

/**
 * Grows a region from one seeded cell (§8, step 1): repeatedly adds a
 * neighbouring cell, drawn by GROWTH_WEIGHTS, and never one that would
 * enclose a hole. Its boundary is a single simple loop by construction. The
 * work is bounded by construction — at most one addition per cell, each
 * trying at most every cell once — and charged to `solverWork`.
 */
export function growRegion(preset: Preset, rng: () => number, target: number): Region {
  const { width, height } = preset;
  const cells = width * height;
  const inside = new Uint8Array(cells);
  const start = Math.floor(rng() * cells);
  inside[start] = 1;
  let size = 1;
  while (size < target) {
    const candidates: number[] = [];
    const weights: number[] = [];
    for (let cell = 0; cell < cells; cell++) {
      if (inside[cell] === 1) continue;
      const row = Math.floor(cell / width);
      const col = cell % width;
      let touching = 0;
      if (row > 0 && inside[cell - width] === 1) touching++;
      if (col < width - 1 && inside[cell + 1] === 1) touching++;
      if (row < height - 1 && inside[cell + width] === 1) touching++;
      if (col > 0 && inside[cell - 1] === 1) touching++;
      const weight = GROWTH_WEIGHTS[touching]!;
      if (weight === 0) continue;
      candidates.push(cell);
      weights.push(weight);
    }
    let added = -1;
    while (candidates.length > 0) {
      const total = weights.reduce((a, b) => a + b, 0);
      let pick = rng() * total;
      let i = 0;
      while (i < weights.length - 1 && pick >= weights[i]!) {
        pick -= weights[i]!;
        i++;
      }
      const cell = candidates[i]!;
      if (outsideStaysConnected(preset, inside, cell)) {
        added = cell;
        break;
      }
      candidates.splice(i, 1);
      weights.splice(i, 1);
    }
    if (added < 0) break;
    inside[added] = 1;
    size++;
  }
  return { inside: Array.from(inside, (v) => v === 1), size };
}

/** The loop a region's boundary draws: LINE where the two sides of an edge differ. */
export function loopOfRegion(preset: Preset, inside: readonly boolean[]): Mark[] {
  const grid = gridFor(preset.width, preset.height);
  const marks: Mark[] = [];
  for (let edge = 0; edge < grid.edgeCount; edge++) {
    const a = grid.edgeCells[2 * edge]!;
    const b = grid.edgeCells[2 * edge + 1]!;
    const sideA = a >= 0 && inside[a] === true;
    const sideB = b >= 0 && inside[b] === true;
    marks.push(sideA === sideB ? CROSS : LINE);
  }
  return marks;
}

/** Every cell's count of loop edges — the full clue set (§8, step 2). */
export function cluesOfLoop(preset: Preset, loop: readonly Mark[]): number[] {
  const grid = gridFor(preset.width, preset.height);
  const clues: number[] = [];
  for (let cell = 0; cell < grid.cellCount; cell++) {
    let count = 0;
    for (let k = 0; k < 4; k++) if (loop[grid.cellEdges[4 * cell + k]!] === LINE) count++;
    clues.push(count);
  }
  return clues;
}

export interface Candidate {
  readonly layout: Layout;
  readonly solution: readonly Mark[];
  readonly grade: Level;
  readonly trials: number;
}

/**
 * Whether a layout is still acceptable at `level` after a clue came off
 * (§8, step 3), within `workLeft` (out of budget: not accepted, the clue
 * stays). For T3 the counting search goes first: most removals that break a
 * minimal T1 + T2 board leave two loops, which the count shows in a few
 * dozen nodes, while a trial solve would only run out of trials.
 *
 * At levels 1 and 2 the test is monotone — fewer clues never make a board
 * more solvable — which is what lets the thinning below batch its removals.
 * At level 3 it is monotone in what it decides but not in what it costs:
 * the count's node limit and the trial solve's work limit could, in
 * principle, run out on a board with more clues and not on one with fewer.
 * `generator.test.ts` measures the batched and the one-at-a-time thinning
 * equal on real seeds of every tier; nothing proves it.
 */
function acceptsAt(
  layout: Layout,
  level: Level,
  known: readonly Mark[],
  workLeft: () => number,
): boolean {
  if (workLeft() <= 0) return false;
  if (
    level === 3 &&
    uniqueSolution(layout, {
      known,
      nodeLimit: THINNING_NODE_LIMIT,
      workLimit: workLeft(),
    }) === null
  ) {
    return false;
  }
  const limit = Math.min(TECHNIQUE_WORK_LIMIT, workLeft());
  return solveWithTechniques(layout, level, undefined, limit).status === 'solved';
}

/**
 * Removes clues in `order` while `accepts` holds, stopping at `target` clues
 * left (0: no target). For a monotone `accepts` this is exactly the result
 * of trying the cells one at a time: a batch is taken whole only when the
 * board without all of it is still accepted — and then, by monotonicity, so
 * is every board in between. The first batch that fails is retried cell by
 * cell, and from there on every cell is tried alone (the board is close to
 * minimal by then).
 */
export function thinClues(
  clues: Clue[],
  order: readonly number[],
  target: number,
  batchSize: number,
  accepts: (next: Clue[]) => boolean,
): Clue[] {
  let current = clues;
  let count = current.filter((clue) => clue !== null).length;
  let batch = batchSize;
  let i = 0;
  while (i < order.length && (target === 0 || count > target)) {
    const room = target === 0 ? Infinity : count - target;
    const take: number[] = [];
    let j = i;
    while (j < order.length && take.length < Math.min(batch, room)) {
      if (current[order[j]!] !== null) take.push(order[j]!);
      j++;
    }
    if (take.length === 0) break;
    const next = [...current];
    for (const cell of take) next[cell] = null;
    if (accepts(next)) {
      current = next;
      count -= take.length;
      i = j;
      continue;
    }
    if (take.length === 1) {
      i = j;
      continue;
    }
    // Retry this batch one cell at a time, and stay at one from here on.
    batch = 1;
  }
  return current;
}

export interface CandidateOptions {
  /**
   * Clues taken off together in the first thinning checks (§8, step 3); the
   * default is a fifth of the cells. The tests compare it with batches of one.
   */
  readonly batchSize?: number;
  /** Work this candidate may spend (§8); unlimited by default. */
  readonly workLimit?: number;
}

/**
 * One candidate from one seed (§8, steps 1–5), or null when it misses: the
 * region came out too small, the full clue set is not solvable at the tier's
 * level, the counting search does not prove the thinned board unique, or
 * the work limit ran out first. Exported for the tests that pin the tier
 * definitions; play goes through `generatePuzzle`.
 */
export function buildCandidate(
  seed: string,
  preset: Preset,
  tier: TierSpec,
  options: CandidateOptions = {},
): Candidate | null {
  const end = solverWork.read() + (options.workLimit ?? Infinity);
  const workLeft = (): number => end - solverWork.read();
  const techniqueLimit = (): number => Math.min(TECHNIQUE_WORK_LIMIT, workLeft());
  const rng = createRng(seed);
  const cells = cellCount(preset);
  const [lo, hi] = tier.regionShare;
  const target = Math.max(2, Math.round(cells * (lo + (hi - lo) * rng())));
  const region = growRegion(preset, rng, target);
  if (region.size < 2) return null;
  const solution = loopOfRegion(preset, region.inside);
  const layoutOf = (clues: readonly Clue[]): Layout => ({
    width: preset.width,
    height: preset.height,
    clues,
  });

  // Step 2: every cell's number.
  let clues: Clue[] = cluesOfLoop(preset, solution);
  const full = solveWithTechniques(layoutOf(clues), tier.level, undefined, techniqueLimit());
  if (full.status !== 'solved') return null;

  // Step 3: thin in seed order while the tier's techniques still finish the
  // board. Hard thins first as far as T1 + T2 allow (cheap), then goes on
  // with T3.
  const order = shuffled(
    clues.map((_, cell) => cell),
    rng,
  );
  const batchSize = options.batchSize ?? Math.ceil(cells / 5);
  const passes: Level[] = tier.level === 3 ? [2, 3] : [tier.level];
  for (const level of passes) {
    clues = thinClues(clues, order, tier.clueTarget, batchSize, (next) =>
      acceptsAt(layoutOf(next), level, solution, workLeft),
    );
  }

  // Step 4: the counting search proves uniqueness on its own terms, and must
  // land on the loop the board was grown from. (Out of budget, it is not
  // complete — not proven, so not shipped.)
  const layout = layoutOf(clues);
  const proven = uniqueSolution(layout, { workLimit: workLeft() });
  if (proven === null || proven.some((mark, edge) => mark !== solution[edge])) return null;

  // Step 5: grade — the cheapest technique set that solves it.
  const graded = gradeOf(layout, tier.level, workLeft());
  if (graded === null) return null;
  return { layout, solution, grade: graded.grade, trials: graded.trials };
}

/** Whether a candidate meets its tier (§7). */
export function meetsTier(candidate: Candidate, tier: TierSpec): boolean {
  if (candidate.grade !== tier.level && tier.needsLevel) return false;
  if (candidate.grade > tier.level) return false;
  const clueCount = candidate.layout.clues.filter((clue) => clue !== null).length;
  return clueCount <= tier.clueMax;
}

/** A bundled board for this tier, chosen by the seed (§8, step 6). */
export function bundledPuzzle(seed: string, difficulty: Difficulty): Candidate {
  const boards = BUNDLED_BOARDS[difficulty];
  const board = boards[hashSeed(seed) % boards.length]!;
  const preset = PRESETS[difficulty];
  const clues = decodeClues(board.clues, preset.width, preset.height);
  if (clues === null) throw new Error(`loop-puzzle: bundled ${difficulty} board does not decode`);
  const layout: Layout = { ...preset, clues };
  const solution = uniqueSolution(layout);
  if (solution === null) throw new Error(`loop-puzzle: bundled ${difficulty} board is not unique`);
  const graded = gradeOf(layout, 3);
  if (graded === null) throw new Error(`loop-puzzle: bundled ${difficulty} board is unsolved`);
  return { layout, solution, grade: graded.grade, trials: graded.trials };
}

/**
 * The same seed always returns the same puzzle (§8): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, and the budget counts only
 * this call's own work, so the puzzle that ships is a pure function of the
 * seed and the difficulty alone.
 */
export function generatePuzzle(seed: string, difficulty: Difficulty): GeneratedPuzzle {
  return generateForTier(seed, PRESETS[difficulty], TIERS[difficulty], difficulty);
}

/**
 * `generatePuzzle` with the tier and the budget spelled out — the tests drive
 * the fallback through it, and the measurements of §8 run it unbudgeted.
 */
export function generateForTier(
  seed: string,
  preset: Preset,
  tier: TierSpec,
  difficulty: Difficulty,
  workLimit: number = GENERATION_WORK_LIMIT,
): GeneratedPuzzle {
  const before = solverWork.read();
  const end = before + workLimit;
  const ship = (candidate: Candidate, attempts: number, fallback: boolean): GeneratedPuzzle => ({
    width: candidate.layout.width,
    height: candidate.layout.height,
    clues: candidate.layout.clues,
    solution: candidate.solution,
    grade: candidate.grade,
    trials: candidate.trials,
    attempts,
    work: solverWork.read() - before,
    fallback,
  });
  let attempt = 0;
  while (attempt < ATTEMPT_LIMIT && solverWork.read() < end) {
    attempt++;
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const candidate = buildCandidate(derived, preset, tier, {
      workLimit: end - solverWork.read(),
    });
    if (candidate !== null && meetsTier(candidate, tier)) return ship(candidate, attempt, false);
  }
  return ship(bundledPuzzle(seed, difficulty), attempt, true);
}
