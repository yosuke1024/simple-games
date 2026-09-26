/**
 * The two solvers of docs/SHAPE_REGIONS_RULES.md §7 and §8.
 *
 * `countSolutions` is the search that gates generation: it counts the ways
 * the clues can be satisfied, stopping at two, and is what "unique" means in
 * this game. It propagates T1–T3 at every node and branches on the region
 * with the fewest placements left — the techniques are sound, so a branch
 * loses no solution by applying them, and the count stays exact.
 *
 * `solve` / `findHint` is the human-technique solver — four techniques, each
 * sound, cheapest first — shared by the three callers that must agree: the
 * generator only ships a puzzle graded by it (§8), `guarantee.test.ts`
 * re-checks that grade on every walked seed, and the Hint hands the player
 * the next step it would take (§6). One implementation means the promise,
 * the check and the help cannot drift apart — and the counter above runs on
 * the same implementation, so "unique" and "solvable" are read the same way.
 *
 * Both count their work in `solverWork` — placements checked against the
 * board plus search nodes — because that is the number the generation budget
 * is stated in (§8): the same seed gives the same count on any machine.
 */
import { initialAssignment } from './engine';
import {
  EMPTY_MASK,
  enumeratePlacements,
  maskCells,
  maskContains,
  maskHas,
  maskIntersect,
  maskIsEmpty,
  maskOf,
  maskUnion,
  maskWithout,
  masksOverlap,
  type Mask,
  type Placement,
} from './placements';
import { UNASSIGNED, type Assignment, type Layout } from './types';

let work = 0;

/** Placements checked plus search nodes since the last reset (§8). */
export const solverWork = {
  read: (): number => work,
  reset: (): void => {
    work = 0;
  },
};

/** The size of a full placement table — what enumerating it is charged as. */
const tableSize = (base: readonly (readonly Placement[])[]): number =>
  base.reduce((sum, list) => sum + list.length, 0);

// ---------- state ----------

interface State {
  readonly layout: Layout;
  readonly cellCount: number;
  /** Region per cell, or UNASSIGNED. */
  fixed: Int8Array;
  /** Cells fixed to each region. */
  regionMask: Mask[];
  /** Every fixed cell. */
  fixedMask: Mask;
  /**
   * The candidate placements of each region (§7) as of the last refresh —
   * consistent with `fixed` then, minus T4's exclusions. Fixing a cell can
   * only remove candidates, so a refresh filters this list, never the table.
   */
  candidates: Placement[][];
  /** The union of each region's candidates, as of the same refresh. */
  unions: Mask[];
  /** What `fixedMask` was when `candidates` was last brought up to date. */
  refreshedMask: Mask;
  /** Placements T4 has ruled out, per region, by `Placement.id` (§7). */
  readonly excluded: Uint8Array[];
}

function createState(layout: Layout, assignment: Assignment, base: readonly Placement[][]): State {
  const cellCount = layout.width * layout.height;
  const fixed = new Int8Array(cellCount).fill(UNASSIGNED);
  const regionCells: number[][] = layout.clues.map(() => []);
  const fixedCells: number[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const region = assignment[cell] ?? UNASSIGNED;
    if (region === UNASSIGNED) continue;
    fixed[cell] = region;
    regionCells[region]?.push(cell);
    fixedCells.push(cell);
  }
  const state: State = {
    layout,
    cellCount,
    fixed,
    regionMask: regionCells.map(maskOf),
    fixedMask: maskOf(fixedCells),
    candidates: base.map((list) => [...list]),
    unions: base.map(() => EMPTY_MASK),
    // Nothing has been filtered yet: the first refresh reads every list.
    refreshedMask: { lo: ~0, hi: ~0 },
    excluded: base.map((list) => new Uint8Array(list.length)),
  };
  return state;
}

/** A copy that shares the exclusions — enough for a hypothesis or a branch. */
function cloneState(state: State): State {
  return {
    ...state,
    fixed: new Int8Array(state.fixed),
    regionMask: [...state.regionMask],
    candidates: [...state.candidates],
    unions: [...state.unions],
  };
}

/** Fixes a cell to a region. False when it is already fixed elsewhere. */
function fix(state: State, cell: number, region: number): boolean {
  const current = state.fixed[cell]!;
  if (current === region) return true;
  if (current !== UNASSIGNED) return false;
  state.fixed[cell] = region;
  const bit = maskOf([cell]);
  state.regionMask[region] = maskUnion(state.regionMask[region]!, bit);
  state.fixedMask = maskUnion(state.fixedMask, bit);
  return true;
}

