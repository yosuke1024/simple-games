/**
 * Board generation — implements docs/UNBLOCK_PUZZLE_RULES.md §7–§8.
 *
 * Every board dealt has an exact fewest-moves count from a complete search,
 * made either offline or on the tap. The heavy search is offline: the
 * bundled catalogue (catalogue.ts) holds boards that this file's search
 * placed in their tier, built by catalogueBuild.ts with budgets far beyond a
 * tap and checked one by one by catalogue.test.ts. A tap only picks one by
 * the seed, and — for Easy and Medium — changes it once:
 *
 * - **Hard** deals a bundled board as it is. A Hard change almost never holds
 *   (about one in six, at the price of a whole component each), so a tap
 *   cannot afford one; variety comes from the size of the list instead.
 * - **Easy** and **Medium** start from a bundled board and change its solved
 *   arrangement: a block added, taken away or swapped, kept only if it gives
 *   the board blocks the deal has not had (so a component the deal has not
 *   been in) and the changed board's complete search holds a starting board
 *   in the tier. When no change holds within CHANGE_LIMIT tries and
 *   DEAL_WORK_LIMIT work, the bundled board itself is dealt (`fallback`).
 * - **The daily** is a bundled Medium board as it is, by its date (§9), so
 *   checking a saved daily is a lookup, not a search (§12).
 *
 * The gate on all of this is work, never wall clock — `searchWork` — and a
 * deal never spends more than DEAL_WORK_LIMIT plus a small, fixed slack.
 */
import { catalogueEntry, catalogueSize, type CatalogueEntry } from './catalogue';
import { dayDifference } from './daily';
import { isValidBoard, occupancy } from './engine';
import { createRng, hashSeed } from './rng';
import { exploreComponent, exploredStates, searchWork, solve, type Component } from './search';
import {
  BOARD_SIZE,
  EXIT_POSITION,
  TARGET_BLOCK,
  TARGET_INDEX,
  TARGET_ROW,
  blockCells,
  maxOffset,
  type Block,
  type BlockLength,
  type Board,
  type Difficulty,
} from './types';

/**
 * Boards one component may hold before it is given up on (§8). The bases
 * were built under the same limit, so every component the generator deals
 * from — and every search the Hint runs inside one — fits in it.
 */
export const COMPONENT_LIMIT = 6_000;

/** Changed boards searched per deal before the base is dealt as it is (§8). */
export const CHANGE_LIMIT = 24;

/**
 * Work one Easy or Medium deal may spend (§8), counted by `searchWork`. A
 * deal never starts a change, a listing or a search-size walk it cannot pay
 * for, so no deal spends more than this plus a small, fixed slack — on any
 * device, for any seed. Sized so that a tap on a slow phone does not freeze
 * the page (§8「予算」); Hard and the daily spend none.
 */
export const DEAL_WORK_LIMIT = 200_000;

/** Changes kept before the board is dealt (§8). */
export const CHANGES_KEPT = 1;

/** Starting boards tried per component for the search-size bounds (§7). */
export const CANDIDATE_TRIES = 4;

/** Random placements tried per block when one is added (§8). */
export const PLACEMENT_TRIES = 40;

/** Share of three-cell blocks among the blocks placed (§8). */
export const LONG_BLOCK_RATE = 0.3;

export interface TierSpec {
  /** The fewest moves the tier deals, inclusive (§7). */
  readonly minMoves: number;
  /** The most, inclusive; Hard has no ceiling. */
  readonly maxMoves: number;
  /**
   * Bounds on the boards a breadth-first search must expand to prove the
   * minimum (`exploredStates`, §7) — the tier's search size.
   */
  readonly minExplored: number;
  readonly maxExplored: number;
  /** Blocks besides the target, inclusive bounds (§7). */
  readonly minBlocks: number;
  readonly maxBlocks: number;
  /** Hard deals a board furthest from the exit; Easy and Medium a distance in the band. */
  readonly farthest: boolean;
  /** The greatest distance a base's component must reach before `buildBase` stops (§8). */
  readonly baseDistance: number;
  /**
   * Whether a deal changes its bundled board (Easy, Medium) or deals it as
   * it is (Hard) — §8.
   */
  readonly changes: boolean;
  /**
   * Boards a changed board's component may hold before the change is given
   * up on (§8). Below COMPONENT_LIMIT for Easy, whose changes often open the
   * board up into a component too large to be an Easy one anyway, so a deal
   * stops listing it sooner.
   */
  readonly changeComponentLimit: number;
}

