/**
 * Board generation — implements docs/CROWN_GRID_RULES.md §8.
 *
 * Four steps per attempt. The crowns first: one per row, columns drawn in a
 * seed-shuffled order, backtracking so that no column repeats and crowns in
 * neighbouring rows sit at least two columns apart (§3). Then the regions,
 * grown from the crowns as seeds by weighted multi-source growth — each
 * region has an appetite drawn from the seed, and one unassigned neighbour of
 * a region is claimed per step until the board is covered, so every region is
 * connected by construction and the appetites give the sizes their spread.
 * Then the counting solver says whether the board has exactly one answer, and
 * only then does the technique solver grade it (§7).
 *
 * A candidate that is not unique, or not of the tier asked for, costs one
 * derived seed and another try (`<seed>#2`, `#3`, …), the same shape Takuzu
 * §6 uses. The gate on all of this is work, never wall clock — `solverWork`.
 */
import { indexOf, rowOf, colOf } from './engine';
import { createRng, shuffled } from './rng';
import { enumerateSolutions, grade, solverWork } from './solver';
import { SIZE_FOR, cellCount, type Difficulty, type Size } from './types';

/** Derived seeds tried before shipping the best candidate anyway (§8). */
export const ATTEMPT_LIMIT = 400;

/**
 * Column placements the crown search may try before giving up on a seed. A
 * legal permutation is easy to find — the search rarely backtracks at all —
 * so this only exists to keep a pathological seed from spinning.
 */
export const CROWN_SEARCH_LIMIT = 5_000;

/** The four side-neighbours of a cell that are on the board. */
function sidesOf(index: number, size: Size): number[] {
  const row = rowOf(index, size);
  const col = colOf(index, size);
  const out: number[] = [];
  if (row > 0) out.push(index - size);
  if (row < size - 1) out.push(index + size);
  if (col > 0) out.push(index - 1);
  if (col < size - 1) out.push(index + 1);
  return out;
}

export interface GeneratedPuzzle {
  readonly size: Size;
  readonly difficulty: Difficulty;
  /** One region id per cell, row-major (§1). */
  readonly regions: readonly number[];
  /** The crown's column in each row (§8). */
  readonly solution: readonly number[];
  /** The tier the shipped board actually grades at (§7) — the target unless `fallback`. */
  readonly tier: Difficulty;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Solver steps spent building this puzzle: the budgeted work of §8. */
  readonly work: number;
  /** True when the cap was hit and an easier-than-asked board shipped (§8). */
  readonly fallback: boolean;
}

/**
 * One crown per row with no column twice and no two touching (§3), or null
 * when the search budget runs out. Rows top to bottom; each row's columns are
 * shuffled by the rng before they are tried, so the seed decides the layout.
 */
export function buildCrowns(rng: () => number, size: Size): number[] | null {
  const columns = Array.from({ length: size }, (_, col) => col);
  const usedCol = new Array<boolean>(size).fill(false);
  const solution: number[] = [];
  let searched = 0;

  const place = (row: number): boolean => {
    if (row === size) return true;
    for (const col of shuffled(columns, rng)) {
      if (++searched > CROWN_SEARCH_LIMIT) return false;
      if (usedCol[col]) continue;
      if (row > 0 && Math.abs(col - solution[row - 1]!) <= 1) continue;
      usedCol[col] = true;
      solution.push(col);
      if (place(row + 1)) return true;
      solution.pop();
      usedCol[col] = false;
    }
    return false;
  };

  return place(0) ? solution : null;
}

/** The two dials of region growth (§8), per tier. */
export interface GrowthShape {
  /** Exponent span of the appetite: 0 makes every region equally hungry. */
  readonly appetiteSpan: number;
  /** Upper bound of the per-region bias toward growing on from its last cell. */
  readonly snakeMax: number;
}

/**
 * The growth each tier asks for (§8). The tier is still decided by the
 * technique solver — these only move the odds. Uneven appetites and snaking
 * regions leave small, line-bound regions that Easy's two techniques read
 * straight off; even appetites and compact regions leave the fewest such
 * handholds, which is where a board that needs a hypothesis tends to come from.
 */
export const SHAPE_FOR: Record<Difficulty, GrowthShape> = {
  easy: { appetiteSpan: 4, snakeMax: 1 },
  medium: { appetiteSpan: 3, snakeMax: 1 },
  hard: { appetiteSpan: 0, snakeMax: 0 },
};

export const DEFAULT_SHAPE: GrowthShape = SHAPE_FOR.medium;

/**
 * Cuts the board into N connected regions, one around each crown (§8).
 *
 * Every step picks a region in proportion to its appetite and hands it one
 * unassigned cell touching it. Two dials, both from the seed: the appetite
 * (how big a region tends to end up) and a bias toward growing on from the
 * cell just added (how snake-like it tends to be). The mix is what gives a
 * seed's boards their variety of shapes, and the shapes are where the
 * difficulty of a Crown Grid lives.
 */
