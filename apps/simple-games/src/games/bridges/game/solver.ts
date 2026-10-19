/**
 * The solvers of docs/BRIDGES_RULES.md §6 and §7.
 *
 * Every edge carries a domain: the bridge counts (0, 1, 2) it may still
 * take, as a 3-bit mask. Four techniques narrow the domains, each sound —
 * none removes a count that some solution uses:
 *
 *   T1 count     — an island's number against the most and the least its
 *                  edges can still carry: what the others cannot supply this
 *                  edge must, and what the others already carry it may not.
 *   T2 crossing  — an edge sure to carry a bridge closes every edge it crosses.
 *   T3 connect   — the islands must end up as one group: an edge whose loss
 *                  would cut the possible network in two must carry a bridge,
 *                  and a count that would close a group off — every island in
 *                  it on its number, with islands left outside — is ruled out.
 *   T4 hypothesis — assume one count on one edge, run T1–T3 to a fixpoint;
 *                  a contradiction rules the count out (depth one).
 *
 * The tiers of §7 are read off how often a board needs more than counting:
 * the solver climbs a ladder — T1–T2 to a fixpoint, then one T3 deduction
 * or, failing that, one T4 elimination, then back to the bottom — and the
 * number of climbs is the board's `stalls`. Easy boards never stall, Medium
 * boards stall one to three times and never need T4, Hard boards stall four
 * times or more. Because a climb takes one deduction even when several are
 * in sight at once, Hard also asks for two measures that do not count that
 * way (§7): `countRounds` — how often counting runs dry when every T3
 * deduction in sight is taken together — and `settledByPairs` — whether
 * counting plus the two pair rules (two 1s never join, two 2s never double)
 * already settle the board. One implementation serves the three callers
 * that must agree — the generator's grade (§6), the Hint (§9) and
 * `guarantee.test.ts` — and the counter below runs on the same propagation,
 * so "unique" and "solvable" are read the same way.
 *
 * Work is counted in `solverWork` — island examinations, search nodes and
 * hypothesis trials — because that is the number the budgets are stated in
 * (§6): the same seed gives the same count on any machine. Every entry point
 * takes a work limit and, on reaching it, says so instead of guessing.
 */
import { buildGraph, isSolved, otherEnd, type Graph } from './engine';
import { MAX_BRIDGES_PER_PAIR, type Bridges, type Layout } from './types';

let work = 0;

/** Island examinations, search nodes and hypothesis trials since the last reset (§6). */
export const solverWork = {
  read: (): number => work,
  reset: (): void => {
    work = 0;
  },
};

/**
 * Nodes the solution counter may expand before it gives up and reports that
 * it does not know (§6). Candidates need a few dozen at most — the techniques
 * settle most of the board at the root — so this only stops a pathological
 * layout from spinning. The generator and the save's re-proof (§10) use the
 * same cap, so every board the generator proved unique proves unique again
 * on load.
 */
export const SEARCH_NODE_LIMIT = 500;

/**
 * Work one technique solve may spend (§6, §9) — a few times the heaviest
 * candidate measured. Reaching it makes the grade `unsolved` and the hint
 * silent — never a guess.
 */
export const TECHNIQUE_WORK_LIMIT = 100_000;

// ---------- domains ----------

/** Bit k set: k bridges still possible. */
type Domain = number;

const BIT = [1, 2, 4] as const;
/** The least count in a domain. */
const LO = [0, 0, 1, 0, 2, 0, 1, 0] as const;
/** The greatest count in a domain. */
const HI = [0, 0, 1, 1, 2, 2, 2, 2] as const;
/** How many counts a domain holds. */
const SIZE = [0, 1, 1, 2, 1, 2, 2, 3] as const;

/** Counts from `min` to `max`, clamped to 0–2; empty when min > max. */
function rangeMask(min: number, max: number): Domain {
  const from = Math.max(0, min);
  const to = Math.min(MAX_BRIDGES_PER_PAIR, max);
  let mask = 0;
  for (let k = from; k <= to; k++) mask |= BIT[k]!;
  return mask;
}

export type Technique = 'count' | 'connect' | 'hypothesis';

/**
 * One rise of an edge's least count — the only kind of deduction a player
 * can act on (an upper bound coming down is not a bridge to build).
 */
