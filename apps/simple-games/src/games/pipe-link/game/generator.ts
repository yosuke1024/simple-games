/**
 * Board generation — implements docs/PIPE_LINK_RULES.md §4 and the tiers of §5.
 *
 * One candidate per derived seed (`<seed>`, `<seed>#2`, `#3`, …):
 *
 * 1. Grow a spanning tree from the source — a cell picked by seed from the
 *    central cells — adding, uniformly at random, one edge from a tree cell
 *    of degree below 3 to a neighbour outside the tree, until every cell is
 *    in. Each cell's degree is then 1–3 and its pipe set is its tile: the
 *    tree is the answer the board is built from.
 * 2. Grade it with the technique solver from the types-only board.
 * 3. Prove it unique with the bounded counter (twice proven, as in Bridges).
 * 4. Keep it only if it lands in its tier (§5).
 * 5. Scramble: every tile takes an orientation drawn uniformly from its
 *    type's orientations; a scramble that is already solved, or leaves more
 *    than 60 % of the tiles in their answer orientation, is drawn again.
 *
 * After `ATTEMPT_LIMIT` misses — or once the board has spent
 * `GENERATION_WORK_LIMIT` — a bundled board ships instead (§4 step 6). The
 * gate on all of this is work, never wall clock, so the same seed always
 * gives the same board on every machine.
 */
import { createBoard, isSolved, type Board } from './board';
import { BUNDLED_BOARDS, decodeBundled } from './bundled';
import { createRng, hashSeed } from './rng';
import { SEARCH_NODE_LIMIT, TECHNIQUE_WORK_LIMIT, countSolutions, solve } from './solver';
import { periodOf, tileOfMask, type TileType } from './tiles';
import { PRESETS, type Difficulty, type Preset } from './types';

/**
 * Derived seeds tried before the bundled fallback (§4). The rarest tier
 * (Hard) lands on about one candidate in nine (11.7 % in the walk — §14);
 * by arithmetic, 160 misses in a row then come about twice in 10⁹ boards.
 */
export const ATTEMPT_LIMIT = 160;

/**
 * Work one board may spend over all its attempts — growth, scrambles, the
 * technique solver and the counter (§4「仕事量の単位」). Several times the
 * heaviest board the tests walk (223,439 — a Hard board of 49 attempts,
 * §14), so in practice a hit or the attempt limit decides first; what it adds is a ceiling on the worst case that
 * does not depend on how the attempts happen to go.
 */
export const GENERATION_WORK_LIMIT = 1_500_000;

/** Scrambles drawn for one candidate before it counts as a miss (§4 step 5). */
export const SCRAMBLE_ATTEMPT_LIMIT = 40;

/** A scramble may leave at most this share of tiles in their answer orientation (§4 step 5) — 60 %, as tenths. */
export const MAX_SAME_TENTHS = 6;

/**
 * The fewest tiles L1 alone must leave undecided on a Hard board (§5): a
 * quarter of the 8×8 board's 64.
 */
export const HARD_MIN_L1_OPEN = 16;

export interface TierSpec {
  /** The lowest and highest technique level the board may need (§5). */
  readonly minLevel: 1 | 2 | 3;
  readonly maxLevel: 1 | 2 | 3;
  /** The fewest tiles L1 alone must leave undecided (§5). */
  readonly minL1Open: number;
}

/** The tier table of §5. */
export const TIERS: Readonly<Record<Difficulty, TierSpec>> = {
  easy: { minLevel: 1, maxLevel: 1, minL1Open: 0 },
  medium: { minLevel: 2, maxLevel: 2, minL1Open: 0 },
  hard: { minLevel: 2, maxLevel: 3, minL1Open: HARD_MIN_L1_OPEN },
};

/** The central cells a source may stand on (§4 step 1): within one row and one column of the centre. */
export function sourceCells(width: number, height: number): number[] {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const out: number[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (Math.abs(row - cy) <= 1 && Math.abs(col - cx) <= 1) out.push(row * width + col);
    }
  }
  return out;
}

const DR = [-1, 0, 1, 0] as const;
const DC = [0, 1, 0, -1] as const;