/** The tier table of §7, verbatim. */
export const TIERS: Record<Difficulty, TierSpec> = {
  easy: {
    minMoves: 4,
    maxMoves: 9,
    minExplored: 0,
    maxExplored: 1_000,
    minBlocks: 8,
    maxBlocks: 11,
    farthest: false,
    baseDistance: 10,
    changes: true,
    changeComponentLimit: 3_000,
  },
  medium: {
    minMoves: 10,
    maxMoves: 16,
    minExplored: 250,
    maxExplored: Number.POSITIVE_INFINITY,
    minBlocks: 10,
    maxBlocks: 13,
    farthest: false,
    baseDistance: 17,
    changes: true,
    changeComponentLimit: COMPONENT_LIMIT,
  },
  hard: {
    minMoves: 20,
    maxMoves: Number.POSITIVE_INFINITY,
    minExplored: 800,
    maxExplored: Number.POSITIVE_INFINITY,
    minBlocks: 10,
    maxBlocks: 14,
    farthest: true,
    baseDistance: 22,
    changes: false,
    changeComponentLimit: COMPONENT_LIMIT,
  },
};

/** Whether a fewest-moves count and its search size fall in a tier (§7). */
export function meetsTier(spec: TierSpec, minMoves: number, explored: number): boolean {
  return (
    minMoves >= spec.minMoves &&
    minMoves <= spec.maxMoves &&
    explored >= spec.minExplored &&
    explored <= spec.maxExplored
  );
}

/** Whether a board's block count is inside a tier's bounds (§7). */
export const meetsBlockBounds = (spec: TierSpec, board: Board): boolean =>
  board.blocks.length - 1 >= spec.minBlocks && board.blocks.length - 1 <= spec.maxBlocks;

export interface GeneratedPuzzle {
  /** The starting board, blocks in canonical order (§8). */
  readonly board: Board;
  /**
   * The fewest moves to the exit — exact: from the complete search of a
   * changed board's component on the tap, or, for a bundled board, from the
   * complete search catalogue.test.ts repeats for every entry (§8).
   */
  readonly minMoves: number;
  /** The bundled board the deal started from: its place in its tier's list. */
  readonly base: number;
  /** Changed boards searched (none for Hard and the daily). */
  readonly attempts: number;
  /** Changes kept on the way to this board; 0 means the bundled board as it is (§8). */
  readonly changes: number;
  /** Boards expanded plus moves generated plus edges walked to deal this (§8). */
  readonly work: number;
  /**
   * True when the tier changes its bundled board (Easy, Medium) but no change
   * held, and the bundled board was dealt as it is (§8). Never for Hard or
   * the daily, which deal a bundled board by design.
   */
  readonly fallback: boolean;
}

// ---------- arrangements and changes ----------

/**
 * Renumbers a board's blocks into canonical order (§8): the target first,
 * then every other block by its first cell in reading order. The same board
 * always has the same block letters, whatever order it was built in.
 */
export function canonicalBoard(board: Board): Board {
  const others = board.blocks
    .map((block, index) => ({
      block,
      position: board.positions[index]!,
      first: blockCells(block, board.positions[index]!)[0]!,
    }))
    .filter((_, index) => index !== TARGET_INDEX)
    .sort((a, b) => a.first - b.first);
  return {
    blocks: [board.blocks[TARGET_INDEX]!, ...others.map((entry) => entry.block)],
    positions: [board.positions[TARGET_INDEX]!, ...others.map((entry) => entry.position)],
  };
}

/**
 * Drops one random block onto a free spot, or returns null after
 * PLACEMENT_TRIES misses. `except` is a shape and lane the drop may not use:
 * the block a swap just took away. Put back in its own lane at any offset,
 * the same block leaves the board's blocks as they were — the same
 * component, often the very board slid along — so that is no change (§8).
 */
export function addRandomBlock(board: Board, rng: () => number, except?: Block): Board | null {
  const cells = occupancy(board);
  if (cells === null) return null;
  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++) {
    const orientation = rng() < 0.5 ? 'h' : 'v';
    const length: BlockLength = rng() < LONG_BLOCK_RATE ? 3 : 2;
    const lane = Math.floor(rng() * BOARD_SIZE);
    const position = Math.floor(rng() * (maxOffset(length) + 1));
    // No other horizontal block in the target's row (§1).
    if (orientation === 'h' && lane === TARGET_ROW) continue;
    if (
      except !== undefined &&
      except.orientation === orientation &&
      except.length === length &&
      except.lane === lane
    ) {
      continue;
    }
    const block: Block = { orientation, length, lane };
    if (blockCells(block, position).some((cell) => cells[cell] !== -1)) continue;
    return { blocks: [...board.blocks, block], positions: [...board.positions, position] };
  }
  return null;
}