export interface SolveEvent {
  readonly edge: number;
  /** The new least count. */
  readonly atLeast: number;
  readonly technique: Technique;
  /** The island whose number forced it (T1), or -1. */
  readonly island: number;
}

interface Ctx {
  readonly graph: Graph;
  readonly islandCount: number;
  readonly values: readonly number[];
  readonly limit: number;
  /** Where rises are written, or null when nobody is listening. */
  log: SolveEvent[] | null;
  /** Stop everything once the log holds its first rise — all the hint reads (§9). */
  stopAtFirstRise: boolean;
  /** Set when `stopAtFirstRise` has stopped the run. */
  halted: boolean;
  aborted: boolean;
}

function createCtx(graph: Graph, limit: number): Ctx {
  return {
    graph,
    islandCount: graph.layout.islands.length,
    values: graph.layout.islands.map((island) => island.value),
    limit: work + limit,
    log: null,
    stopAtFirstRise: false,
    halted: false,
    aborted: false,
  };
}

/** The domains a bare board starts from: 0 up to what both islands' numbers allow (§2). */
function initialDomains(ctx: Ctx): Uint8Array {
  const { edges } = ctx.graph;
  const dom = new Uint8Array(edges.length);
  for (const edge of edges) {
    dom[edge.id] = rangeMask(0, Math.min(ctx.values[edge.a]!, ctx.values[edge.b]!));
  }
  return dom;
}

/**
 * The domains of a player's board (§9): what both numbers allow, from the
 * bridges already built upward — the board read as lower bounds, with every
 * edge a built bridge crosses closed (T2). Null when a built count is past
 * what the numbers allow; the hint reaches here only from a board at or
 * under the answer, where that cannot happen.
 */
function domainsFrom(ctx: Ctx, bridges: Bridges): Uint8Array | null {
  const dom = initialDomains(ctx);
  for (let id = 0; id < dom.length; id++) {
    dom[id] = dom[id]! & rangeMask(bridges[id]!, MAX_BRIDGES_PER_PAIR);
    if (dom[id] === 0) return null;
  }
  for (let id = 0; id < dom.length; id++) {
    if (bridges[id]! === 0) continue;
    for (const other of ctx.graph.crossings[id]!) {
      dom[other] = dom[other]! & 1;
      if (dom[other] === 0) return null;
    }
  }
  return dom;
}

/**
 * Narrows one edge, keeping T2 in step: an edge that becomes sure of a bridge
 * closes everything it crosses. Calls `touch` for every island whose edges
 * changed. False on a contradiction.
 */
function narrow(
  ctx: Ctx,
  dom: Uint8Array,
  edgeId: number,
  next: Domain,
  technique: Technique,
  island: number,
  touch: (island: number) => void,
): boolean {
  const before = dom[edgeId]!;
  if (next === before) return true;
  if (next === 0) return false;
  dom[edgeId] = next;
  const edge = ctx.graph.edges[edgeId]!;
  touch(edge.a);
  touch(edge.b);
  if (LO[next]! > LO[before]!) {
    if (ctx.log !== null) {
      ctx.log.push({ edge: edgeId, atLeast: LO[next]!, technique, island });
      if (ctx.stopAtFirstRise) ctx.halted = true;
    }
    if (LO[before] === 0) {
      for (const other of ctx.graph.crossings[edgeId]!) {
        const d = dom[other]!;
        if ((d & ~1) === 0) continue;
        const nd = d & 1;
        if (nd === 0) return false;
        dom[other] = nd;
        const crossed = ctx.graph.edges[other]!;
        touch(crossed.a);
        touch(crossed.b);
      }
    }
  }
  return true;
}

/**
 * T1 and T2 to a fixpoint over a worklist of islands. Reading the sums once
 * per island and narrowing as it goes is sound: a stale sum is a looser
 * bound, never a tighter one. False on a contradiction or an abort; true,
 * short of the fixpoint, once the run has halted at its first rise.
 */