export interface GrownTree {
  readonly source: number;
  /** Per cell, the tree's pipe set (bit 0 up, 1 right, 2 down, 3 left). */
  readonly masks: readonly number[];
  /** Work spent growing it: one cell scan per added edge (§4「仕事量の単位」). */
  readonly work: number;
}

/**
 * §4 step 1: a degree-≤3 spanning tree rooted at a central cell, or null
 * (with its work) when no edge is left to add before every cell is in.
 */
export function growTree(preset: Preset, rng: () => number): GrownTree | { readonly work: number } {
  const { width, height } = preset;
  const n = width * height;
  const centre = sourceCells(width, height);
  const source = centre[Math.floor(rng() * centre.length)]!;
  const masks = new Array<number>(n).fill(0);
  const degree = new Array<number>(n).fill(0);
  const inTree = new Array<boolean>(n).fill(false);
  inTree[source] = true;
  let work = 0;
  const frontier: number[] = [];
  for (let added = 1; added < n; added++) {
    work += n;
    frontier.length = 0;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] || degree[i]! >= 3) continue;
      const row = Math.floor(i / width);
      const col = i % width;
      for (let dir = 0; dir < 4; dir++) {
        const r = row + DR[dir]!;
        const c = col + DC[dir]!;
        if (r < 0 || r >= height || c < 0 || c >= width || inTree[r * width + c]) continue;
        frontier.push(i * 4 + dir);
      }
    }
    if (frontier.length === 0) return { work };
    const edge = frontier[Math.floor(rng() * frontier.length)]!;
    const from = edge >> 2;
    const dir = edge & 3;
    const to = (Math.floor(from / width) + DR[dir]!) * width + (from % width) + DC[dir]!;
    masks[from] = masks[from]! | (1 << dir);
    masks[to] = masks[to]! | (1 << ((dir + 2) & 3));
    degree[from] = degree[from]! + 1;
    degree[to] = degree[to]! + 1;
    inTree[to] = true;
  }
  return { source, masks, work };
}

/** What became of one derived seed (§14 counts these). */
export type AttemptOutcome =
  | 'shipped'
  /** The growth ran out of edges before every cell was in. */
  | 'grow'
  /** The techniques could not decide every tile (the board may still be unique). */
  | 'stuck'
  /** Decided by the techniques, but outside the tier's level or L1-open band. */
  | 'tier'
  /** The counter did not prove exactly one solution. */
  | 'not-unique'
  /** No acceptable scramble within SCRAMBLE_ATTEMPT_LIMIT draws. */
  | 'scramble'
  /** The work budget ran out inside this attempt. */
  | 'budget';

export interface Candidate {
  readonly board: Board;
  readonly solution: readonly number[];
  /** The technique level the types-only board needs, 0 when not decided (§5). */
  readonly level: 0 | 1 | 2 | 3;
  /** Tiles L1 alone leaves undecided (§5); -1 when the techniques did not decide the board. */
  readonly l1Open: number;
  readonly status: 'solved' | 'stuck' | 'contradiction' | 'aborted';
  /** Technique-solver work for the grade. */
  readonly solveWork: number;
}

export interface AttemptResult {
  readonly outcome: AttemptOutcome;
  readonly candidate: Candidate | null;
  /** The scrambled starting orientations, when the attempt shipped. */
  readonly initial: readonly number[] | null;
  /** Scrambles drawn (0 when none was). */
  readonly scrambles: number;
  /** Search nodes of the uniqueness count (0 when none ran). */
  readonly countNodes: number;
  readonly work: number;
}

/** Whether a graded candidate lands in its tier (§5). */
export function meetsTier(candidate: Candidate, tier: TierSpec): boolean {
  return (
    candidate.status === 'solved' &&
    candidate.level >= tier.minLevel &&
    candidate.level <= tier.maxLevel &&
    candidate.l1Open >= tier.minL1Open
  );
}