export function growRegions(
  rng: () => number,
  solution: readonly number[],
  size: Size,
  shape: GrowthShape = DEFAULT_SHAPE,
): number[] {
  const total = cellCount(size);
  const regions = new Array<number>(total).fill(-1);
  /** Per region: the unassigned cells touching it, kept current as cells are taken. */
  const frontier: Set<number>[] = [];
  const appetite: number[] = [];
  const snake: number[] = [];
  const last: number[] = [];

  const claim = (region: number, index: number): void => {
    regions[index] = region;
    last[region] = index;
    for (const set of frontier) set.delete(index);
    for (const side of sidesOf(index, size)) {
      if (regions[side] === -1) frontier[region]!.add(side);
    }
  };

  solution.forEach((col, row) => {
    frontier.push(new Set());
    appetite.push(Math.pow(2, (rng() - 1 / 3) * shape.appetiteSpan));
    snake.push(rng() * shape.snakeMax);
    last.push(-1);
    claim(row, indexOf(row, col, size));
  });

  for (let assigned = size; assigned < total; assigned++) {
    let weight = 0;
    for (let region = 0; region < size; region++) {
      if (frontier[region]!.size > 0) weight += appetite[region]!;
    }
    let pick = rng() * weight;
    let chosen = -1;
    for (let region = 0; region < size; region++) {
      if (frontier[region]!.size === 0) continue;
      chosen = region;
      pick -= appetite[region]!;
      if (pick <= 0) break;
    }
    // Grow on from the cell just added when the snake bias says so and it
    // still has room; otherwise anywhere along the region's edge.
    const onward = sidesOf(last[chosen]!, size).filter((side) => regions[side] === -1);
    const options = onward.length > 0 && rng() < snake[chosen]! ? onward : [...frontier[chosen]!];
    claim(chosen, options[Math.floor(rng() * options.length)]!);
  }
  return regions;
}

/** Region moves tried on one board before it is given up as a candidate (§8). */
export const REPAIR_LIMIT = 24;

/** How many other answers one repair round looks at for a movable crown (§8). */
export const REPAIR_ALTERNATIVES = 8;

/** The cells of `region` reachable from `start` through its sides, avoiding `removed`. */
function componentOf(
  regions: readonly number[],
  size: Size,
  region: number,
  start: number,
  removed: number,
): Set<number> {
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length > 0) {
    const index = stack.pop()!;
    for (const side of sidesOf(index, size)) {
      if (side === removed || seen.has(side) || regions[side] !== region) continue;
      seen.add(side);
      stack.push(side);
    }
  }
  return seen;
}

/**
 * Makes a partition unique around its intended solution, or gives up (§8).
 *
 * A grown partition almost always admits other answers. Each one can be
 * killed without touching the intended answer: take another solution, pick a
 * row where its crown differs, and move that crown's cell out of its region
 * into a neighbouring one. The move leaves every region's intended crown where
 * it was, so the intended answer stays legal; it hands the neighbouring region
 * a second crown of the other answer, so that answer is gone. Where lifting
 * the cell would split its region, the pieces that do not hold the intended
 * crown go along with it — they hang off the moved cell, so both regions stay
 * connected. Of all the moves on offer, the one that displaces the fewest
 * cells is taken, which is what keeps regions from collapsing onto their own
 * crowns. Repeated until the counting solver finds nothing but the intended
 * answer, or the move limit is reached. The rng breaks ties and picks the
 * neighbour, so the repaired board is still a pure function of the seed.
 */