/** A random solved arrangement: the target at the exit, then blocks (§8, `buildBase`). */
export function randomArrangement(rng: () => number, spec: TierSpec): Board {
  const count = spec.minBlocks + Math.floor(rng() * (spec.maxBlocks - spec.minBlocks + 1));
  let board: Board = { blocks: [TARGET_BLOCK], positions: [EXIT_POSITION] };
  for (let n = 0; n < count; n++) board = addRandomBlock(board, rng) ?? board;
  return board;
}

/** The board without one of its non-target blocks. */
function withoutBlock(board: Board, index: number): Board {
  return {
    blocks: board.blocks.filter((_, i) => i !== index),
    positions: board.positions.filter((_, i) => i !== index),
  };
}

/**
 * One change to a board (§8): add a block, take one away, or swap one for a
 * random other, weighted 25 / 15 / 60 among the changes the tier's block
 * bounds allow. Every change alters the board's blocks — the shapes and lanes
 * `componentKey` lists — so the changed board is never in the component it
 * came from: a swap never puts back a block of the shape and lane it took
 * (slid along its own lane, that is the same set of boards). Null when no
 * free spot for a new block was found.
 */
export function changeBoard(board: Board, rng: () => number, spec: TierSpec): Board | null {
  const others = board.blocks.length - 1;
  const add = others < spec.maxBlocks ? 0.25 : 0;
  const remove = others > spec.minBlocks ? 0.15 : 0;
  const swap = others > 0 ? 0.6 : 0;
  const roll = rng() * (add + remove + swap);
  const pick = (): number => 1 + Math.floor(rng() * others);
  if (roll < add) return addRandomBlock(board, rng);
  if (roll < add + remove) return withoutBlock(board, pick());
  const taken = pick();
  return addRandomBlock(withoutBlock(board, taken), rng, board.blocks[taken]!);
}

/**
 * One of a component's solved boards, chosen by the rng — what the next
 * change is made to (§8). A change to a solved board leaves it solved (a new
 * block lands only on free cells), so the changed board's component always
 * holds a way out and no search is spent on a board that has none.
 */
export function solvedBoard(component: Component, rng: () => number): Board {
  searchWork.add(component.size);
  const solved: number[] = [];
  for (let index = 0; index < component.size; index++) {
    if (component.goalDistance[index] === 0) solved.push(index);
  }
  const index = solved[Math.floor(rng() * solved.length)]!;
  return { blocks: component.blocks, positions: component.positionsAt(index) };
}

// ---------- choosing the starting board ----------

export interface Chosen {
  readonly board: Board;
  readonly minMoves: number;
  readonly exploredStates: number;
  readonly componentSize: number;
}

/**
 * A starting board from a complete component (§7, §8), or null when none
 * qualifies. Hard takes one of the boards furthest from the exit. Easy and
 * Medium first draw a distance evenly over their whole band, then a board at
 * that distance — drawing boards evenly would deal the low end of the band
 * almost every time, since a component holds more boards near the exit than
 * far from it. A component whose farthest board is short of the drawn
 * distance offers its farthest distance in the band instead.
 *
 * Up to CANDIDATE_TRIES boards are tried against the tier's search-size
 * bounds. A board whose search is too wide sends the next try one move
 * nearer the exit, one whose search is too narrow one move farther — the
 * search size grows with the distance — while that distance is in the band
 * and the component holds boards at it; otherwise the next try is another
 * board at the same distance. Null as well when a search-size walk would
 * spend more than `workLimit` (§8).
 */
