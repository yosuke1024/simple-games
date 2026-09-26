/**
 * Board generation — implements docs/NUMBER_PATH_RULES.md §6.
 *
 * Three moves. First a Hamiltonian path over the empty grid: a serpentine,
 * then many seeded backbite moves, each of which keeps every cell covered
 * and only bends the road (so a full cover is never searched for, it is
 * carried). Then a generous set of clues laid on that road — numbers at
 * evenly spread places along it, 1 at its start and K at its end, and walls
 * on some of the edges it does not use — which the search solver checks for
 * uniqueness. Then the reduction: clues are taken away one at a time in a
 * seeded order, a removal kept only while the board still has exactly one
 * path, until the tier's floors are reached; a number taken away renumbers
 * the rest, so the clues that remain are still 1..K in order.
 *
 * A candidate that ends outside the tier — too many clues left, or a search
 * more or less forced than the tier asks (§6「ティア」) — costs one derived
 * seed and another try (`<seed>#2`, `#3`, …), the same shape Takuzu §6 uses.
 * The gate on all of this is work, never wall clock — see `solverWork`.
 */
import { buildBoard, colOf, rowOf } from './engine';
import { createRng, shuffled } from './rng';
import { countSolutions, solverWork, type SolveResult } from './solver';
import { inRange, TIERS, type Board, type Difficulty, type Path, type Tier } from './types';

/** Derived seeds tried before shipping the best candidate anyway (§6). */
export const ATTEMPT_LIMIT = 24;

/**
 * Backbite moves per cell of the grid. Each move is one seeded bend of the
 * road; this many mixes a serpentine into a path that keeps no trace of it,
 * at a cost that stays far below one solve.
 */
export const BACKBITE_PER_CELL = 16;

/**
 * How generous the first board is: how many more numbers than the tier's
 * ceiling it starts with, and what share of the edges the road does not use
 * start as walls. Generous enough that the first board is all but always
 * unique (a board that is not costs a road and a solve for nothing); small
 * enough that the reduction has few removals to try, since every one is a
 * solve. The 7×7 needs more of both — a longer road has more ways to be
 * rerouted between two waypoints.
 */
export interface Generosity {
  readonly extraNumbers: number;
  readonly wallShare: number;
}

export const GENEROSITY: Record<Difficulty, Generosity> = {
  easy: { extraNumbers: 6, wallShare: 0.6 },
  medium: { extraNumbers: 6, wallShare: 0.6 },
  hard: { extraNumbers: 8, wallShare: 0.7 },
};

export interface GeneratedPuzzle {
  readonly board: Board;
  readonly solution: Path;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Solver nodes plus backbite moves spent to build this puzzle: the budgeted work of §6. */
  readonly work: number;
  /** Branch points of the final uniqueness search — the tier's second axis. */
  readonly branches: number;
  /** True when the cap was hit and the nearest candidate shipped anyway (§6). */
  readonly fallback: boolean;
}

/**
 * A Hamiltonian path over a width×height grid with no walls, as a list of
 * cells. Starts from the serpentine and applies `BACKBITE_PER_CELL` per cell
 * backbite moves: pick an end, pick one of its grid neighbours that is on the
 * path but not next to it, and reverse the stretch between — the path stays
 * a full cover throughout, and only its shape changes.
 */
export function buildHamiltonianPath(seed: string, width: number, height: number): number[] {
  const count = width * height;
  const path: number[] = [];
  for (let row = 0; row < height; row++) {
    for (let step = 0; step < width; step++) {
      const col = row % 2 === 0 ? step : width - 1 - step;
      path.push(row * width + col);
    }
  }
  const position = new Array<number>(count).fill(0);
  path.forEach((cell, at) => {
    position[cell] = at;
  });

  const rng = createRng(seed);
  const gridNeighbours = (cell: number): number[] => {
    const out: number[] = [];
    const row = rowOf(cell, width);
    const col = colOf(cell, width);
    if (row > 0) out.push(cell - width);
    if (col < width - 1) out.push(cell + 1);
    if (row < height - 1) out.push(cell + width);
    if (col > 0) out.push(cell - 1);
    return out;
  };
  const reverse = (from: number, to: number): void => {
    for (let a = from, b = to; a < b; a++, b--) {
      const cell = path[a]!;
      path[a] = path[b]!;
      path[b] = cell;
      position[path[a]!] = a;
      position[path[b]!] = b;
    }
  };

  const moves = BACKBITE_PER_CELL * count;
  for (let move = 0; move < moves; move++) {
    const tail = rng() < 0.5;
    const end = tail ? path[count - 1]! : path[0]!;
    const options = gridNeighbours(end);
    const pick = options[Math.floor(rng() * options.length)]!;
    const at = position[pick]!;
    if (tail) {
      if (at >= count - 2) continue;
      reverse(at + 1, count - 1);
    } else {
      if (at <= 1) continue;
      reverse(0, at - 1);
    }
  }
  return path;
}

