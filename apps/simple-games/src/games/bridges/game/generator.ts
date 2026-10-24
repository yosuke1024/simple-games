/**
 * Board generation — implements docs/BRIDGES_RULES.md §6.
 *
 * One candidate per derived seed. Grow a network on the empty grid: start
 * from one island and repeatedly run a bridge from an island already placed,
 * straight out over open water, to a new island — never across a bridge,
 * never through or beside an island. Close a few loops with extra bridges
 * between islands that already see each other over open water. Each
 * island's number is then its total in that network — the network is the
 * answer the board is built from, so the board is solvable by construction.
 * Grade it with the technique solver and prove it unique with the counter;
 * ship it if both say the tier's word. A candidate that misses costs one
 * derived seed and another try (`<seed>#2`, `#3`, …).
 *
 * After `ATTEMPT_LIMIT` misses — or once the whole board has spent
 * `GENERATION_WORK_LIMIT` — the board falls back to one of the bundled
 * boards of bundled.ts — boards this generator made from recorded seeds,
 * re-made and re-verified by the tests — so a player always gets a board
 * the tier promises. The gate on all of this is work, never wall clock.
 */
import { BUNDLED_BOARDS, decodeBundled } from './bundled';
import { buildGraph, edgeBetween, isSolved, numbersFrom, type Graph } from './engine';
import { createRng, hashSeed, shuffled } from './rng';
import {
  SEARCH_NODE_LIMIT,
  TECHNIQUE_WORK_LIMIT,
  countRounds,
  countSolutions,
  gradeLayout,
  settledByPairs,
  solverWork,
  type Grade,
} from './solver';
import { PRESETS, type Difficulty, type Island, type Layout, type Preset } from './types';

/**
 * Derived seeds tried before the bundled fallback (§6). One Hard candidate
 * in five lands (§6, the table of candidates), so 80 misses in a row come
 * about twice in 10⁸ boards.
 */
export const ATTEMPT_LIMIT = 80;

/**
 * Work one board may spend, over all its attempts — solver work plus growth
 * steps (§6). Several times the heaviest board measured, so it never decides
 * a board in practice; what it does is put a ceiling on the worst case that
 * does not depend on how the attempts happen to go. Every solver call of an
 * attempt runs with what is left, and once nothing is left the board falls
 * back.
 */
export const GENERATION_WORK_LIMIT = 150_000;

/**
 * Growth steps one network may spend (§6, step 1). Each step picks an island
 * and a direction and either lays a bridge or finds the way closed; this is
 * many times what a board needs, so it only stops a crowded grid from
 * spinning.
 */
export const GROW_STEP_LIMIT = 600;

export interface TierSpec {
  /**
   * The fewest and the most times counting alone (T1–T2) may run dry on the
   * way to the answer — each time, one connectivity deduction (T3) or one
   * hypothesis (T4) has to move the board on (§7, `GradeReport.stalls`).
   */
  readonly minStalls: number;
  readonly maxStalls: number;
  /**
   * The fewest times counting must get stuck when every T3 deduction in
   * sight is taken at once (§7, `countRounds`) — 0 to leave it unmeasured.
   */
  readonly minRounds: number;
  /**
   * Whether the board must need more than counting plus the two pair rules
   * (§7, `settledByPairs`): a cut edge, a closed group of three or more
   * islands, or a hypothesis.
   */
  readonly beyondPairs: boolean;
  /** Whether the tier may need a hypothesis (T4) at all (§7). */
  readonly allowHypothesis: boolean;
  /** How often a grown bridge is a double (§6, step 1). */
  readonly doubleShare: number;
  /** How often an open pair of islands in sight gets a loop-closing bridge (§6, step 2). */
  readonly loopShare: number;
}

/**
 * The tier table of §7. The stall bands, the round floor and the pair rule
 * are the classification; the shares only tilt growth toward boards that
 * land in them (measured in §7: fewer doubles mean smaller numbers, and
 * small numbers settle less by counting).
 */
export const TIERS: Record<Difficulty, TierSpec> = {
  easy: {
    minStalls: 0,
    maxStalls: 0,
    minRounds: 0,
    beyondPairs: false,
    allowHypothesis: false,
    doubleShare: 0.5,
    loopShare: 0.1,
  },
  medium: {
    minStalls: 1,
    maxStalls: 3,
    minRounds: 0,
    beyondPairs: false,
    allowHypothesis: false,
    doubleShare: 0.2,
    loopShare: 0.05,
  },
  hard: {
    minStalls: 4,
    maxStalls: Number.POSITIVE_INFINITY,
    minRounds: 2,
    beyondPairs: true,
    allowHypothesis: true,
    doubleShare: 0.1,
    loopShare: 0.05,
  },
};

const STEPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

interface Network {
  readonly islands: number[];
  /** Grown and loop bridges: the two island cells and the count. */
  readonly bridges: { readonly from: number; readonly to: number; readonly count: number }[];
  /** Growth steps spent, counted into the generation work (§6). */
  readonly steps: number;
}

/**
 * Grows a network of up to `target` islands (§6, steps 1–2). Null when the
 * grid runs out of room, or the step limit comes, before the preset's
 * fewest islands.
 */
export function growNetwork(
  preset: Preset,
  target: number,
  tier: TierSpec,
  rng: () => number,
): Network | null {
  return grow(preset, target, tier, rng).network;
}

/** `growNetwork`, with the steps spent even when the growth fell short (§6). */
function grow(
  preset: Preset,
  target: number,
  tier: TierSpec,
  rng: () => number,
): { readonly network: Network | null; readonly steps: number } {
  const { width, height } = preset;
  const cells = width * height;
  // 0 water, 1 island, 2 bridge.
  const occupied = new Uint8Array(cells);
  const islands: number[] = [];
  const bridges: { from: number; to: number; count: number }[] = [];

  const islandBeside = (cell: number): boolean => {
    const row = Math.floor(cell / width);
    const col = cell % width;
    return (
      (row > 0 && occupied[cell - width] === 1) ||
      (row < height - 1 && occupied[cell + width] === 1) ||
      (col > 0 && occupied[cell - 1] === 1) ||
      (col < width - 1 && occupied[cell + 1] === 1)
    );
  };

  const first = Math.floor(rng() * cells);
  occupied[first] = 1;
  islands.push(first);

  let steps = 0;
  for (; steps < GROW_STEP_LIMIT && islands.length < target; steps++) {
    const from = islands[Math.floor(rng() * islands.length)]!;
    const [dr, dc] = STEPS[Math.floor(rng() * STEPS.length)]!;
    const row = Math.floor(from / width);
    const col = from % width;
    // Open water straight out from the island; a new island may stand two or
    // more cells out, on water with no island beside it.
    const stops: number[] = [];
    for (let distance = 1; ; distance++) {
      const r = row + dr * distance;
      const c = col + dc * distance;
      if (r < 0 || r >= height || c < 0 || c >= width) break;
      const cell = r * width + c;
      if (occupied[cell] !== 0) break;
      if (distance >= 2 && !islandBeside(cell)) stops.push(distance);
    }
    if (stops.length === 0) continue;
    const distance = stops[Math.floor(rng() * stops.length)]!;
    const to = (row + dr * distance) * width + (col + dc * distance);
    for (let d = 1; d < distance; d++) occupied[(row + dr * d) * width + (col + dc * d)] = 2;
    occupied[to] = 1;
    islands.push(to);
    bridges.push({ from, to, count: rng() < tier.doubleShare ? 2 : 1 });
  }
  // A crowded grid may stop short of the target; above the tier's floor that
  // is still a board of the tier (§7).
  if (islands.length < preset.minIslands) return { network: null, steps };

  // Step 2: close loops. Pairs of islands that see each other over open
  // water — no bridge in the way, so a bridge here crosses nothing — are
  // joined now and then. Read off the finished layout, in a seeded order.
  islands.sort((a, b) => a - b);
  const graph = buildGraph({
    width,
    height,
    islands: islands.map((index) => ({ index, value: 1 })),
  });
  // Every bridge marks the water it runs over, and no two islands stand side
  // by side, so an edge over open water carries no bridge yet.
  for (const edge of shuffled(graph.edges, rng)) {
    if (edge.cells.some((cell) => occupied[cell] !== 0)) continue;
    if (rng() >= tier.loopShare) continue;
    const from = graph.layout.islands[edge.a]!.index;
    const to = graph.layout.islands[edge.b]!.index;
    for (const cell of edge.cells) occupied[cell] = 2;
    bridges.push({ from, to, count: rng() < tier.doubleShare ? 2 : 1 });
  }
  return { network: { islands, bridges, steps }, steps };
}