/**
 * Commits a region to lying exactly one way: its cells are fixed and its
 * list shrinks to that one placement. Fixing the cells alone is not the same
 * thing — a size-free clue keeps every larger placement that contains them,
 * so a branch or a hypothesis built on cells alone would never settle.
 */
function commit(state: State, region: number, placement: Placement): boolean {
  for (const cell of placement.cells) if (!fix(state, cell, region)) return false;
  state.candidates[region] = [placement];
  state.unions[region] = placement.mask;
  return true;
}

/** Filters one region's list against the board as it stands now. */
function refilter(state: State, region: number): boolean {
  const list = state.candidates[region]!;
  const own = state.regionMask[region]!;
  const others = maskWithout(state.fixedMask, own);
  const excluded = state.excluded[region]!;
  work += list.length;
  const kept: Placement[] = [];
  let union = EMPTY_MASK;
  for (const placement of list) {
    if (excluded[placement.id] !== 0) continue;
    if (masksOverlap(placement.mask, others)) continue;
    if (!maskContains(placement.mask, own)) continue;
    kept.push(placement);
    union = maskUnion(union, placement.mask);
  }
  state.candidates[region] = kept;
  state.unions[region] = union;
  return kept.length > 0;
}

/**
 * Brings every region's candidates up to date with `fixed` (§7): no cell
 * fixed to another region, every cell fixed to this one, and not ruled out.
 * Only regions a newly fixed cell can have touched are re-read — the ones
 * that gained a cell of their own, and the ones some candidate reached into
 * the new cells. False when some region has nothing left — a contradiction.
 */
function refresh(state: State): boolean {
  const delta = maskWithout(state.fixedMask, state.refreshedMask);
  const first = state.refreshedMask.lo === ~0;
  state.refreshedMask = state.fixedMask;
  const regions = state.layout.clues.length;
  let alive = true;
  for (let region = 0; region < regions; region++) {
    const touched =
      first ||
      masksOverlap(state.regionMask[region]!, delta) ||
      masksOverlap(state.unions[region]!, delta);
    if (touched) {
      if (!refilter(state, region)) alive = false;
    } else if (state.candidates[region]!.length === 0) {
      alive = false;
    }
  }
  return alive;
}

// ---------- techniques (§7) ----------

export type Technique = 'forced-cell' | 'sole-placement' | 'common-cells';

/** One deduction, with everything the Hint needs to explain it (§6). */
export interface SolveStep {
  readonly technique: Technique;
  readonly region: number;
  /** The cells this step fixes to `region`. */
  readonly cells: readonly number[];
  /** The union of the placements the deduction was read off — shown faintly. */
  readonly reason: readonly number[];
}

interface Sweep {
  /** True when something was fixed ('apply') or a step was found ('first'). */
  readonly progress: boolean;
  readonly contradiction: boolean;
  /** The step found, in 'first' mode. */
  readonly step: SolveStep | null;
}

const unionOf = (placements: readonly Placement[]): Mask =>
  placements.reduce((acc, placement) => maskUnion(acc, placement.mask), EMPTY_MASK);

const STUCK: Sweep = { progress: false, contradiction: false, step: null };
const CONTRADICTION: Sweep = { progress: false, contradiction: true, step: null };

/**
 * One round of T1–T3 (§7), cheapest first: T1 over every cell, then T2 and
 * T3 over every region; a more expensive technique is consulted only when
 * the cheaper one found nothing.
 *
 * In 'apply' mode the round writes its deductions straight to the board and
 * builds nothing — the shape the solvers run millions of times. In 'first'
 * mode it stops at the first deduction and returns it with its reason, which
 * is what the Hint wants. One function, two modes, so the help and the
 * guarantee cannot read the techniques differently.
 *
 * Applying inside the round is sound even though the lists it reads are then
 * a step stale: a stale list is a superset of the fresh one, and every
 * technique concludes less from a superset, never more.
 */