export function chooseStart(
  component: Component,
  rng: () => number,
  spec: TierSpec,
  workLimit: number = Number.POSITIVE_INFINITY,
): Chosen | null {
  if (component.maxDistance < spec.minMoves) return null;
  const before = searchWork.read();
  const top = Math.min(spec.maxMoves, component.maxDistance);
  const atDistance = new Map<number, number[]>();
  searchWork.add(component.size);
  for (let index = 0; index < component.size; index++) {
    const d = component.goalDistance[index]!;
    if (d < spec.minMoves || d > top) continue;
    const list = atDistance.get(d);
    if (list === undefined) atDistance.set(d, [index]);
    else list.push(index);
  }
  const span = Number.isFinite(spec.maxMoves) ? spec.maxMoves - spec.minMoves + 1 : 1;
  let distance = spec.farthest
    ? component.maxDistance
    : Math.min(top, spec.minMoves + Math.floor(rng() * span));
  const holds = (d: number): boolean => (atDistance.get(d)?.length ?? 0) > 0;
  for (let attempt = 0; attempt < CANDIDATE_TRIES && holds(distance); attempt++) {
    const candidates = atDistance.get(distance)!;
    const at = Math.floor(rng() * candidates.length);
    const index = candidates[at]!;
    candidates.splice(at, 1);
    const explored = exploredStates(
      component,
      index,
      distance,
      spec.maxExplored,
      workLimit - (searchWork.read() - before),
    );
    if (explored === null) return null;
    if (meetsTier(spec, distance, explored)) {
      return {
        board: canonicalBoard({
          blocks: component.blocks,
          positions: component.positionsAt(index),
        }),
        minMoves: distance,
        exploredStates: explored,
        componentSize: component.size,
      };
    }
    if (explored > spec.maxExplored && holds(distance - 1)) distance--;
    else if (explored < spec.minExplored && holds(distance + 1)) distance++;
  }
  return null;
}

// ---------- dealing a board ----------

/**
 * One change tried on a solved board (§8, steps 3–5): the changed board's
 * component listed in full and a starting board chosen from it, or null when
 * the change does not hold — no free spot, blocks the deal has had before
 * (`had`, by `componentKey`), a component past `componentLimit` or past the
 * work left, or nothing in the tier. The deal, the catalogue's probe and
 * its Hard children (catalogueBuild.ts) judge a change by this one function.
 */
export function tryChange(
  solved: Board,
  rng: () => number,
  spec: TierSpec,
  had: ReadonlySet<string>,
  componentLimit: number,
  workLimit: number,
): { chosen: Chosen; component: Component; key: string } | null {
  const before = searchWork.read();
  const next = changeBoard(solved, rng, spec);
  if (next === null || !isValidBoard(next)) return null;
  const key = componentKey(next);
  if (had.has(key)) return null;
  const result = exploreComponent(next, componentLimit, workLimit);
  if (result.status !== 'complete') return null;
  const spent = searchWork.read() - before;
  const chosen = chooseStart(result.component, rng, spec, workLimit - spent);
  return chosen === null ? null : { chosen, component: result.component, key };
}

/** The board a solution ends on: `start` with every slide played. */
export function playedOut(start: Board, solution: readonly { block: number; to: number }[]): Board {
  const positions = [...start.positions];
  for (const move of solution) positions[move.block] = move.to;
  return { blocks: start.blocks, positions };
}

/** The bundled board a Free Play seed starts from, picked by its hash (§8). */
export function baseFor(seed: string, difficulty: Difficulty): CatalogueEntry {
  return catalogueEntry(difficulty, hashSeed(`${seed}#base`) % catalogueSize(difficulty));
}

/**
 * The daily's step through the Medium list (§9): day `d`, counted from
 * 1970-01-01, deals entry `(d × DAILY_STRIDE) mod n`. The stride shares no
 * factor with the list's length n (catalogue.test.ts), so any n consecutive
 * days deal n different boards — about six years at 2,200.
 */
export const DAILY_STRIDE = 7_919;

/** The day a local YYYY-MM-DD date is, counted from 1970-01-01. */
const dayNumber = (dateString: string): number => dayDifference('1970-01-01', dateString);

/** The daily's bundled Medium board for a local YYYY-MM-DD date (§9). */
export function dailyEntry(dateString: string): CatalogueEntry {
  const size = catalogueSize('medium');
  const index = (((dayNumber(dateString) * DAILY_STRIDE) % size) + size) % size;
  return catalogueEntry('medium', index);
}

/** The limits one Easy or Medium deal runs under (§8). Tests shrink them to reach the fallback. */
export interface DealLimits {
  readonly changeLimit: number;
  readonly changesKept: number;
  /** Boards a changed board's component may hold; the tier's `changeComponentLimit` by default. */
  readonly componentLimit?: number;
  readonly workLimit: number;
}

