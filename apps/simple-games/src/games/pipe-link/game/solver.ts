/**
 * The technique solver and the solution counter (docs/PIPE_LINK_RULES.md §4).
 *
 * Every cell holds a domain: the set of orientations it may still take, as a
 * bit mask over orientation numbers (bit k = orientation k). Three sound
 * techniques narrow the domains — none ever removes an orientation that some
 * solved arrangement (board.ts `isSolved`) uses:
 *
 * - L1 interlock: no pipe into the board's edge; across each edge both sides
 *   agree on "pipe" / "no pipe" (arc consistency, to a fixpoint).
 * - L2 loops and isolation: put one orientation on one cell and look at that
 *   step and one hop further — each neighbour whose edge the hypothesis
 *   decides is narrowed, and its newly certain edges count — nothing beyond;
 *   reject it when it closes a loop, or leaves a group of surely-connected
 *   cells with no unknown edge out while the group is not the whole board.
 * - L3 one hypothesis: put one orientation on one cell, run L1 + L2 to a
 *   fixpoint; a contradiction removes it. Never nested.
 *
 * `solve` climbs the ladder (L1 to a fixpoint → every L2 elimination of one
 * sweep → the first L3 elimination → back to L1) and reports the highest
 * level that removed anything, plus the order cells became fixed (the Hint's
 * order — §6). `countSolutions` is a bounded depth-first count that uses L1 +
 * L2 as sound pruning and stops honestly at its node limit.
 *
 * Work is counted in units (§4「仕事量の単位」), never in wall-clock time.
 */
import type { Board } from './board';
import { isSolved, neighborOf } from './board';
import { opposite, orientationMasks, TILE_TYPES, type TileType } from './tiles';

/**
 * Node limit of one solution count (§4): the low end of the plan's
 * 5,000–20,000. The most any count took over the walked boards and the
 * census is 7 nodes (§14), so the limit only bounds the worst case.
 */
export const SEARCH_NODE_LIMIT = 5_000;
/**
 * Work limit of one technique-solver run (§4): about 13 times the heaviest
 * run measured (15,332 work, a stuck 7×7 tree of the census — §14). Shipped
 * boards, which are what the Hint solves, measured at most 465.
 */
export const TECHNIQUE_WORK_LIMIT = 200_000;

export type SolveStatus = 'solved' | 'stuck' | 'contradiction' | 'aborted';
export type TechniqueLevel = 1 | 2 | 3;

export interface SolveOptions {
  /** The highest technique allowed (default 3). */
  readonly maxLevel?: TechniqueLevel;
  /** Work units before giving up with `aborted` (default `TECHNIQUE_WORK_LIMIT`). */
  readonly workLimit?: number;
  /** Starting domains (default: every orientation of every cell — the types-only board). */
  readonly domains?: readonly number[];
}

export interface SolveResult {
  readonly status: SolveStatus;
  /** The highest level that removed anything (0 when nothing was removed). */
  readonly level: 0 | TechniqueLevel;
  /** The domains when the run stopped (bit k = orientation k still possible). */
  readonly domains: readonly number[];
  /** Cells in the order their domain became a single orientation; same moment → row-major. */
  readonly order: readonly number[];
  /** Per cell: the highest level used up to the moment it became fixed (0 = never fixed). */
  readonly stageOf: readonly number[];
  /** How many L2 sweeps removed something. */
  readonly l2Rounds: number;
  /** How many orientations L3 removed. */
  readonly l3: number;
  readonly work: number;
}

export interface CountOptions {
  /** Stop after this many solutions (default 2). */
  readonly limit?: number;
  /** Search nodes before stopping with `complete: false` (default `SEARCH_NODE_LIMIT`). */
  readonly nodeLimit?: number;
  /** Optional work budget (a generator's remaining budget); exhausting it also means `complete: false`. */
  readonly workLimit?: number;
}