function propagateCount(ctx: Ctx, dom: Uint8Array, seeds: readonly number[] | null): boolean {
  const { graph, values, islandCount } = ctx;
  const queued = new Uint8Array(islandCount);
  const queue: number[] = [];
  const touch = (island: number): void => {
    if (queued[island] === 0) {
      queued[island] = 1;
      queue.push(island);
    }
  };
  if (seeds === null) for (let i = 0; i < islandCount; i++) touch(i);
  else for (const i of seeds) touch(i);

  while (queue.length > 0) {
    const island = queue.pop()!;
    queued[island] = 0;
    if (++work > ctx.limit) {
      ctx.aborted = true;
      return false;
    }
    const value = values[island]!;
    const edges = graph.islandEdges[island]!;
    let sumLo = 0;
    let sumHi = 0;
    for (const id of edges) {
      sumLo += LO[dom[id]!]!;
      sumHi += HI[dom[id]!]!;
    }
    if (sumLo > value || sumHi < value) return false;
    for (const id of edges) {
      const d = dom[id]!;
      const need = value - (sumHi - HI[d]!);
      const allow = value - (sumLo - LO[d]!);
      const nd = d & rangeMask(need, allow);
      if (nd !== d && !narrow(ctx, dom, id, nd, 'count', island, touch)) return false;
      if (ctx.halted) return true;
    }
  }
  return true;
}

/** A small union-find over island ordinals. */
function makeSets(size: number): {
  find: (x: number) => number;
  union: (a: number, b: number) => void;
} {
  const parent = new Int32Array(size);
  for (let i = 0; i < size; i++) parent[i] = i;
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[x] !== root) {
      const up = parent[x]!;
      parent[x] = root;
      x = up;
    }
    return root;
  };
  return { find, union: (a, b) => void (parent[find(a)] = find(b)) };
}

/**
 * The edges whose removal would split the network of edges that can still
 * carry a bridge (graph bridges, by Tarjan's low-link). Only meaningful on a
 * connected network.
 */
function cutEdges(ctx: Ctx, dom: Uint8Array): number[] {
  const { graph, islandCount } = ctx;
  const order = new Int32Array(islandCount).fill(-1);
  const low = new Int32Array(islandCount);
  const cuts: number[] = [];
  let clock = 0;
  // Iterative DFS: island, the edge it was reached by, and the next edge to look at.
  const stackIsland: number[] = [];
  const stackVia: number[] = [];
  const stackNext: number[] = [];
  for (let root = 0; root < islandCount; root++) {
    if (order[root] !== -1) continue;
    order[root] = low[root] = clock++;
    stackIsland.push(root);
    stackVia.push(-1);
    stackNext.push(0);
    while (stackIsland.length > 0) {
      const top = stackIsland.length - 1;
      const island = stackIsland[top]!;
      const edges = graph.islandEdges[island]!;
      const at = stackNext[top]!;
      if (at < edges.length) {
        stackNext[top] = at + 1;
        const id = edges[at]!;
        if (id === stackVia[top] || HI[dom[id]!] === 0) continue;
        const other = otherEnd(graph.edges[id]!, island);
        if (order[other] === -1) {
          order[other] = low[other] = clock++;
          stackIsland.push(other);
          stackVia.push(id);
          stackNext.push(0);
        } else {
          low[island] = Math.min(low[island]!, order[other]!);
        }
        continue;
      }
      stackIsland.pop();
      const via = stackVia.pop()!;
      stackNext.pop();
      if (via === -1) continue;
      const parent = stackIsland[stackIsland.length - 1]!;
      low[parent] = Math.min(low[parent]!, low[island]!);
      if (low[island]! > order[parent]!) cuts.push(via);
    }
  }
  return cuts;
}

type Round = 'changed' | 'stuck' | 'contradiction';

/**
 * T3 — connectivity (§6). 'changed' sends the caller back to T1–T2. With
 * `single`, the pass stops at its first narrowing — the grading and the hint
 * count and show deductions one at a time (§7, §9). Without it the pass takes
 * every deduction in sight — every cut edge, then every closed group read on
 * the board those cut edges leave — which is one round (§7, `countRounds`)
 * and the counter's propagation.
 *
 *   1. Every island must still be reachable through edges that can carry a
 *      bridge, or the board is lost.
 *   2. An edge that is the only link between two parts of that network must
 *      carry at least one bridge.
 *   3. A group joined by sure bridges in which every island is on its number
 *      is closed: nothing more can leave it. One that is not every island is
 *      a contradiction, and a count on an edge that would make one is ruled
 *      out — the reasoning that keeps two 1s from joining, or two 2s from
 *      doubling up, generalised to any group.
 */