/** Steps 1–2: the tree's board and its grade — no tier, no count, no scramble. */
export function gradeTree(preset: Preset, tree: GrownTree, workLimit: number): Candidate {
  const tiles = tree.masks.map((mask) => tileOfMask(mask)!);
  const types: TileType[] = tiles.map((t) => t.type);
  const board = createBoard(preset.width, preset.height, types, tree.source);
  const solution = tiles.map((t) => t.orientation);
  const result = solve(board, { workLimit });
  const l1Open =
    result.status === 'solved' ? result.stageOf.filter((stage) => stage >= 2).length : -1;
  return {
    board,
    solution,
    level: result.status === 'solved' ? result.level : 0,
    l1Open,
    status: result.status,
    solveWork: result.work,
  };
}

/** How many tiles of `orientations` sit in their answer orientation. */
export function sameAsSolution(
  solution: readonly number[],
  orientations: readonly number[],
): number {
  let same = 0;
  for (let i = 0; i < solution.length; i++) if (solution[i] === orientations[i]) same++;
  return same;
}

/** Step 5: whether a scramble may ship — not solved, at most 60 % of tiles in their answer orientation. */
export function isAcceptableScramble(
  board: Board,
  solution: readonly number[],
  initial: readonly number[],
): boolean {
  if (sameAsSolution(solution, initial) * 10 > MAX_SAME_TENTHS * solution.length) return false;
  return !isSolved(board, initial);
}

export interface ScrambleResult {
  /** The accepted starting orientations, or null when none was. */
  readonly initial: readonly number[] | null;
  /** Draws made (each one costs the tile count). */
  readonly draws: number;
  readonly work: number;
  /** True when the next draw would have gone over `workLimit` — a cut, not a refusal of the board. */
  readonly outOfWork: boolean;
}

/**
 * Step 5's draws for one board, from their own stream (`<seed>|scramble`).
 * A draw is made only while its cost (the tile count) still fits in
 * `workLimit`, so the work never goes over it; running out reads as
 * `outOfWork`, never as an accepted scramble.
 */
export function scramble(
  board: Board,
  solution: readonly number[],
  seed: string,
  workLimit: number = Number.POSITIVE_INFINITY,
): ScrambleResult {
  const rng = createRng(`${seed}|scramble`);
  const n = board.types.length;
  let work = 0;
  for (let draw = 1; draw <= SCRAMBLE_ATTEMPT_LIMIT; draw++) {
    if (work + n > workLimit) return { initial: null, draws: draw - 1, work, outOfWork: true };
    work += n;
    const initial = board.types.map((type) => Math.floor(rng() * periodOf(type)));
    if (isAcceptableScramble(board, solution, initial)) {
      return { initial, draws: draw, work, outOfWork: false };
    }
  }
  return { initial: null, draws: SCRAMBLE_ATTEMPT_LIMIT, work, outOfWork: false };
}

/**
 * One derived seed, steps 1–5, under a work budget: the technique solver, the
 * counter and the scramble each run on no more than what is left, and a call
 * cut short reads as a miss ('budget'), never as a pass — so a shipped
 * attempt's work never exceeds its budget. Only the growth runs whole before
 * the first check, so a miss may go over by at most one growth (n(n − 1)).
 * Exported for the tests that re-make the
 * bundled boards and measure the tiers; play goes through `generatePuzzle`.
 */
export function attemptCandidate(
  seed: string,
  difficulty: Difficulty,
  budget: number = Number.POSITIVE_INFINITY,
): AttemptResult {
  const preset = PRESETS[difficulty];
  const tier = TIERS[difficulty];
  const rng = createRng(seed);
  const grown = growTree(preset, rng);
  let work = grown.work;
  const miss = (
    outcome: AttemptOutcome,
    candidate: Candidate | null,
    extra = 0,
  ): AttemptResult => ({
    outcome,
    candidate,
    initial: null,
    scrambles: 0,
    countNodes: extra,
    work,
  });
  if (!('masks' in grown)) return miss('grow', null);
  const left = (): number => budget - work;
  if (left() <= 0) return miss('budget', null);

  const candidate = gradeTree(preset, grown, Math.min(TECHNIQUE_WORK_LIMIT, left()));
  work += candidate.solveWork;
  if (candidate.status === 'aborted') return miss('budget', candidate);
  if (candidate.status !== 'solved') return miss('stuck', candidate);
  if (!meetsTier(candidate, tier)) return miss('tier', candidate);
  if (left() <= 0) return miss('budget', candidate);

  const count = countSolutions(candidate.board, {
    nodeLimit: SEARCH_NODE_LIMIT,
    workLimit: left(),
  });
  work += count.work;
  if (!count.complete) return miss('budget', candidate, count.nodes);
  if (count.count !== 1) return miss('not-unique', candidate, count.nodes);

  const drawn = scramble(candidate.board, candidate.solution, seed, left());
  work += drawn.work;
  if (drawn.initial === null) {
    const outcome = drawn.outOfWork ? 'budget' : 'scramble';
    return { ...miss(outcome, candidate, count.nodes), scrambles: drawn.draws };
  }
  return {
    outcome: 'shipped',
    candidate,
    initial: drawn.initial,
    scrambles: drawn.draws,
    countNodes: count.nodes,
    work,
  };
}