export function repairToUnique(
  rng: () => number,
  regions: number[],
  solution: readonly number[],
  size: Size,
): boolean {
  const differs = (columns: readonly number[]): boolean =>
    columns.some((col, row) => col !== solution[row]);

  /** The cells that leave `cell`'s region with it, or null when nothing borders it. */
  const displaced = (cell: number): { cells: number[]; into: number } | null => {
    const from = regions[cell]!;
    const destinations = [...new Set(sidesOf(cell, size).map((side) => regions[side]!))].filter(
      (region) => region !== from,
    );
    if (destinations.length === 0) return null;
    const crownRow = solution.findIndex((col, row) => regions[indexOf(row, col, size)] === from);
    const keep = componentOf(
      regions,
      size,
      from,
      indexOf(crownRow, solution[crownRow]!, size),
      cell,
    );
    const cells: number[] = [];
    for (let index = 0; index < regions.length; index++) {
      if (regions[index] === from && !keep.has(index)) cells.push(index);
    }
    return { cells, into: destinations[Math.floor(rng() * destinations.length)]! };
  };

  // One column order per row, drawn once: the alternatives each round sees
  // are then a spread across the board rather than the lexicographically
  // nearest few, which is what makes "the cell most of them use" mean much.
  const columns = Array.from({ length: size }, (_, col) => col);
  const order = solution.map(() => shuffled(columns, rng));

  /** Whether an answer still puts exactly one crown in every region as they now stand. */
  const stillLegal = (columns: readonly number[]): boolean => {
    const seen = new Array<boolean>(size).fill(false);
    for (let row = 0; row < size; row++) {
      const region = regions[indexOf(row, columns[row]!, size)]!;
      if (seen[region]) return false;
      seen[region] = true;
    }
    return true;
  };

  for (let repair = 0; repair < REPAIR_LIMIT; repair++) {
    const found = enumerateSolutions(regions, size, REPAIR_ALTERNATIVES + 1, order);
    const others = found.filter(differs);
    if (others.length === 0) {
      // Only the intended answer is left — or, if the search came back with
      // nothing, the intended answer itself is not legal, which no grown
      // board can produce; either way there is nothing to move.
      return found.length === 1;
    }
    // Every cell some answer in this batch crowns, and how many do: moving a
    // cell out of its region kills every answer that crowns it, so a move
    // through a hot cell takes several of them down at once.
    const heat = new Map<number, number>();
    for (const other of others) {
      other.forEach((col, row) => {
        if (col === solution[row]) return;
        const cell = indexOf(row, col, size);
        heat.set(cell, (heat.get(cell) ?? 0) + 1);
      });
    }
    // One move per answer still standing, all against the same enumeration:
    // a round that kills eight answers costs one search, not eight.
    let moved = false;
    for (const other of others) {
      if (!stillLegal(other)) continue;
      const cells = shuffled(
        other
          .map((col, row) => indexOf(row, col, size))
          .filter((_, row) => other[row] !== solution[row]),
        rng,
      ).sort((a, b) => heat.get(b)! - heat.get(a)!);
      let best: { cells: number[]; into: number } | null = null;
      for (const cell of cells) {
        const move = displaced(cell);
        if (move !== null && (best === null || move.cells.length < best.cells.length)) best = move;
        // One cell is the least a move can displace, and the cells come
        // hottest first, so the first such move is the one to take.
        if (best !== null && best.cells.length === 1) break;
      }
      if (best === null) continue;
      for (const index of best.cells) regions[index] = best.into;
      moved = true;
    }
    // Every crown the other answers differ in sits deep inside its region,
    // with no neighbouring region to move it to: this board is given up.
    if (!moved) return false;
  }
  return false;
}

const TIER_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * The same seed always returns the same puzzle (§8): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the puzzle that ships is a
 * pure function of the seed and the difficulty alone.
 *
 * The tier is a target, not a promise about this board. A candidate that is
 * not unique or grades at another tier is dropped for the next derived seed;
 * when the cap is reached, the best unique candidate the tier's own technique
 * set finishes ships instead. That board is still unique and still needs no
 * guessing — it is only easier than asked for, which is the one failure worth
 * shipping. Tests watch the rate (it is zero across every walked seed today).
 */
export function generatePuzzle(seed: string, difficulty: Difficulty): GeneratedPuzzle {
  const size = SIZE_FOR[difficulty];
  const before = solverWork.read();
  const want = TIER_RANK[difficulty];

  let best: { regions: number[]; solution: number[]; tier: Difficulty } | null = null;

  // Past the cap the loop only asks for something shippable at all: a
  // unique board the tier's techniques finish. It has never been needed on
  // a walked seed (guarantee.test.ts pins the cap itself as unreached), and
  // it is bounded, because a blank board with nothing to tap is the one
  // thing worse than a slow one.
  for (let attempt = 1; attempt <= ATTEMPT_LIMIT * 4; attempt++) {
    if (attempt > ATTEMPT_LIMIT && best !== null) break;
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const rng = createRng(derived);
    const solution = buildCrowns(rng, size);
    if (solution === null) continue;
    const regions = growRegions(rng, solution, size, SHAPE_FOR[difficulty]);
    // The repair's last enumeration is the count of §8: it returns true only
    // when the counting solver found the intended answer and nothing else.
    if (!repairToUnique(rng, regions, solution, size)) continue;

    const graded = grade(regions, size);
    if (graded.tier === null) continue;
    if (graded.tier === difficulty) {
      return {
        size,
        difficulty,
        regions,
        solution,
        tier: graded.tier,
        attempts: attempt,
        work: solverWork.read() - before,
        fallback: false,
      };
    }
    const rank = TIER_RANK[graded.tier];
    if (rank < want && (best === null || rank > TIER_RANK[best.tier])) {
      best = { regions, solution, tier: graded.tier };
    }
  }

  if (best === null) {
    throw new Error(
      `crown-grid: no ${difficulty} board after ${ATTEMPT_LIMIT * 4} seeds from "${seed}"`,
    );
  }
  return {
    size,
    difficulty,
    regions: best.regions,
    solution: best.solution,
    tier: best.tier,
    attempts: ATTEMPT_LIMIT,
    work: solverWork.read() - before,
    fallback: true,
  };
}