export interface CountResult {
  /** Solutions found — exact only when `complete`; otherwise a lower bound. */
  readonly count: number;
  /** True when the search finished (or stopped at `limit` solutions) within its bounds. */
  readonly complete: boolean;
  readonly nodes: number;
  readonly work: number;
  /** The solutions found, as orientation arrays, in search order. */
  readonly solutions: readonly (readonly number[])[];
}

/** Only a finished count of exactly one proves uniqueness (§4). */
export function isUnique(result: CountResult): boolean {
  return result.complete && result.count === 1;
}

// ---------------------------------------------------------------------------
// Per-type tables over all 16 domain masks.

interface TypeTables {
  readonly masks: readonly number[];
  readonly full: number;
  /** Pipes every orientation in the domain has (index = domain). */
  readonly sure: Uint8Array;
  /** Pipes some orientation in the domain has. */
  readonly maybe: Uint8Array;
  /** Orientations with / without a pipe toward dir (index = dir). */
  readonly withPipe: readonly number[];
  readonly withoutPipe: readonly number[];
}

function buildTables(type: TileType): TypeTables {
  const masks = orientationMasks(type);
  const full = (1 << masks.length) - 1;
  const sure = new Uint8Array(16);
  const maybe = new Uint8Array(16);
  for (let domain = 0; domain < 16; domain++) {
    let and = 0b1111;
    let or = 0;
    for (let k = 0; k < masks.length; k++) {
      if (domain & (1 << k)) {
        and &= masks[k]!;
        or |= masks[k]!;
      }
    }
    sure[domain] = domain & full ? and : 0;
    maybe[domain] = or;
  }
  const withPipe: number[] = [];
  const withoutPipe: number[] = [];
  for (let dir = 0; dir < 4; dir++) {
    let w = 0;
    for (let k = 0; k < masks.length; k++) if (masks[k]! & (1 << dir)) w |= 1 << k;
    withPipe.push(w);
    withoutPipe.push(full & ~w);
  }
  return { masks, full, sure, maybe, withPipe, withoutPipe };
}

const TABLES: Readonly<Record<TileType, TypeTables>> = (() => {
  const out = {} as Record<TileType, TypeTables>;
  for (const type of TILE_TYPES) out[type] = buildTables(type);
  return out;
})();

function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m !== 0; m &= m - 1) n++;
  return n;
}

function lowestBit(mask: number): number {
  return 31 - Math.clz32(mask & -mask);
}

// ---------------------------------------------------------------------------
// The shared propagation engine.

/** Thrown inside the engine when the work budget runs out; caught at the public entry points. */
class OutOfWork {}

interface Engine {
  readonly n: number;
  readonly tables: readonly TypeTables[];
  /** neighbors[i * 4 + dir] = neighbouring cell or -1. */
  readonly neighbors: Int32Array;
  readonly limit: number;
  work: number;
}

function createEngine(board: Board, limit: number): Engine {
  const n = board.types.length;
  const neighbors = new Int32Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let dir = 0; dir < 4; dir++) neighbors[i * 4 + dir] = neighborOf(board, i, dir);
  }
  return { n, tables: board.types.map((t) => TABLES[t]), neighbors, limit, work: 0 };
}

function spend(engine: Engine, units: number): void {
  engine.work += units;
  if (engine.work > engine.limit) throw new OutOfWork();
}

/** Full domains with every pipe into the board's edge removed. */
function initialDomains(engine: Engine): Uint8Array {
  const dom = new Uint8Array(engine.n);
  for (let i = 0; i < engine.n; i++) {
    const t = engine.tables[i]!;
    let d = t.full;
    for (let dir = 0; dir < 4; dir++) {
      if (engine.neighbors[i * 4 + dir]! < 0) d &= t.withoutPipe[dir]!;
    }
    dom[i] = d;
  }
  return dom;
}

/**
 * L1 to a fixpoint, starting from the cells in `queue`. Returns false on a
 * contradiction (an empty domain). Edge-of-board pipes are removed here too,
 * so arbitrary starting domains are handled.
 */