function propagateConnect(ctx: Ctx, dom: Uint8Array, single: boolean): Round {
  const { graph, values, islandCount } = ctx;
  work += islandCount;
  if (work > ctx.limit) {
    ctx.aborted = true;
    return 'contradiction';
  }
  const touch = (): void => {};

  // 1. The possible network is one piece.
  const possible = makeSets(islandCount);
  for (const edge of graph.edges) if (HI[dom[edge.id]!]! > 0) possible.union(edge.a, edge.b);
  const root = possible.find(0);
  for (let i = 1; i < islandCount; i++) if (possible.find(i) !== root) return 'contradiction';

  // 2. Cut edges must carry a bridge.
  let changed = false;
  for (const id of cutEdges(ctx, dom)) {
    const d = dom[id]!;
    if (LO[d]! > 0) continue;
    if (!narrow(ctx, dom, id, d & ~1, 'connect', -1, touch)) return 'contradiction';
    if (single) return 'changed';
    changed = true;
  }

  // 3. Closed groups. `short` is what each island still lacks of its number
  // over the sure bridges; a group's deficit is the sum over its islands.
  const sure = makeSets(islandCount);
  for (const edge of graph.edges) if (LO[dom[edge.id]!]! > 0) sure.union(edge.a, edge.b);
  const short = new Int32Array(islandCount);
  const deficit = new Int32Array(islandCount);
  const size = new Int32Array(islandCount);
  for (let i = 0; i < islandCount; i++) {
    let carried = 0;
    for (const id of graph.islandEdges[i]!) carried += LO[dom[id]!]!;
    short[i] = values[i]! - carried;
    const group = sure.find(i);
    deficit[group]! += short[i]!;
    size[group]!++;
  }
  for (let i = 0; i < islandCount; i++) {
    if (sure.find(i) === i && deficit[i] === 0 && size[i]! < islandCount) return 'contradiction';
  }
  for (const edge of graph.edges) {
    const d = dom[edge.id]!;
    if (SIZE[d]! < 2) continue;
    const lo = LO[d]!;
    const ga = sure.find(edge.a);
    const gb = sure.find(edge.b);
    const groupDeficit = ga === gb ? deficit[ga]! : deficit[ga]! + deficit[gb]!;
    const groupSize = ga === gb ? size[ga]! : size[ga]! + size[gb]!;
    if (groupSize >= islandCount) continue;
    let next = d;
    for (let k = Math.max(1, lo + 1); k <= MAX_BRIDGES_PER_PAIR; k++) {
      if ((d & BIT[k]!) === 0) continue;
      const added = k - lo;
      // A count that puts an end past its number is T1's to rule out; only
      // when both ends stay within their numbers does a zero deficit mean
      // every island of the merged group is exactly on its number.
      if (added > short[edge.a]! || added > short[edge.b]!) continue;
      if (groupDeficit - 2 * added === 0) next &= ~BIT[k]!;
    }
    if (next === d) continue;
    if (!narrow(ctx, dom, edge.id, next, 'connect', -1, touch)) return 'contradiction';
    if (single) return 'changed';
    changed = true;
  }
  return changed ? 'changed' : 'stuck';
}

const allDecided = (dom: Uint8Array): boolean => dom.every((d) => SIZE[d] === 1);

/** The counts of a domain array: the count where decided, -1 where not. */
const countsOf = (dom: Uint8Array): number[] =>
  Array.from(dom, (d) => (SIZE[d] === 1 ? LO[d]! : -1));

/**
 * T1–T3 (or T1–T2 at level 1) to a fixpoint, every deduction applied as
 * found. False on a contradiction or an abort — a board fully decided but
 * not one group is a contradiction too.
 */
function propagate(
  ctx: Ctx,
  dom: Uint8Array,
  level: number,
  seeds: readonly number[] | null = null,
): boolean {
  let first = seeds;
  for (;;) {
    if (!propagateCount(ctx, dom, first)) return false;
    first = null;
    if (allDecided(dom)) return isSolved(ctx.graph, countsOf(dom));
    if (level < 2) return true;
    const round = propagateConnect(ctx, dom, false);
    if (round === 'contradiction') return false;
    if (round === 'stuck') return true;
  }
}