export interface Candidate {
  readonly layout: Layout;
  /** Bridges per edge of the answer, in the graph's edge order. */
  readonly solution: readonly number[];
  readonly grade: Grade;
  /** Times counting alone ran dry on the way to the answer (§7). */
  readonly stalls: number;
  /**
   * Times counting got stuck with every T3 deduction in sight taken at once
   * (§7) — measured only when the tier asks for it and the candidate is
   * otherwise in its tier; null when not measured.
   */
  readonly rounds: number | null;
  /**
   * Whether counting plus the two pair rules settle the board (§7) —
   * measured under the same conditions as `rounds`; null when not measured
   * or cut short by the work budget.
   */
  readonly settledByPairs: boolean | null;
  /** Whether the counter proved exactly one solution (§6, step 4). */
  readonly unique: boolean;
  /** Growth steps spent (§6). */
  readonly steps: number;
}

/**
 * One candidate from one seed (§6, steps 1–4), or null when the network
 * could not be grown. Exported for the tests that pin the tier definitions
 * and re-make the bundled boards; play goes through `generatePuzzle`.
 */
export function buildCandidate(seed: string, preset: Preset, tier: TierSpec): Candidate | null {
  return attemptCandidate(seed, preset, tier, Number.POSITIVE_INFINITY).candidate;
}

/**
 * The checks of `meetsTier` that the grade, the counter and the island count
 * answer — everything but the round floor and the pair rule, which cost a
 * solve each and are only measured once these pass.
 */
function inBand(
  candidate: Omit<Candidate, 'rounds' | 'settledByPairs'>,
  preset: Preset,
  tier: TierSpec,
): boolean {
  const count = candidate.layout.islands.length;
  return (
    candidate.unique &&
    candidate.grade !== 'unsolved' &&
    (tier.allowHypothesis || candidate.grade !== 'advanced') &&
    candidate.stalls >= tier.minStalls &&
    candidate.stalls <= tier.maxStalls &&
    count >= preset.minIslands &&
    count <= preset.maxIslands
  );
}

/**
 * `buildCandidate` under a work budget (§6): every solver call runs with no
 * more than what is left of `budget`, and a call cut short by it reads as a
 * miss — an `unsolved` grade, an incomplete count — never as a pass. The
 * growth steps come back even when the growth fell short, so the board's
 * work counts them.
 */
function attemptCandidate(
  seed: string,
  preset: Preset,
  tier: TierSpec,
  budget: number,
): { readonly candidate: Candidate | null; readonly steps: number } {
  const rng = createRng(seed);
  const target =
    preset.minIslands + Math.floor(rng() * (preset.maxIslands - preset.minIslands + 1));
  const growth = grow(preset, target, tier, rng);
  const network = growth.network;
  if (network === null) return { candidate: null, steps: growth.steps };
  const end = solverWork.read() + budget - network.steps;
  const left = (cap: number): number => Math.min(cap, end - solverWork.read());

  // Step 3: the numbers are the network's totals.
  const skeleton = buildGraph({
    width: preset.width,
    height: preset.height,
    islands: network.islands.map((index) => ({ index, value: 1 })),
  });
  const solution = new Array<number>(skeleton.edges.length).fill(0);
  for (const bridge of network.bridges) {
    const a = skeleton.islandAt[bridge.from]!;
    const b = skeleton.islandAt[bridge.to]!;
    const id = edgeBetween(skeleton, a, b);
    // Cannot happen: a grown bridge runs between islands in sight.
    if (id === -1) return { candidate: null, steps: network.steps };
    solution[id] = bridge.count;
  }
  const numbers = numbersFrom(skeleton, solution);
  const islands: Island[] = network.islands.map((index, ordinal) => ({
    index,
    value: numbers[ordinal]!,
  }));
  const layout: Layout = { width: preset.width, height: preset.height, islands };
  const graph: Graph = buildGraph(layout);
  // The answer must keep every rule (§3).
  if (!isSolved(graph, solution)) return { candidate: null, steps: network.steps };

  // Step 4: grade, and prove the answer is the only one.
  const report = gradeLayout(layout, left(TECHNIQUE_WORK_LIMIT), graph);
  let unique = false;
  if (report.grade !== 'unsolved' && left(Number.MAX_SAFE_INTEGER) > 0) {
    const count = countSolutions(
      layout,
      2,
      SEARCH_NODE_LIMIT,
      graph,
      left(Number.MAX_SAFE_INTEGER),
    );
    unique = count.complete && count.solutions === 1;
  }
  const base = {
    layout,
    solution,
    grade: report.grade,
    stalls: report.stalls,
    unique,
    steps: network.steps,
  };
  // The two Hard measures (§7), cheapest first, only for a board that is in
  // its tier on everything else.
  let pairs: boolean | null = null;
  let rounds: number | null = null;
  if ((tier.beyondPairs || tier.minRounds > 0) && inBand(base, preset, tier)) {
    pairs = settledByPairs(layout, left(TECHNIQUE_WORK_LIMIT), graph);
    if ((!tier.beyondPairs || pairs === false) && tier.minRounds > 0) {
      rounds = countRounds(layout, left(TECHNIQUE_WORK_LIMIT), graph);
    }
  }
  return {
    candidate: { ...base, rounds, settledByPairs: pairs },
    steps: network.steps,
  };
}