function propagateL1(engine: Engine, dom: Uint8Array, queue: number[]): boolean {
  const { neighbors, tables } = engine;
  const queued = new Uint8Array(engine.n);
  for (const i of queue) queued[i] = 1;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    queued[i] = 0;
    spend(engine, 1);
    const ti = tables[i]!;
    let di = dom[i]!;
    for (let dir = 0; dir < 4; dir++) {
      if (neighbors[i * 4 + dir]! < 0) di &= ti.withoutPipe[dir]!;
    }
    if (di === 0) return false;
    dom[i] = di;
    const sure = ti.sure[di]!;
    const maybe = ti.maybe[di]!;
    for (let dir = 0; dir < 4; dir++) {
      const j = neighbors[i * 4 + dir]!;
      if (j < 0) continue;
      const tj = tables[j]!;
      const back = opposite(dir);
      const dj = dom[j]!;
      let next = dj;
      if (sure & (1 << dir)) next &= tj.withPipe[back]!;
      if (!(maybe & (1 << dir))) next &= tj.withoutPipe[back]!;
      if (next !== dj) {
        if (next === 0) return false;
        dom[j] = next;
        if (!queued[j]) {
          queued[j] = 1;
          queue.push(j);
        }
      }
    }
  }
  return true;
}

/** Edge state seen from cell i toward dir: 1 = surely a pipe, 0 = surely none, -1 = unknown. */
function edgeState(engine: Engine, dom: Uint8Array, i: number, dir: number): number {
  const t = engine.tables[i]!;
  const d = dom[i]!;
  if (t.sure[d]! & (1 << dir)) return 1;
  if (!(t.maybe[d]! & (1 << dir))) return 0;
  return -1;
}

interface Groups {
  readonly comp: Int32Array;
  readonly size: Int32Array;
  /** Unknown edge-ends touching the group (an unknown edge inside one group counts twice). */
  readonly exits: Int32Array;
}

/**
 * Groups of cells joined by sure pipes, with their exits. Returns null on a
 * global contradiction: a loop of sure pipes, or a closed group (no exit)
 * that is not the whole board. Assumes `dom` is at an L1 fixpoint.
 */
function buildGroups(engine: Engine, dom: Uint8Array): Groups | null {
  const { n, neighbors } = engine;
  spend(engine, n);
  const comp = new Int32Array(n).fill(-1);
  const size = new Int32Array(n);
  const exits = new Int32Array(n);
  const stack: number[] = [];
  let groups = 0;
  for (let start = 0; start < n; start++) {
    if (comp[start] !== -1) continue;
    const id = groups++;
    comp[start] = id;
    stack.push(start);
    let cells = 0;
    let sureEnds = 0;
    let unknown = 0;
    while (stack.length > 0) {
      const i = stack.pop()!;
      cells++;
      for (let dir = 0; dir < 4; dir++) {
        const j = neighbors[i * 4 + dir]!;
        if (j < 0) continue;
        const s = edgeState(engine, dom, i, dir);
        if (s === -1) unknown++;
        else if (s === 1) {
          sureEnds++;
          if (comp[j] === -1) {
            comp[j] = id;
            stack.push(j);
          }
        }
      }
    }
    // A tree on `cells` cells has cells − 1 edges (2 ends each); more is a loop.
    if (sureEnds / 2 > cells - 1) return null;
    if (unknown === 0 && cells < n) return null;
    size[id] = cells;
    exits[id] = unknown;
  }
  return { comp, size, exits };
}

/**
 * Why L2 rejected an orientation (§4). 'interlock' (a neighbour left with no
 * orientation) cannot arise at an L1 fixpoint, where every orientation has
 * support across each edge; it is kept so the test stays sound from any state.
 */
export type L2Reason = 'loop' | 'closed-group' | 'interlock';

/** One L2 elimination: `cell` cannot take `orientation`. */
export interface L2Elimination {
  readonly cell: number;
  readonly orientation: number;
  readonly reason: L2Reason;
}