/**
 * Where along the path the numbers of a generous board sit: 1 at the start,
 * K at the end, and the rest spread evenly with a seeded wobble, so a board
 * reads as waypoints rather than as a cluster.
 */
function spreadNumbers(count: number, total: number, rng: () => number): number[] {
  const places = [0];
  const stride = (count - 1) / (total - 1);
  for (let i = 1; i < total - 1; i++) {
    const wobble = (rng() - 0.5) * stride * 0.6;
    const place = Math.round(i * stride + wobble);
    places.push(Math.min(count - 2, Math.max(places[places.length - 1]! + 1, place)));
  }
  places.push(count - 1);
  // A wobble can push two places together; keep the first of each.
  return places.filter((place, i) => i === 0 || place > places[i - 1]!);
}

/** The edge ids between grid neighbours that the path does not step across. */
function unusedEdges(path: readonly number[], width: number, height: number): string[] {
  const position = new Array<number>(width * height).fill(0);
  path.forEach((cell, at) => {
    position[cell] = at;
  });
  const used = (a: number, b: number) => Math.abs(position[a]! - position[b]!) === 1;
  const out: string[] = [];
  for (let cell = 0; cell < width * height; cell++) {
    if (colOf(cell, width) < width - 1 && !used(cell, cell + 1)) out.push(`v${cell}`);
    if (rowOf(cell, width) < height - 1 && !used(cell, cell + width)) out.push(`h${cell}`);
  }
  return out;
}

export interface Candidate {
  readonly board: Board;
  readonly result: SolveResult;
  readonly numbers: number;
  readonly walls: number;
}

/** A board from the path's numbered places and a wall list; never null for these inputs. */
function boardFrom(
  path: readonly number[],
  places: readonly number[],
  walls: readonly string[],
  width: number,
  height: number,
): Board {
  const board = buildBoard({
    width,
    height,
    numbers: places.map((place, i) => [path[place]!, i + 1] as const),
    walls,
  });
  if (board === null) throw new Error('number-path: generator built an illegal board');
  return board;
}

/**
 * One attempt from one seed: the road, the generous clues, and the
 * reduction. Null when the generous board itself is not unique — rare, and
 * one derived seed away from a board that is.
 *
 * Numbers go first, down to a target drawn from the tier's range for this
 * seed, and only then the walls, down to the tier's floor. Numbers are the
 * tier's first axis (§6「ティア」), so they are taken while the walls still
 * hold the road in place; the walls that then survive are the ones that
 * road needs with that few numbers, and no more.
 */