/** The islands an edge's change can reach at once: its ends, and the ends of every edge it crosses (T2). */
function reach(ctx: Ctx, id: number): number[] {
  const edge = ctx.graph.edges[id]!;
  const out = [edge.a, edge.b];
  for (const other of ctx.graph.crossings[id]!) {
    const crossed = ctx.graph.edges[other]!;
    out.push(crossed.a, crossed.b);
  }
  return out;
}

/**
 * T4 — the first depth-one hypothesis that fails (§6). Each count of each
 * undecided edge, in edge order, is assumed and run through T1–T3; the first
 * that ends in a contradiction is ruled out on the real board, and the pass
 * stops there so the caller can go back to the cheaper techniques. Trials
 * never write to the log.
 */
function hypothesise(ctx: Ctx, dom: Uint8Array): Round {
  for (let id = 0; id < dom.length; id++) {
    const d = dom[id]!;
    if (SIZE[d]! < 2) continue;
    for (let k = 0; k <= MAX_BRIDGES_PER_PAIR; k++) {
      if ((d & BIT[k]!) === 0) continue;
      if (++work > ctx.limit) {
        ctx.aborted = true;
        return 'contradiction';
      }
      const trial = dom.slice();
      const log = ctx.log;
      ctx.log = null;
      const held =
        narrow(ctx, trial, id, BIT[k]!, 'hypothesis', -1, () => {}) &&
        propagate(ctx, trial, 2, reach(ctx, id));
      ctx.log = log;
      if (ctx.aborted) return 'contradiction';
      if (held) continue;
      return narrow(ctx, dom, id, d & ~BIT[k]!, 'hypothesis', -1, () => {})
        ? 'changed'
        : 'contradiction';
    }
  }
  return 'stuck';
}

export interface SolveResult {
  /** Bridges per edge after the techniques ran out, -1 where they could not decide. */
  readonly fixed: readonly number[];
  /** Every edge decided and the board a win: the board needs no guess and is unique (§6). */
  readonly solved: boolean;
  /** No solution is consistent with the start. */
  readonly contradiction: boolean;
  /** The work limit was reached first; nothing is claimed either way. */
  readonly aborted: boolean;
  /** The strongest technique that narrowed anything: 0 none, 1 T1–T2, 2 T3, 3 T4. */
  readonly level: number;
  /** T3 deductions made, one at a time — or, in a run by rounds, T3 rounds. */
  readonly connectSteps: number;
  /** T4 eliminations made. */
  readonly hypothesisSteps: number;
  /**
   * Times T1–T2 ran dry and T3 or T4 had to move the board on:
   * connectSteps + hypothesisSteps (§7) — `stalls`, or `rounds` in a run by
   * rounds.
   */
  readonly stalls: number;
}

/**
 * Runs the techniques up to `maxLevel` (1 = T1–T2, 2 = + T3, 3 = + T4) from a
 * start — the bare board, or the player's bridges read as lower bounds — as
 * a ladder: T1–T2 to a fixpoint; when they run dry, one T3 deduction and
 * back to the bottom; when T3 has nothing either, one T4 elimination and
 * back to the bottom. Every rung is consulted only when everything cheaper
 * is silent, so the counts read "how often counting alone was not enough".
 *
 * `byRounds` takes every T3 deduction in sight at each climb instead of one
 * (`propagateConnect` without `single`), so the count reads "how often
 * counting got stuck" however many deductions each time had in view (§7).
 * A run that halts at its first rise (the hint) reports nothing settled.
 */