function sweep(state: State, mode: 'apply' | 'first'): Sweep {
  if (!refresh(state)) return CONTRADICTION;
  const regions = state.layout.clues.length;
  const { candidates, unions } = state;
  let progress = false;

  // T1 — forced cell: only one region can still reach this cell.
  for (let cell = 0; cell < state.cellCount; cell++) {
    if (state.fixed[cell] !== UNASSIGNED) continue;
    let owner = -1;
    let count = 0;
    for (let region = 0; region < regions; region++) {
      if (maskHas(unions[region]!, cell)) {
        owner = region;
        if (++count > 1) break;
      }
    }
    if (count === 0) return CONTRADICTION;
    if (count !== 1) continue;
    if (mode === 'first') {
      const covering = candidates[owner]!.filter((placement) => maskHas(placement.mask, cell));
      return {
        progress: true,
        contradiction: false,
        step: {
          technique: 'forced-cell',
          region: owner,
          cells: [cell],
          reason: maskCells(unionOf(covering), state.cellCount),
        },
      };
    }
    fix(state, cell, owner);
    progress = true;
  }
  if (progress) return { progress, contradiction: false, step: null };

  // T2 — sole placement: one way left for the region to lie.
  for (let region = 0; region < regions; region++) {
    const list = candidates[region]!;
    if (list.length !== 1) continue;
    const only = list[0]!;
    const fresh = only.cells.filter((cell) => state.fixed[cell] === UNASSIGNED);
    if (fresh.length === 0) continue;
    if (mode === 'first') {
      return {
        progress: true,
        contradiction: false,
        step: { technique: 'sole-placement', region, cells: fresh, reason: [...only.cells] },
      };
    }
    for (const cell of fresh) if (!fix(state, cell, region)) return CONTRADICTION;
    progress = true;
  }
  if (progress) return { progress, contradiction: false, step: null };

  // T3 — common cells: in every way the region can lie.
  for (let region = 0; region < regions; region++) {
    const list = candidates[region]!;
    if (list.length < 2) continue;
    let common = list[0]!.mask;
    for (let i = 1; i < list.length; i++) common = maskIntersect(common, list[i]!.mask);
    if (maskIsEmpty(maskWithout(common, state.fixedMask))) continue;
    const fresh = maskCells(common, state.cellCount).filter(
      (cell) => state.fixed[cell] === UNASSIGNED,
    );
    if (mode === 'first') {
      return {
        progress: true,
        contradiction: false,
        step: {
          technique: 'common-cells',
          region,
          cells: fresh,
          reason: maskCells(unions[region]!, state.cellCount),
        },
      };
    }
    for (const cell of fresh) if (!fix(state, cell, region)) return CONTRADICTION;
    progress = true;
  }
  return progress ? { progress, contradiction: false, step: null } : STUCK;
}

const isComplete = (state: State): boolean => {
  for (let cell = 0; cell < state.cellCount; cell++) {
    if (state.fixed[cell] === UNASSIGNED) return false;
  }
  return true;
};

/** T1–T3 to a fixpoint. False on a contradiction. */
function propagateBasic(state: State): boolean {
  for (;;) {
    const round = sweep(state, 'apply');
    if (round.contradiction) return false;
    if (!round.progress) return refresh(state);
  }
}

/**
 * T4 — depth-one hypothesis (§7). Every candidate of every region is assumed
 * in turn; one whose T1–T3 consequences contradict is ruled out for good,
 * which is sound because a fixed cell never comes unfixed. Returns how many
 * placements were ruled out this round.
 */
function hypothesise(state: State): number {
  if (!refresh(state)) return 0;
  let eliminated = 0;
  const regions = state.layout.clues.length;
  for (let region = 0; region < regions; region++) {
    const own = state.regionMask[region]!;
    const excluded = state.excluded[region]!;
    let dropped = 0;
    // A snapshot: exclusions found in this loop are written back below.
    for (const placement of [...state.candidates[region]!]) {
      // Already lying exactly this way: nothing to assume.
      if (maskContains(own, placement.mask)) continue;
      work++;
      const trial = cloneState(state);
      if (!commit(trial, region, placement) || !propagateBasic(trial)) {
        excluded[placement.id] = 1;
        dropped++;
      }
    }
    if (dropped > 0) {
      eliminated += dropped;
      state.candidates[region] = state.candidates[region]!.filter(
        (placement) => excluded[placement.id] === 0,
      );
      state.unions[region] = unionOf(state.candidates[region]!);
    }
  }
  return eliminated;
}

// ---------- counting (§8) ----------

/**
 * Counts the solutions of a layout, up to `limit` (2 is enough to say
 * "unique"). Each node propagates T1–T3 and branches on the region with the
 * fewest placements left; a contradiction ends the branch. Every placement
 * contains its own clue and no other, so the clue cells need no seeding.
 */
export function countSolutions(layout: Layout, limit = 2): number {
  const base = enumeratePlacements(layout);
  work += tableSize(base);
  const regions = layout.clues.length;
  let found = 0;

  const search = (state: State): void => {
    work++;
    if (found >= limit) return;
    if (!propagateBasic(state)) return;
    if (isComplete(state)) {
      found++;
      return;
    }
    // The tightest region that is not yet settled. After propagation every
    // region has at least two candidates or is already lying one way.
    let best = -1;
    for (let region = 0; region < regions; region++) {
      const count = state.candidates[region]!.length;
      if (count < 2) continue;
      if (best === -1 || count < state.candidates[best]!.length) best = region;
    }
    if (best === -1) return;
    for (const placement of state.candidates[best]!) {
      const branch = cloneState(state);
      if (commit(branch, best, placement)) search(branch);
      if (found >= limit) return;
    }
  };

  search(createState(layout, initialAssignment(layout), base));
  return found;
}