/**
 * Whether a candidate meets its tier (§7): proven unique, settled by the
 * techniques, a hypothesis only where the tier allows one, the stall count
 * inside the tier's band, the island count inside the tier's range — and,
 * where the tier asks, counting stuck at least `minRounds` times and more
 * than the pair rules needed. A measure the tier asks for and the candidate
 * did not take fails the tier.
 */
export function meetsTier(candidate: Candidate, preset: Preset, tier: TierSpec): boolean {
  return (
    inBand(candidate, preset, tier) &&
    (tier.minRounds === 0 || (candidate.rounds !== null && candidate.rounds >= tier.minRounds)) &&
    (!tier.beyondPairs || candidate.settledByPairs === false)
  );
}

export interface GeneratedPuzzle extends Layout {
  /** Bridges per edge of the one answer. */
  readonly solution: readonly number[];
  readonly grade: Grade;
  /** Times counting alone ran dry on the way to the answer (§7). */
  readonly stalls: number;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Solver work plus growth steps spent building this puzzle (§6). */
  readonly work: number;
  /**
   * True when every attempt missed, or the work budget ran out, and a
   * bundled board shipped (§6, step 6).
   */
  readonly fallback: boolean;
}

/**
 * The same seed always returns the same puzzle (§6): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, the budget is counted in
 * work rather than time, and the fallback board is picked by the seed's
 * hash, so what ships is a function of the seed and the difficulty alone.
 * `attemptLimit` and `workLimit` are ATTEMPT_LIMIT and
 * GENERATION_WORK_LIMIT in play; the tests lower them to drive the fallback.
 *
 * The work spent is at most `workLimit` plus the last attempt's growth
 * (GROW_STEP_LIMIT) and a few units of overshoot: each solver call stops at
 * what is left, and no attempt starts once nothing is.
 */
export function generatePuzzle(
  seed: string,
  difficulty: Difficulty,
  attemptLimit: number = ATTEMPT_LIMIT,
  workLimit: number = GENERATION_WORK_LIMIT,
): GeneratedPuzzle {
  const preset = PRESETS[difficulty];
  const tier = TIERS[difficulty];
  const before = solverWork.read();
  let steps = 0;
  const spent = (): number => solverWork.read() - before + steps;
  let drawn = 0;
  for (let attempt = 1; attempt <= attemptLimit; attempt++) {
    const left = workLimit - spent();
    if (left <= 0) break;
    drawn = attempt;
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const { candidate, steps: grown } = attemptCandidate(derived, preset, tier, left);
    steps += grown;
    if (candidate === null || !meetsTier(candidate, preset, tier)) continue;
    return {
      ...candidate.layout,
      solution: candidate.solution,
      grade: candidate.grade,
      stalls: candidate.stalls,
      attempts: attempt,
      work: spent(),
      fallback: false,
    };
  }
  return bundledPuzzle(seed, difficulty, drawn, spent());
}

/**
 * The fallback of §6, step 6: a bundled board of the tier, picked by the
 * seed's hash so the same seed still gives the same board.
 */
export function bundledPuzzle(
  seed: string,
  difficulty: Difficulty,
  attempts: number,
  work: number,
): GeneratedPuzzle {
  const boards = BUNDLED_BOARDS[difficulty];
  const board = boards[hashSeed(seed) % boards.length]!;
  const { layout, solution } = decodeBundled(difficulty, board);
  return {
    ...layout,
    solution,
    grade: board.grade,
    stalls: board.stalls,
    attempts,
    work,
    fallback: true,
  };
}