function runSolve(ctx: Ctx, dom: Uint8Array, maxLevel: number, byRounds = false): SolveResult {
  let level = 0;
  let connectSteps = 0;
  let hypothesisSteps = 0;
  const finish = (solved: boolean, contradiction: boolean): SolveResult => ({
    fixed: countsOf(dom),
    solved,
    contradiction: contradiction && !ctx.aborted,
    aborted: ctx.aborted,
    level,
    connectSteps,
    hypothesisSteps,
    stalls: connectSteps + hypothesisSteps,
  });
  let seeds: readonly number[] | null = null;
  for (;;) {
    const before = level === 0 ? dom.slice() : null;
    if (!propagateCount(ctx, dom, seeds)) return finish(false, true);
    if (ctx.halted) return finish(false, false);
    if (before !== null && !dom.every((d, i) => d === before[i])) level = 1;
    seeds = null;
    if (allDecided(dom)) {
      const solved = isSolved(ctx.graph, countsOf(dom));
      return finish(solved, !solved);
    }
    if (maxLevel < 2) return finish(false, false);
    const connect = propagateConnect(ctx, dom, !byRounds);
    if (connect === 'contradiction') return finish(false, true);
    if (connect === 'changed') {
      level = Math.max(level, 2);
      connectSteps++;
      if (ctx.halted) return finish(false, false);
      continue;
    }
    if (maxLevel < 3) return finish(false, false);
    const trial = hypothesise(ctx, dom);
    if (trial === 'contradiction') return finish(false, true);
    if (trial === 'stuck') return finish(false, false);
    level = 3;
    hypothesisSteps++;
    if (ctx.halted) return finish(false, false);
  }
}

/** The techniques up to `maxLevel` on a bare layout (§6, §7). */
export function solve(
  layout: Layout,
  maxLevel: 1 | 2 | 3 = 3,
  limit: number = TECHNIQUE_WORK_LIMIT,
  graph: Graph = buildGraph(layout),
): SolveResult {
  const ctx = createCtx(graph, limit);
  return runSolve(ctx, initialDomains(ctx), maxLevel);
}

/**
 * `rounds` (§7): how many times counting (T1–T2) runs dry on the way to the
 * answer when, each time, every T3 deduction in sight is taken at once — a
 * T4 elimination counts as one. Unlike `stalls`, a board with five pairs of
 * 1s in view at the start counts one, not five. Null when the techniques do
 * not settle the board within the limit.
 */
export function countRounds(
  layout: Layout,
  limit: number = TECHNIQUE_WORK_LIMIT,
  graph: Graph = buildGraph(layout),
): number | null {
  const ctx = createCtx(graph, limit);
  const result = runSolve(ctx, initialDomains(ctx), 3, true);
  return result.solved ? result.stalls : null;
}

/**
 * Whether counting (T1–T2) settles the board once the two pair rules are
 * known (§7): two 1s never join, and two 2s never take a double — each
 * would close the pair off from the rest. These are the T3 deductions that
 * need nothing but the two numbers, so a player learns them first; a Hard
 * board must need something past them (a cut edge, a closed group of three
 * or more, or a hypothesis). Null when the work limit came first — neither
 * answer is claimed.
 */
export function settledByPairs(
  layout: Layout,
  limit: number = TECHNIQUE_WORK_LIMIT,
  graph: Graph = buildGraph(layout),
): boolean | null {
  const ctx = createCtx(graph, limit);
  const dom = initialDomains(ctx);
  if (ctx.islandCount > 2) {
    for (const edge of graph.edges) {
      const a = ctx.values[edge.a]!;
      const b = ctx.values[edge.b]!;
      if (a === 1 && b === 1) dom[edge.id] = dom[edge.id]! & BIT[0];
      else if (a === 2 && b === 2) dom[edge.id] = dom[edge.id]! & ~BIT[2];
    }
  }
  const result = runSolve(ctx, dom, 1);
  return result.aborted ? null : result.solved;
}

export type Grade = 'basic' | 'connect' | 'advanced' | 'unsolved';

export interface GradeReport {
  readonly grade: Grade;
  /** The answer the techniques reached, when they reached one. */
  readonly solution: readonly number[] | null;
  readonly connectSteps: number;
  readonly hypothesisSteps: number;
  readonly stalls: number;
}

/**
 * What the techniques make of a bare layout (§7): `basic` when T1–T2 settle
 * it, `connect` when T3 is needed too, `advanced` when T4 is needed, and
 * `unsolved` when T1–T4 stop short (or the work limit came first) — plus the
 * stall count the tiers are banded on.
 *
 * One run at level 3 is enough: the techniques are tried cheapest first and
 * run to a fixpoint before anything stronger is consulted, and that fixpoint
 * does not depend on the order — so the strongest technique the run used is
 * exactly the weakest set that solves the board.
 */