/**
 * Tests one hypothesis "cell t takes orientation k" (§4 L2). It decides t's
 * unknown edges and, one hop further, what each neighbour whose edge it
 * decided is then sure of on its other edges — nothing beyond. Returns the
 * reason to reject, or null. Sound: every edge it decides is forced by the
 * hypothesis.
 */
function testHypothesis(
  engine: Engine,
  dom: Uint8Array,
  groups: Groups,
  t: number,
  k: number,
  scratch: HypothesisScratch,
): L2Reason | null {
  const { neighbors, tables, n } = engine;
  const { comp, size, exits } = groups;
  const ends = scratch.ends;
  ends.length = 0;
  const mask = tables[t]!.masks[k]!;
  for (let dir = 0; dir < 4; dir++) {
    const j = neighbors[t * 4 + dir]!;
    if (j < 0 || edgeState(engine, dom, t, dir) !== -1) continue;
    const open = (mask & (1 << dir)) !== 0;
    ends.push(t, j, open ? 1 : 0);
    const tj = tables[j]!;
    const back = opposite(dir);
    const dj = dom[j]! & (open ? tj.withPipe[back]! : tj.withoutPipe[back]!);
    if (dj === 0) return 'interlock';
    for (let dir2 = 0; dir2 < 4; dir2++) {
      if (dir2 === back) continue;
      const w = neighbors[j * 4 + dir2]!;
      if (w < 0 || edgeState(engine, dom, j, dir2) !== -1) continue;
      if (tj.sure[dj]! & (1 << dir2)) ends.push(j, w, 1);
      else if (!(tj.maybe[dj]! & (1 << dir2))) ends.push(j, w, 0);
    }
  }
  // A tiny union-find over the groups this hypothesis touches.
  const ids = scratch.ids;
  const parent = scratch.parent;
  const delta = scratch.delta;
  ids.length = 0;
  parent.length = 0;
  delta.length = 0;
  const local = (cell: number): number => {
    const g = comp[cell]!;
    let at = ids.indexOf(g);
    if (at < 0) {
      at = ids.length;
      ids.push(g);
      parent.push(at);
      delta.push(0);
    }
    return at;
  };
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x]!;
    return x;
  };
  local(t);
  for (let e = 0; e < ends.length; e += 3) {
    const a = local(ends[e]!);
    const b = local(ends[e + 1]!);
    delta[a] = delta[a]! - 1;
    delta[b] = delta[b]! - 1;
    if (ends[e + 2] === 1) {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return 'loop';
      parent[ra] = rb;
    }
  }
  // Isolation: a touched group (after merging) with no exit left that is not the whole board.
  for (let root = 0; root < ids.length; root++) {
    if (find(root) !== root) continue;
    let cells = 0;
    let left = 0;
    for (let x = 0; x < ids.length; x++) {
      if (find(x) !== root) continue;
      cells += size[ids[x]!]!;
      left += exits[ids[x]!]! + delta[x]!;
    }
    if (left === 0 && cells < n) return 'closed-group';
  }
  return null;
}

interface HypothesisScratch {
  readonly ends: number[];
  readonly ids: number[];
  readonly parent: number[];
  readonly delta: number[];
}

/**
 * One L2 sweep (§4): tests every orientation of every undecided cell.
 * Returns the eliminations, or null on a global contradiction. All
 * eliminations are proved from the same state, so applying them together is
 * sound.
 */
function sweepL2(engine: Engine, dom: Uint8Array): L2Elimination[] | null {
  const groups = buildGroups(engine, dom);
  if (groups === null) return null;
  const scratch: HypothesisScratch = { ends: [], ids: [], parent: [], delta: [] };
  const out: L2Elimination[] = [];
  for (let t = 0; t < engine.n; t++) {
    const d = dom[t]!;
    if (popcount(d) < 2) continue;
    for (let k = 0; k < 4; k++) {
      if (!(d & (1 << k))) continue;
      spend(engine, 1);
      const reason = testHypothesis(engine, dom, groups, t, k, scratch);
      if (reason !== null) out.push({ cell: t, orientation: k, reason });
    }
  }
  return out;
}