// ---------- the technique solver's doors (§6, §7) ----------

export interface SolveResult {
  /** Region per cell after the techniques ran out, UNASSIGNED where they did. */
  readonly fixed: readonly number[];
  /** Every cell determined: the puzzle needs no guessing and is unique (§7). */
  readonly solved: boolean;
  /** The board cannot be finished from here. Only the player's own board reaches this. */
  readonly contradiction: boolean;
  /** True when T4 ruled at least one placement out along the way. */
  readonly usedHypothesis: boolean;
}

/**
 * Runs the techniques to a fixpoint from an assignment (the bare clues during
 * generation, the player's board for a hint). `allowHypothesis` is the tier
 * dial of §7: false is the Easy / Medium set, true is Hard's.
 */
export function solve(
  layout: Layout,
  assignment: Assignment,
  allowHypothesis: boolean,
  base: readonly Placement[][] = enumeratePlacements(layout),
): SolveResult {
  const state = createState(layout, assignment, base);
  let usedHypothesis = false;
  const finish = (solved: boolean, contradiction: boolean): SolveResult => ({
    fixed: Array.from(state.fixed),
    solved,
    contradiction,
    usedHypothesis,
  });

  for (;;) {
    if (!propagateBasic(state)) return finish(false, true);
    if (isComplete(state)) return finish(true, false);
    if (!allowHypothesis) return finish(false, false);
    const eliminated = hypothesise(state);
    if (eliminated === 0) return finish(false, false);
    usedHypothesis = true;
  }
}

/** Whether T1–T3 alone finish a layout from its bare clues — the Easy / Medium gate (§7). */
export function solvableBasic(layout: Layout): boolean {
  const base = enumeratePlacements(layout);
  work += tableSize(base);
  return solve(layout, initialAssignment(layout), false, base).solved;
}

export type Grade = 'basic' | 'advanced' | 'unsolved';

/**
 * The tier a layout belongs to by technique (§7): `basic` when T1–T3 settle
 * it, `advanced` when T4 is needed and suffices, `unsolved` otherwise.
 */
export function gradeLayout(layout: Layout): Grade {
  const base = enumeratePlacements(layout);
  work += tableSize(base);
  const start = initialAssignment(layout);
  if (solve(layout, start, false, base).solved) return 'basic';
  return solve(layout, start, true, base).solved ? 'advanced' : 'unsolved';
}

/**
 * The next thing the techniques settle on this board (§6) — T1–T3 first,
 * and if they are silent, the first T1–T3 step that T4's eliminations open
 * up. Null when nothing can be said.
 */
export function findStep(layout: Layout, assignment: Assignment): SolveStep | null {
  const state = createState(layout, assignment, enumeratePlacements(layout));
  for (;;) {
    const round = sweep(state, 'first');
    if (round.contradiction) return null;
    if (round.step !== null) return round.step;
    if (isComplete(state)) return null;
    if (hypothesise(state) === 0) return null;
  }
}

export type Hint =
  /** A region holding a cell the answer gives to another region (§6, step 1). */
  | { readonly kind: 'wrong'; readonly region: number; readonly cells: readonly number[] }
  /** The next deduction (§6, step 2). */
  | { readonly kind: 'step'; readonly step: SolveStep };

/**
 * The hint of §6: the first region that disagrees with the solution, else the
 * next step the techniques can prove from the player's own board.
 */
export function findHint(
  layout: Layout,
  solution: readonly number[],
  assignment: Assignment,
): Hint | null {
  for (let cell = 0; cell < assignment.length; cell++) {
    const region = assignment[cell]!;
    if (region === UNASSIGNED || solution[cell] === region) continue;
    const cells: number[] = [];
    for (let i = 0; i < assignment.length; i++) if (assignment[i] === region) cells.push(i);
    return { kind: 'wrong', region, cells };
  }
  const step = findStep(layout, assignment);
  return step === null ? null : { kind: 'step', step };
}

/** True when the assignment is a subset of the solution — nothing wrong yet. */
export function agreesWithSolution(solution: readonly number[], assignment: Assignment): boolean {
  return assignment.every((region, cell) => region === UNASSIGNED || region === solution[cell]);
}