export function gradeLayout(
  layout: Layout,
  limit: number = TECHNIQUE_WORK_LIMIT,
  graph: Graph = buildGraph(layout),
): GradeReport {
  const result = solve(layout, 3, limit, graph);
  const grade: Grade = !result.solved
    ? 'unsolved'
    : result.level >= 3
      ? 'advanced'
      : result.level === 2
        ? 'connect'
        : 'basic';
  return {
    grade,
    solution: result.solved ? result.fixed : null,
    connectSteps: result.connectSteps,
    hypothesisSteps: result.hypothesisSteps,
    stalls: result.stalls,
  };
}

// ---------- counting (§6) ----------

export interface CountResult {
  /** Solutions found: 0, 1 or 2 (the search stops at `limit`). */
  readonly solutions: number;
  /**
   * True when the search ran to its end (or to `limit`). False when the node
   * limit or the work limit came first: `solutions` is then only a lower
   * bound, and nothing may be concluded from it — not uniqueness, not
   * impossibility.
   */
  readonly complete: boolean;
  /** The first solution found, when there was one. */
  readonly solution: readonly number[] | null;
  /** Search nodes expanded. */
  readonly nodes: number;
}

/**
 * Counts the solutions of a layout up to `limit` (2 is enough to say
 * "unique"). Each node runs T1–T3 to a fixpoint and branches on the
 * undecided edge with the fewest counts left; a contradiction ends the
 * branch. The techniques are sound, so pruning by them loses no solution
 * and the count is exact — when the search completes. `workLimit` caps the
 * propagation work as well as the nodes (the generator's budget, §6); a
 * propagation cut short by it ends the count as incomplete, never as a
 * pruned branch.
 */
export function countSolutions(
  layout: Layout,
  limit = 2,
  nodeLimit: number = SEARCH_NODE_LIMIT,
  graph: Graph = buildGraph(layout),
  workLimit: number = Number.MAX_SAFE_INTEGER,
): CountResult {
  const ctx = createCtx(graph, workLimit);
  let found = 0;
  let nodes = 0;
  let incomplete = false;
  let first: number[] | null = null;

  const search = (dom: Uint8Array, seeds: readonly number[] | null): void => {
    if (found >= limit || incomplete) return;
    if (++nodes > nodeLimit) {
      incomplete = true;
      return;
    }
    work++;
    if (!propagate(ctx, dom, 2, seeds)) {
      if (ctx.aborted) incomplete = true;
      return;
    }
    let best = -1;
    for (let id = 0; id < dom.length; id++) {
      const size = SIZE[dom[id]!]!;
      if (size < 2) continue;
      if (best === -1 || size < SIZE[dom[best]!]!) best = id;
      if (size === 2) break;
    }
    if (best === -1) {
      found++;
      first ??= countsOf(dom);
      return;
    }
    for (let k = 0; k <= MAX_BRIDGES_PER_PAIR; k++) {
      if ((dom[best]! & BIT[k]!) === 0) continue;
      const branch = dom.slice();
      if (narrow(ctx, branch, best, BIT[k]!, 'hypothesis', -1, () => {})) {
        search(branch, reach(ctx, best));
      }
      if (found >= limit || incomplete) return;
    }
  };

  search(initialDomains(ctx), null);
  return {
    solutions: found,
    complete: !incomplete,
    solution: first,
    nodes: Math.min(nodes, nodeLimit),
  };
}

/** Whether the layout has exactly one solution, proven by a search that ran to its end (§6). */
export function isUnique(layout: Layout, graph: Graph = buildGraph(layout)): boolean {
  const result = countSolutions(layout, 2, SEARCH_NODE_LIMIT, graph);
  return result.complete && result.solutions === 1;
}

// ---------- the hint (§9) ----------

export type Hint =
  /** An edge carrying more bridges than the answer: the board cannot be finished from here (§9, step 1). */
  | {
      readonly kind: 'wrong';
      readonly edge: number;
      readonly count: number;
      readonly answer: number;
    }
  /** The next thing the techniques prove from the player's own board (§9, step 2). */
  | {
      readonly kind: 'step';
      readonly edge: number;
      readonly atLeast: number;
      readonly technique: Technique;
      /**
       * The island whose number, read against what the player can see, forces
       * the bridge on its own (§9, step 2a) — or -1 when the reason is a chain
       * of deductions no single island shows (step 2b).
       */
      readonly island: number;
    };