export function attemptCandidate(
  seed: string,
  tier: Tier,
  generosity: Generosity,
): Candidate | null {
  const { width, height } = tier;
  const count = width * height;
  const path = buildHamiltonianPath(seed, width, height);
  const rng = createRng(`${seed}-clues`);

  let places: readonly number[] = spreadNumbers(
    count,
    Math.min(count, tier.numbers.max + generosity.extraNumbers),
    rng,
  );
  const edges = shuffled(unusedEdges(path, width, height), rng);
  let walls: readonly string[] = edges.slice(0, Math.round(edges.length * generosity.wallShare));
  const targetNumbers =
    tier.numbers.min + Math.floor(rng() * (tier.numbers.max - tier.numbers.min + 1));

  let board = boardFrom(path, places, walls, width, height);
  let result = countSolutions(board);
  if (result.solutions !== 1) return null;

  const keep = (nextPlaces: readonly number[], nextWalls: readonly string[]): boolean => {
    const trial = boardFrom(path, nextPlaces, nextWalls, width, height);
    const outcome = countSolutions(trial);
    if (outcome.solutions !== 1) return false;
    places = nextPlaces;
    walls = nextWalls;
    board = trial;
    result = outcome;
    return true;
  };

  // Inner numbers, in a seeded order, while the target is still above.
  for (const place of shuffled(places.slice(1, -1), rng)) {
    if (places.length <= targetNumbers) break;
    keep(
      places.filter((kept) => kept !== place),
      walls,
    );
  }
  // Then the walls, while the floor is still below.
  for (const id of shuffled(walls, rng)) {
    if (walls.length <= tier.walls.min) break;
    keep(
      places,
      walls.filter((kept) => kept !== id),
    );
  }

  return { board, result, numbers: places.length, walls: walls.length };
}

/** Whether a candidate is what its tier promises (§6「ティア」). */
export function meetsTier(candidate: Candidate, tier: Tier): boolean {
  return (
    inRange(candidate.numbers, tier.numbers) &&
    inRange(candidate.walls, tier.walls) &&
    inRange(candidate.result.branches, tier.branches)
  );
}

/** How far a candidate misses its tier, for choosing the fallback. */
function tierDistance(candidate: Candidate, tier: Tier): number {
  const miss = (value: number, range: { min: number; max: number }) =>
    value < range.min ? range.min - value : value > range.max ? value - range.max : 0;
  return (
    miss(candidate.numbers, tier.numbers) * 4 +
    miss(candidate.walls, tier.walls) * 2 +
    miss(candidate.result.branches, tier.branches)
  );
}

/**
 * The same seed always returns the same puzzle (§6): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the puzzle that ships is a
 * pure function of the seed and the difficulty alone.
 *
 * The tier is a target, not a promise about this board. When a candidate
 * lands outside it the seed is derived and a fresh road tried; when the cap
 * is reached the nearest candidate ships. That puzzle is still unique and
 * still has one road to draw — it is only easier or harder than its tier
 * asked for, which is the one failure worth shipping. Tests watch the rate
 * (it is zero across every walked seed and daily today).
 */
export function generatePuzzle(seed: string, difficulty: Difficulty): GeneratedPuzzle {
  const tier = TIERS[difficulty];
  const before = solverWork.read();
  const backbites = BACKBITE_PER_CELL * tier.width * tier.height;

  let best: { candidate: Candidate; distance: number } | null = null;
  for (let attempts = 1; attempts <= ATTEMPT_LIMIT; attempts++) {
    const derived = attempts === 1 ? seed : `${seed}#${attempts}`;
    const candidate = attemptCandidate(derived, tier, GENEROSITY[difficulty]);
    if (candidate === null) continue;
    if (meetsTier(candidate, tier)) {
      return {
        board: candidate.board,
        solution: candidate.result.solution!,
        attempts,
        work: solverWork.read() - before + backbites * attempts,
        branches: candidate.result.branches,
        fallback: false,
      };
    }
    const distance = tierDistance(candidate, tier);
    if (best === null || distance < best.distance) best = { candidate, distance };
  }

  // Two failures live here and only one of them may ship. A unique board
  // outside its tier is a real puzzle that is merely off its difficulty, so
  // it goes out with `fallback` set (§6). No unique board at all across every
  // derived seed cannot happen for a legal tier — the generous board is a
  // solved road with numbers every few cells — and would mean this file is
  // broken; handing the player a blank grid for it would only hide that.
  if (best === null) {
    throw new Error(
      `number-path: no unique ${difficulty} board after ${ATTEMPT_LIMIT} seeds from "${seed}"`,
    );
  }
  return {
    board: best.candidate.board,
    solution: best.candidate.result.solution!,
    attempts: ATTEMPT_LIMIT,
    work: solverWork.read() - before + backbites * ATTEMPT_LIMIT,
    branches: best.candidate.result.branches,
    fallback: true,
  };
}