export interface GeneratedPuzzle {
  readonly board: Board;
  /** The one answer's orientations (§4). Never compared against for the win (§2). */
  readonly solution: readonly number[];
  /** The scrambled starting orientations (§4 step 5). */
  readonly initial: readonly number[];
  /** The technique level the board needs (§5). */
  readonly level: 1 | 2 | 3;
  /** Tiles L1 alone leaves undecided (§5). */
  readonly l1Open: number;
  /** Derived seeds drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Work spent over all attempts (§4「仕事量の単位」). */
  readonly work: number;
  /** True when a bundled board shipped (§4 step 6). */
  readonly fallback: boolean;
  /** Per outcome, how many attempts ended that way (the shipped one included). */
  readonly outcomes: Readonly<Partial<Record<AttemptOutcome, number>>>;
  /** Scrambles drawn for the shipped board (0 for a bundled one). */
  readonly scrambles: number;
  /** Search nodes of the shipped board's uniqueness count (0 for a bundled one). */
  readonly countNodes: number;
}

/**
 * The same seed always returns the same puzzle (§4): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, the budget is counted in
 * work rather than time, and the fallback board is picked by the seed's
 * hash. `attemptLimit` and `workLimit` are ATTEMPT_LIMIT and
 * GENERATION_WORK_LIMIT in play; the tests lower them to drive the fallback.
 */
export function generatePuzzle(
  seed: string,
  difficulty: Difficulty,
  attemptLimit: number = ATTEMPT_LIMIT,
  workLimit: number = GENERATION_WORK_LIMIT,
): GeneratedPuzzle {
  let work = 0;
  let drawn = 0;
  const outcomes: Partial<Record<AttemptOutcome, number>> = {};
  for (let attempt = 1; attempt <= attemptLimit; attempt++) {
    const left = workLimit - work;
    if (left <= 0) break;
    drawn = attempt;
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const result = attemptCandidate(derived, difficulty, left);
    work += result.work;
    outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
    if (result.outcome !== 'shipped') continue;
    const candidate = result.candidate!;
    return {
      board: candidate.board,
      solution: candidate.solution,
      initial: result.initial!,
      level: candidate.level as 1 | 2 | 3,
      l1Open: candidate.l1Open,
      attempts: attempt,
      work,
      fallback: false,
      outcomes,
      scrambles: result.scrambles,
      countNodes: result.countNodes,
    };
  }
  const bundled = bundledPuzzle(seed, difficulty);
  return { ...bundled, attempts: drawn, work, outcomes };
}

/** §4 step 6: a bundled board of the tier, picked by the seed's hash so the same seed gives the same board. */
export function bundledPuzzle(seed: string, difficulty: Difficulty): GeneratedPuzzle {
  const boards = BUNDLED_BOARDS[difficulty];
  const entry = boards[hashSeed(seed) % boards.length]!;
  const decoded = decodeBundled(difficulty, entry);
  return {
    ...decoded,
    level: entry.level,
    l1Open: entry.l1Open,
    attempts: 0,
    work: 0,
    fallback: true,
    outcomes: {},
    scrambles: 0,
    countNodes: 0,
  };
}