export const DEAL_LIMITS: DealLimits = {
  changeLimit: CHANGE_LIMIT,
  changesKept: CHANGES_KEPT,
  workLimit: DEAL_WORK_LIMIT,
};

/** A bundled board dealt as it is. */
const asBundled = (entry: CatalogueEntry, fallback: boolean): GeneratedPuzzle => ({
  board: entry.board,
  minMoves: entry.minMoves,
  base: entry.index,
  attempts: 0,
  changes: 0,
  work: 0,
  fallback,
});

/**
 * One Easy or Medium deal from one bundled board (§8): up to `changeLimit`
 * changed boards, each searched in full, keeping a change whenever its
 * component holds a starting board in the tier, until `changesKept` changes
 * are kept or `workLimit` is spent. The bundled board itself when none is
 * kept.
 *
 * A change is kept only into blocks the deal has not had yet: a changed
 * board with the same shapes in the same lanes (`componentKey`) as the base
 * or as an earlier kept change could be in that component again — undoing an
 * earlier change does exactly that — and a board from the base's own
 * component is the base's puzzle, not a new one. Every board of a component
 * has the same blocks, so a kept change is never in the base's component,
 * and `fallback` is exactly "the board dealt is from the base's component".
 */
export function dealFromBase(
  base: CatalogueEntry,
  seed: string,
  difficulty: Difficulty,
  limits: DealLimits = DEAL_LIMITS,
): GeneratedPuzzle {
  const spec = TIERS[difficulty];
  const componentLimit = limits.componentLimit ?? spec.changeComponentLimit;
  const before = searchWork.read();
  const rng = createRng(seed);
  const start = base.board;
  let current: Pick<Chosen, 'board' | 'minMoves'> = { board: start, minMoves: base.minMoves };
  const left = (): number => limits.workLimit - (searchWork.read() - before);
  // The base's own way out, found by the same forward search the Hint uses;
  // its last board is the solved arrangement the first change is made to.
  // Its component fits in COMPONENT_LIMIT boards (catalogue.test.ts), and the
  // search stops, like everything else here, at the work left (§8).
  let solved: Board | null = null;
  if (limits.changesKept > 0 && limits.changeLimit > 0 && left() > 0) {
    const way = solve(start, COMPONENT_LIMIT, undefined, left());
    solved = way.status === 'solved' ? playedOut(start, way.solution) : null;
  }
  const had = new Set([componentKey(start)]);
  let changes = 0;
  let attempts = 0;
  while (
    solved !== null &&
    attempts < limits.changeLimit &&
    changes < limits.changesKept &&
    left() > 0
  ) {
    attempts++;
    const kept = tryChange(solved, rng, spec, had, componentLimit, left());
    if (kept === null) continue;
    current = kept.chosen;
    had.add(kept.key);
    changes++;
    if (changes < limits.changesKept) solved = solvedBoard(kept.component, rng);
  }
  return {
    board: current.board,
    minMoves: current.minMoves,
    base: base.index,
    attempts,
    changes,
    work: searchWork.read() - before,
    fallback: changes === 0,
  };
}

/**
 * A Free Play board (§8, §9). The same seed always returns the same board:
 * the bundled board is picked by the seed's hash and every change is drawn
 * from the seed's rng, and the work limit is counted in work, which the seed
 * alone decides.
 *
 * Hard deals the bundled board as it is. Easy and Medium change it once;
 * when no change holds within CHANGE_LIMIT tries and DEAL_WORK_LIMIT work,
 * the bundled board ships as it is with `fallback` set. It is still exact and
 * still in its tier — catalogue.test.ts checks every bundled board — so what
 * is lost is only that the board is new. guarantee.test.ts watches the rate.
 */
export function generatePuzzle(seed: string, difficulty: Difficulty): GeneratedPuzzle {
  const base = baseFor(seed, difficulty);
  if (!TIERS[difficulty].changes) return asBundled(base, false);
  return dealFromBase(base, seed, difficulty);
}

/** The daily's board for a local YYYY-MM-DD date: a bundled Medium board as it is (§9). */
export function dailyPuzzle(dateString: string): GeneratedPuzzle {
  return asBundled(dailyEntry(dateString), false);
}

/** The blocks of a board as a sorted list of shapes and lanes — the same for every board of a component. */
export function componentKey(board: Board): string {
  return board.blocks
    .map((block) => `${block.orientation}${block.length}${block.lane}`)
    .sort()
    .join(',');
}