/**
 * Step 2a of the hint (§9): a rise the player can check at one island. Each
 * of the island's pairs can take at most — 0 where a built bridge crosses
 * the way; otherwise two, and no more than either island has left once its
 * other built bridges are counted. Whatever the island's other pairs cannot
 * take, this pair must. Islands are scanned in board order and the first
 * rise past what is built is returned. Every figure is one the board shows
 * — a number, a built bridge, a crossing — so the island named is the whole
 * reason. Sound on a board at or under the answer (step 1 sees to that):
 * built bridges are then lower bounds of the answer and each cap an upper
 * bound. Null when no island shows one, or when the work limit came first.
 */
function evidentRise(
  ctx: Ctx,
  bridges: Bridges,
): { readonly edge: number; readonly atLeast: number; readonly island: number } | null {
  const { graph, values, islandCount } = ctx;
  const carried = new Int32Array(islandCount);
  for (const edge of graph.edges) {
    carried[edge.a]! += bridges[edge.id]!;
    carried[edge.b]! += bridges[edge.id]!;
  }
  const cap = (id: number): number => {
    const built = bridges[id]!;
    if (built === 0 && graph.crossings[id]!.some((other) => bridges[other]! > 0)) return 0;
    const edge = graph.edges[id]!;
    const roomA = values[edge.a]! - (carried[edge.a]! - built);
    const roomB = values[edge.b]! - (carried[edge.b]! - built);
    return Math.max(built, Math.min(MAX_BRIDGES_PER_PAIR, roomA, roomB));
  };
  for (let island = 0; island < islandCount; island++) {
    if (++work > ctx.limit) {
      ctx.aborted = true;
      return null;
    }
    const edges = graph.islandEdges[island]!;
    const caps = edges.map(cap);
    const total = caps.reduce((sum, c) => sum + c, 0);
    for (let j = 0; j < edges.length; j++) {
      const need = values[island]! - (total - caps[j]!);
      if (need > bridges[edges[j]!]! && need <= caps[j]!) {
        return { edge: edges[j]!, atLeast: need, island };
      }
    }
  }
  return null;
}

/**
 * The hint of §9.
 *
 * 1. Any edge with more bridges than the answer is named: with one answer,
 *    a board over it on any edge cannot be finished, and a board at or under
 *    it everywhere always can — so this is exactly "does the board contradict
 *    the answer", with no search.
 * 2. Otherwise a bridge the board proves is shown: "these two islands need
 *    at least n bridges". It is proven from the board, not read off the
 *    answer.
 *    a. First, one the player can check at a single island
 *       (`evidentRise`), named with that island.
 *    b. When no island shows one, the techniques run from the player's
 *       bridges, read as lower bounds, and stop at the first rise past what
 *       is built. Its reason is a chain — an upper bound found by T3, T4 or
 *       another island's count — that no single island shows, so no island
 *       is named.
 *
 * Null when nothing is wrong and the techniques found nothing within the
 * work limit — the hint then says so, and shows no guess.
 */
export function findHint(
  layout: Layout,
  answer: Bridges,
  bridges: Bridges,
  limit: number = TECHNIQUE_WORK_LIMIT,
  graph: Graph = buildGraph(layout),
): Hint | null {
  for (let id = 0; id < bridges.length; id++) {
    if (bridges[id]! > answer[id]!) {
      return { kind: 'wrong', edge: id, count: bridges[id]!, answer: answer[id]! };
    }
  }
  const ctx = createCtx(graph, limit);
  const evident = evidentRise(ctx, bridges);
  if (evident !== null) return { kind: 'step', ...evident, technique: 'count' };
  if (ctx.aborted) return null;
  const dom = domainsFrom(ctx, bridges);
  if (dom === null) return null;
  // The first rise is all the hint shows, so the run stops there: the domains
  // start at what is built and only narrow, so every rise is past it.
  const log: SolveEvent[] = [];
  ctx.log = log;
  ctx.stopAtFirstRise = true;
  runSolve(ctx, dom, 3);
  const event = log[0];
  if (event === undefined || event.atLeast <= bridges[event.edge]!) return null;
  return {
    kind: 'step',
    edge: event.edge,
    atLeast: event.atLeast,
    technique: event.technique,
    island: -1,
  };
}