/**
 * L1, then (when allowed) L2 sweeps, to a joint fixpoint. Returns false on a
 * contradiction. `onRound` hears each L2 sweep that removed something.
 */
function fixpoint(
  engine: Engine,
  dom: Uint8Array,
  queue: number[],
  useL2: boolean,
  onRound?: () => void,
): boolean {
  let pending = queue;
  for (;;) {
    if (!propagateL1(engine, dom, pending)) return false;
    if (!useL2) return true;
    const elim = sweepL2(engine, dom);
    if (elim === null) return false;
    if (elim.length === 0) return true;
    pending = [];
    for (const { cell, orientation } of elim) {
      const next = dom[cell]! & ~(1 << orientation);
      if (next === 0) return false;
      dom[cell] = next;
      if (!pending.includes(cell)) pending.push(cell);
    }
    onRound?.();
  }
}

function allFixed(dom: Uint8Array): boolean {
  for (let i = 0; i < dom.length; i++) if (popcount(dom[i]!) !== 1) return false;
  return true;
}

function orientationsOf(dom: Uint8Array): number[] {
  return Array.from(dom, (d) => lowestBit(d));
}

function startingDomains(engine: Engine, given: readonly number[] | undefined): Uint8Array {
  if (given === undefined) return initialDomains(engine);
  if (given.length !== engine.n) throw new RangeError('one domain per cell');
  return Uint8Array.from(given, (d, i) => d & engine.tables[i]!.full);
}

function allCells(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * L1 to a fixpoint from the given domains, then one L2 sweep — the
 * eliminations L2 proves from that state, or null on a contradiction. For
 * tests and explanations; `solve` runs the same code.
 */
export function l2Eliminations(board: Board, domains: readonly number[]): L2Elimination[] | null {
  const engine = createEngine(board, Number.POSITIVE_INFINITY);
  const dom = startingDomains(engine, domains);
  if (!propagateL1(engine, dom, allCells(engine.n))) return null;
  return sweepL2(engine, dom);
}

/** L1 alone to a fixpoint from the given domains (default: the types-only board), or null on a contradiction. */
export function l1Fixpoint(board: Board, domains?: readonly number[]): number[] | null {
  const engine = createEngine(board, Number.POSITIVE_INFINITY);
  const dom = startingDomains(engine, domains);
  return propagateL1(engine, dom, allCells(engine.n)) ? Array.from(dom) : null;
}

// ---------------------------------------------------------------------------
// The technique ladder.

/** Runs the technique ladder from the types-only board (or the given domains). Deterministic. */
export function solve(board: Board, options: SolveOptions = {}): SolveResult {
  const maxLevel = options.maxLevel ?? 3;
  const engine = createEngine(board, options.workLimit ?? TECHNIQUE_WORK_LIMIT);
  const n = engine.n;
  const order: number[] = [];
  const stageOf = new Array<number>(n).fill(0);
  let level: 0 | TechniqueLevel = 0;
  let l2Rounds = 0;
  let l3 = 0;
  let dom = new Uint8Array(n);

  const record = (): void => {
    for (let i = 0; i < n; i++) {
      if (stageOf[i] === 0 && popcount(dom[i]!) === 1) {
        stageOf[i] = Math.max(level, 1);
        order.push(i);
      }
    }
  };
  const result = (status: SolveStatus): SolveResult => ({
    status,
    level,
    domains: Array.from(dom),
    order,
    stageOf,
    l2Rounds,
    l3,
    work: engine.work,
  });

  try {
    const full = startingDomains(engine, options.domains);
    dom = Uint8Array.from(full);
    if (!propagateL1(engine, dom, allCells(n))) return result('contradiction');
    for (let i = 0; i < n; i++) if (dom[i] !== full[i]) level = 1;
    for (;;) {
      record();
      if (allFixed(dom)) {
        // L1 + L2 at a fixpoint with every cell fixed is a solution, but L2's
        // global checks may not have run yet (an L1-only ladder): confirm.
        return result(isSolved(board, orientationsOf(dom)) ? 'solved' : 'contradiction');
      }
      if (maxLevel >= 2) {
        const elim = sweepL2(engine, dom);
        if (elim === null) return result('contradiction');
        if (elim.length > 0) {
          const changed: number[] = [];
          for (const { cell, orientation } of elim) {
            dom[cell] = dom[cell]! & ~(1 << orientation);
            if (dom[cell] === 0) return result('contradiction');
            if (!changed.includes(cell)) changed.push(cell);
          }
          level = Math.max(level, 2) as TechniqueLevel;
          l2Rounds++;
          if (!propagateL1(engine, dom, changed)) return result('contradiction');
          continue;
        }
      }
      if (maxLevel >= 3) {
        const found = firstL3Elimination(engine, dom);
        if (found >= 0) {
          const cell = found >> 2;
          dom[cell] = dom[cell]! & ~(1 << (found & 3));
          level = 3;
          l3++;
          if (dom[cell] === 0 || !propagateL1(engine, dom, [cell])) {
            return result('contradiction');
          }
          continue;
        }
      }
      return result('stuck');
    }
  } catch (error) {
    if (error instanceof OutOfWork) return result('aborted');
    throw error;
  }
}

/** The first (row-major, then orientation) hypothesis that L1 + L2 refute, or -1. */
function firstL3Elimination(engine: Engine, dom: Uint8Array): number {
  for (let t = 0; t < engine.n; t++) {
    const d = dom[t]!;
    if (popcount(d) < 2) continue;
    for (let k = 0; k < 4; k++) {
      if (!(d & (1 << k))) continue;
      spend(engine, 1);
      const trial = Uint8Array.from(dom);
      trial[t] = 1 << k;
      if (!fixpoint(engine, trial, [t], true)) return t * 4 + k;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// The bounded solution count.

/**
 * Counts solutions up to `limit` by depth-first search with L1 + L2 pruning
 * (§4). Branches on the undecided cell with the smallest domain (ties:
 * row-major), orientations ascending; a leaf counts only when `isSolved`.
 * At the node limit or the work budget it returns `complete: false` and the
 * count is only a lower bound — never a claim of uniqueness or of none.
 */
export function countSolutions(board: Board, options: CountOptions = {}): CountResult {
  const limit = options.limit ?? 2;
  const nodeLimit = options.nodeLimit ?? SEARCH_NODE_LIMIT;
  const engine = createEngine(board, options.workLimit ?? Number.POSITIVE_INFINITY);
  const solutions: number[][] = [];
  let nodes = 0;
  let complete = true;

  const visit = (dom: Uint8Array, queue: number[]): boolean => {
    // Returns false to stop the whole search (limit reached or bound hit).
    if (nodes >= nodeLimit) {
      complete = false;
      return false;
    }
    nodes++;
    spend(engine, 1);
    if (!fixpoint(engine, dom, queue, true)) return true;
    let pick = -1;
    let best = 5;
    for (let i = 0; i < dom.length; i++) {
      const c = popcount(dom[i]!);
      if (c > 1 && c < best) {
        best = c;
        pick = i;
      }
    }
    if (pick < 0) {
      const orientations = orientationsOf(dom);
      if (isSolved(board, orientations)) {
        solutions.push(orientations);
        if (solutions.length >= limit) return false;
      }
      return true;
    }
    const d = dom[pick]!;
    for (let k = 0; k < 4; k++) {
      if (!(d & (1 << k))) continue;
      const child = Uint8Array.from(dom);
      child[pick] = 1 << k;
      if (!visit(child, [pick])) return false;
    }
    return true;
  };

  try {
    visit(initialDomains(engine), allCells(engine.n));
  } catch (error) {
    if (!(error instanceof OutOfWork)) throw error;
    complete = false;
  }
  return { count: solutions.length, complete, nodes, work: engine.work, solutions };
}
