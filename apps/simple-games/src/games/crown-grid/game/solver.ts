/**
 * The two solvers of docs/CROWN_GRID_RULES.md §7 and §8, and the hint of §6.
 *
 * The human-technique solver reasons over *candidates* — the cells that may
 * still hold a crown — with five techniques, cheapest first: single (T1),
 * confinement (T2), attack (T3), pair (T4) and a depth-one hypothesis (T5).
 * Every one of them is sound: it only ever concludes what every legal
 * completion of the board agrees on. So a board the techniques finish has
 * exactly one solution, and the tier a board is graded at (§7) is the
 * smallest technique set that finishes it.
 *
 * The counting solver is a plain row-by-row search that stops at the second
 * solution. It is the ground truth for uniqueness during generation (§8):
 * the technique solver is checked against it, never trusted instead of it.
 *
 * One implementation, three callers that must agree — the generator's grader,
 * the hint, and guarantee.test.ts (§7). Work is counted, never timed
 * (`solverWork`): the same seed always costs the same number of steps on any
 * machine, which is what makes the §8 budget assertable.
 */
import { colOf, crownIndices, findViolations, indexOf, neighbours, rowOf } from './engine';
import {
  CROSS,
  cellCount,
  type Difficulty,
  type House,
  type Mark,
  type Regions,
  type Size,
  type Solution,
} from './types';

/** The five techniques, cheapest first (§7). Names travel to nothing on screen. */
export type Technique = 'single' | 'confinement' | 'attack' | 'pair' | 'hypothesis';

/** The technique set of each tier (§7). Each is a prefix of the next. */
export const TIER_TECHNIQUES: Record<Difficulty, readonly Technique[]> = {
  easy: ['single', 'confinement'],
  medium: ['single', 'confinement', 'attack', 'pair'],
  hard: ['single', 'confinement', 'attack', 'pair', 'hypothesis'],
};

/** The techniques a hypothesis (T5) is allowed to propagate with (§7). */
const HYPOTHESIS_INNER: readonly Technique[] = ['single', 'confinement', 'attack'];

/** One conclusion, with everything the hint needs to explain it (§6). */
export interface SolveStep {
  /** `place`: the one cell is a crown. `eliminate`: none of the cells can be. */
  readonly kind: 'place' | 'eliminate';
  readonly cells: readonly number[];
  readonly technique: Technique;
  /** The house or houses the conclusion was read off — what a hint highlights. */
  readonly houses: readonly House[];
  /** The candidate cells that carry the proof — highlighted more strongly. */
  readonly support: readonly number[];
}

// ---------- work ----------

/**
 * Steps taken since the last reset — the unit generation is budgeted in (§8):
 * one per house a technique reads, per candidate the attack tests, per
 * hypothesis tried, and per node the counting solver visits. Nothing at
 * runtime reads it; it costs one integer increment per step.
 */
let steps = 0;

export const solverWork = {
  read: (): number => steps,
  reset: (): void => {
    steps = 0;
  },
};

// ---------- layout ----------

/**
 * The fixed geometry of one puzzle: its 3N houses (rows, then columns, then
 * regions), which houses each cell sits in, and which cells a crown on each
 * cell would empty. Built once per puzzle and shared by every state derived
 * from it, so the hot loops index arrays and never recompute adjacency.
 */
export interface Layout {
  readonly size: Size;
  readonly regions: Regions;
  /** House `h` → its cells. Rows are 0..N-1, columns N..2N-1, regions 2N..3N-1. */
  readonly houses: readonly (readonly number[])[];
  /** Cell → its row house, column house and region house. */
  readonly housesOf: readonly (readonly [number, number, number])[];
  /** Cell → every other cell a crown there removes (row, column, region, 8 around). */
  readonly attacked: readonly (readonly number[])[];
  /** `attackMask[i * N² + j]` is 1 when `j` is in `attacked[i]`. */
  readonly attackMask: Uint8Array;
}

export function buildLayout(regions: Regions, size: Size): Layout {
  const total = cellCount(size);
  const houses: number[][] = Array.from({ length: 3 * size }, () => []);
  const housesOf: [number, number, number][] = [];
  for (let index = 0; index < total; index++) {
    const row = rowOf(index, size);
    const col = colOf(index, size);
    const region = regions[index] ?? 0;
    houses[row]!.push(index);
    houses[size + col]!.push(index);
    houses[2 * size + region]!.push(index);
    housesOf.push([row, size + col, 2 * size + region]);
  }
  const attackMask = new Uint8Array(total * total);
  const attacked: number[][] = [];
  for (let index = 0; index < total; index++) {
    const list: number[] = [];
    const add = (other: number) => {
      if (other === index || attackMask[index * total + other] === 1) return;
      attackMask[index * total + other] = 1;
      list.push(other);
    };
    for (const house of housesOf[index]!) for (const other of houses[house]!) add(other);
    for (const other of neighbours(index, size)) add(other);
    attacked.push(list);
  }
  return { size, regions, houses, housesOf, attacked, attackMask };
}

/** A house id as the hint names it (§6). */
export function houseOf(layout: Layout, house: number): House {
  const { size } = layout;
  if (house < size) return { kind: 'row', index: house };
  if (house < 2 * size) return { kind: 'col', index: house - size };
  return { kind: 'region', index: house - 2 * size };
}

// ---------- state ----------

/** The candidate board the techniques reason over. Mutable, and cheap to clone. */
export interface SolveState {
  readonly layout: Layout;
  /** 1 where a crown may still go. */
  readonly cand: Uint8Array;
  /** 1 where a crown stands. */
  readonly crown: Uint8Array;
  /** Per house: 1 once it holds a crown. */
  readonly done: Uint8Array;
}

/**
 * Puts a crown down (§7): the cell stops being a candidate, so does everything
 * it attacks, and its three houses are done. Returns false — after doing all
 * of that anyway — when one of those houses already held a crown, which only
 * the player's own pieces can arrange (§5); the techniques never do.
 */
export function placeCrown(state: SolveState, index: number): boolean {
  const { layout, cand, crown, done } = state;
  let clean = true;
  crown[index] = 1;
  cand[index] = 0;
  for (const other of layout.attacked[index]!) cand[other] = 0;
  for (const house of layout.housesOf[index]!) {
    if (done[house] === 1) clean = false;
    done[house] = 1;
  }
  return clean;
}

/**
 * The state the player's crowns leave (§6): every cell a candidate, then each
 * crown placed. Nothing else on the player's board is read — not the ×s.
 */
export function initialState(layout: Layout, crowns: readonly number[] = []): SolveState {
  const total = cellCount(layout.size);
  const state: SolveState = {
    layout,
    cand: new Uint8Array(total).fill(1),
    crown: new Uint8Array(total),
    done: new Uint8Array(3 * layout.size),
  };
  for (const index of crowns) placeCrown(state, index);
  return state;
}

export function cloneState(state: SolveState): SolveState {
  return {
    layout: state.layout,
    cand: state.cand.slice(),
    crown: state.crown.slice(),
    done: state.done.slice(),
  };
}

/** How many crowns stand. N of them is the whole board (§2). */
export function crownCount(state: SolveState): number {
  let count = 0;
  for (let index = 0; index < state.crown.length; index++) count += state.crown[index]!;
  return count;
}

/** Row-major indices of the crowns standing. */
export function crownsOf(state: SolveState): number[] {
  const out: number[] = [];
  for (let index = 0; index < state.crown.length; index++) {
    if (state.crown[index] === 1) out.push(index);
  }
  return out;
}

export function applyStep(state: SolveState, step: SolveStep): void {
  if (step.kind === 'place') {
    placeCrown(state, step.cells[0]!);
  } else {
    for (const index of step.cells) state.cand[index] = 0;
  }
}

/** The candidates of every house, read once per sweep. */
function houseCandidates(state: SolveState): number[][] {
  return state.layout.houses.map((cells) => cells.filter((index) => state.cand[index] === 1));
}

/** Undone houses, fewest candidates first — the order a person reads them in. */
function housesByNeed(state: SolveState, hc: readonly (readonly number[])[]): number[] {
  const out: number[] = [];
  for (let house = 0; house < hc.length; house++) if (state.done[house] === 0) out.push(house);
  return out.sort((a, b) => hc[a]!.length - hc[b]!.length || a - b);
}

/** What one sweep of a technique concludes, or the house it found empty. */
export type Outcome = { readonly step: SolveStep } | { readonly contradiction: House };

// ---------- T1 single ----------

/**
 * Technique 1 (§7): a house with exactly one candidate puts its crown there.
 * A house with none — and no crown yet — is the contradiction every other
 * technique's reasoning bottoms out in, so this is also where it is caught.
 */
function single(state: SolveState, hc: readonly (readonly number[])[]): Outcome | null {
  const { layout } = state;
  for (let house = 0; house < hc.length; house++) {
    if (state.done[house] === 1) continue;
    steps++;
    const cands = hc[house]!;
    if (cands.length === 0) return { contradiction: houseOf(layout, house) };
    if (cands.length === 1) {
      return {
        step: {
          kind: 'place',
          cells: [cands[0]!],
          technique: 'single',
          houses: [houseOf(layout, house)],
          support: [cands[0]!],
        },
      };
    }
  }
  return null;
}

// ---------- T2 confinement ----------

const distinct = (values: readonly number[]): number[] => [...new Set(values)];

/**
 * Technique 2 (§7). A region whose candidates all lie in one row must put its
 * crown in that row, so the rest of the row is out; the same with a column.
 * Its dual: a row whose candidates all lie in one region must take that
 * region's crown, so the region's other candidates are out.
 */
function confinement(state: SolveState, hc: readonly (readonly number[])[]): Outcome | null {
  const { layout } = state;
  const { size, regions } = layout;

  const eliminate = (
    cells: number[],
    houses: readonly House[],
    support: readonly number[],
  ): Outcome | null =>
    cells.length === 0
      ? null
      : { step: { kind: 'eliminate', cells, technique: 'confinement', houses, support } };

  // Region confined to a line.
  for (let region = 0; region < size; region++) {
    const house = 2 * size + region;
    if (state.done[house] === 1) continue;
    steps++;
    const cands = hc[house]!;
    const rows = distinct(cands.map((index) => rowOf(index, size)));
    if (rows.length === 1) {
      const row = rows[0]!;
      const found = eliminate(
        hc[row]!.filter((index) => regions[index] !== region),
        [houseOf(layout, house), houseOf(layout, row)],
        cands,
      );
      if (found) return found;
    }
    const cols = distinct(cands.map((index) => colOf(index, size)));
    if (cols.length === 1) {
      const col = size + cols[0]!;
      const found = eliminate(
        hc[col]!.filter((index) => regions[index] !== region),
        [houseOf(layout, house), houseOf(layout, col)],
        cands,
      );
      if (found) return found;
    }
  }

  // Line confined to a region (the dual).
  for (let line = 0; line < 2 * size; line++) {
    if (state.done[line] === 1) continue;
    steps++;
    const cands = hc[line]!;
    const inRegions = distinct(cands.map((index) => regions[index] ?? 0));
    if (inRegions.length !== 1) continue;
    const region = 2 * size + inRegions[0]!;
    const onLine = new Set(cands);
    const found = eliminate(
      hc[region]!.filter((index) => !onLine.has(index)),
      [houseOf(layout, line), houseOf(layout, region)],
      cands,
    );
    if (found) return found;
  }
  return null;
}

// ---------- T3 attack ----------

/**
 * Technique 3 (§7): a candidate whose crown would empty some other house —
 * every candidate of that house is in its row, column, region or eight
 * neighbours — cannot be a crown. Read house by house, fewest candidates
 * first, and every attacker of one house is one step.
 */
function attack(state: SolveState, hc: readonly (readonly number[])[]): Outcome | null {
  const { layout, cand } = state;
  const total = cellCount(layout.size);
  const { attackMask, housesOf } = layout;
  for (const house of housesByNeed(state, hc)) {
    const cands = hc[house]!;
    const attackers: number[] = [];
    for (let index = 0; index < total; index++) {
      if (cand[index] === 0) continue;
      const own = housesOf[index]!;
      if (own[0] === house || own[1] === house || own[2] === house) continue;
      steps++;
      let empties = true;
      for (const target of cands) {
        if (attackMask[index * total + target] === 0) {
          empties = false;
          break;
        }
      }
      if (empties) attackers.push(index);
    }
    if (attackers.length > 0) {
      return {
        step: {
          kind: 'eliminate',
          cells: attackers,
          technique: 'attack',
          houses: [houseOf(layout, house)],
          support: cands,
        },
      };
    }
  }
  return null;
}

// ---------- T4 pair ----------

/**
 * Technique 4 (§7), the size-two set. Two regions whose candidates together
 * lie in exactly two rows own those rows' crowns between them, so any other
 * region's candidates in those rows are out; the same with columns. Its
 * dual: two rows whose candidates together lie in exactly two regions own
 * those regions' crowns, so the regions' candidates off those rows are out.
 */
function pair(state: SolveState, hc: readonly (readonly number[])[]): Outcome | null {
  const { layout } = state;
  const { size, regions } = layout;

  const step = (cells: number[], houses: readonly House[], support: readonly number[]) =>
    cells.length === 0
      ? null
      : ({ step: { kind: 'eliminate', cells, technique: 'pair', houses, support } } as Outcome);

  // Two regions confined to two lines.
  for (let a = 0; a < size; a++) {
    if (state.done[2 * size + a] === 1) continue;
    for (let b = a + 1; b < size; b++) {
      if (state.done[2 * size + b] === 1) continue;
      steps++;
      const support = [...hc[2 * size + a]!, ...hc[2 * size + b]!];
      const houses = [houseOf(layout, 2 * size + a), houseOf(layout, 2 * size + b)];
      const rows = distinct(support.map((index) => rowOf(index, size)));
      if (rows.length === 2) {
        const found = step(
          rows.flatMap((row) =>
            hc[row]!.filter((index) => regions[index] !== a && regions[index] !== b),
          ),
          houses,
          support,
        );
        if (found) return found;
      }
      const cols = distinct(support.map((index) => colOf(index, size)));
      if (cols.length === 2) {
        const found = step(
          cols.flatMap((col) =>
            hc[size + col]!.filter((index) => regions[index] !== a && regions[index] !== b),
          ),
          houses,
          support,
        );
        if (found) return found;
      }
    }
  }

  // Two lines confined to two regions (the dual), rows then columns.
  for (const base of [0, size]) {
    for (let a = 0; a < size; a++) {
      if (state.done[base + a] === 1) continue;
      for (let b = a + 1; b < size; b++) {
        if (state.done[base + b] === 1) continue;
        steps++;
        const support = [...hc[base + a]!, ...hc[base + b]!];
        const inRegions = distinct(support.map((index) => regions[index] ?? 0));
        if (inRegions.length !== 2) continue;
        const onLines = new Set(support);
        const found = step(
          inRegions.flatMap((region) =>
            hc[2 * size + region]!.filter((index) => !onLines.has(index)),
          ),
          [houseOf(layout, base + a), houseOf(layout, base + b)],
          support,
        );
        if (found) return found;
      }
    }
  }
  return null;
}

// ---------- T5 hypothesis ----------

/**
 * Technique 5 (§7): assume a crown on a candidate, propagate with T1–T3 to a
 * fixpoint, and if some house is left with nowhere to go, the candidate is
 * out. Tried from the houses with the fewest candidates, which is where a
 * person would try it, and the first contradiction found is the step.
 */
function hypothesis(state: SolveState, hc: readonly (readonly number[])[]): Outcome | null {
  const tried = new Set<number>();
  for (const house of housesByNeed(state, hc)) {
    for (const index of hc[house]!) {
      if (tried.has(index)) continue;
      tried.add(index);
      steps++;
      const trial = cloneState(state);
      placeCrown(trial, index);
      const result = solve(trial, HYPOTHESIS_INNER);
      if (result.contradiction !== null) {
        return {
          step: {
            kind: 'eliminate',
            cells: [index],
            technique: 'hypothesis',
            houses: [result.contradiction],
            support: [index],
          },
        };
      }
    }
  }
  return null;
}

// ---------- the fixpoint ----------

const SWEEPS: Record<
  Technique,
  (s: SolveState, hc: readonly (readonly number[])[]) => Outcome | null
> = {
  single,
  confinement,
  attack,
  pair,
  hypothesis,
};

/**
 * The next conclusion the techniques reach, cheapest first (§7). A more
 * expensive technique is only consulted once the cheaper ones have nothing
 * left to say. `single` always runs, whatever the set: it is where a
 * contradiction is noticed, and every tier includes it anyway.
 */
export function findStep(state: SolveState, techniques: readonly Technique[]): Outcome | null {
  const hc = houseCandidates(state);
  const first = single(state, hc);
  if (first !== null) return first;
  for (const technique of techniques) {
    if (technique === 'single') continue;
    const found = SWEEPS[technique](state, hc);
    if (found !== null) return found;
  }
  return null;
}

export interface SolveResult {
  /** N crowns stand — the puzzle needs nothing beyond these techniques. */
  readonly solved: boolean;
  /** A house that ended up with no crown and no candidate, or null. */
  readonly contradiction: House | null;
  /** Conclusions applied, in order. */
  readonly steps: readonly SolveStep[];
}

/**
 * Runs a technique set to a fixpoint from a state, mutating it (§7). Stops
 * when the board is full, when nothing more follows, or at a contradiction.
 */
export function solve(state: SolveState, techniques: readonly Technique[]): SolveResult {
  const applied: SolveStep[] = [];
  const size = state.layout.size;
  for (;;) {
    if (crownCount(state) === size) return { solved: true, contradiction: null, steps: applied };
    const outcome = findStep(state, techniques);
    if (outcome === null) return { solved: false, contradiction: null, steps: applied };
    if ('contradiction' in outcome) {
      return { solved: false, contradiction: outcome.contradiction, steps: applied };
    }
    applyStep(state, outcome.step);
    applied.push(outcome.step);
  }
}

export interface Grade {
  /** The smallest tier whose techniques finish the board, or null for none (§7). */
  readonly tier: Difficulty | null;
  /** The crowns the techniques placed — the whole solution when `tier` is set. */
  readonly crowns: readonly number[];
}

/**
 * Grades a board (§7): Easy's set to a fixpoint, then Medium's on from there,
 * then Hard's. One flow rather than three fresh solves, because the
 * techniques are monotone — fewer candidates never prove less — so a lower
 * set's fixpoint is a valid place for the next set to continue from.
 */
export function grade(regions: Regions, size: Size): Grade {
  const state = initialState(buildLayout(regions, size));
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const result = solve(state, TIER_TECHNIQUES[tier]);
    if (result.contradiction !== null) break;
    if (result.solved) return { tier, crowns: crownsOf(state) };
  }
  return { tier: null, crowns: crownsOf(state) };
}

// ---------- the counting solver (§8) ----------

/**
 * The first `limit` solutions of a partition, each as the crown's column per
 * row (§8). A crown per row, chosen column by column: no column twice, no
 * region twice, at least two columns from the crown above. The one pruning
 * is cheap and safe — a region whose last row has passed without a crown is a
 * dead end. Nodes are counted as work; nothing here trusts the technique
 * solver. `order` lets a caller choose the column order per row — the
 * generator shuffles it so the alternatives it repairs against are a spread
 * rather than lexicographic siblings (generator.ts).
 */
export function enumerateSolutions(
  regions: Regions,
  size: Size,
  limit = 2,
  order?: readonly (readonly number[])[],
): number[][] {
  const lastRowOfRegion = new Array<number>(size).fill(-1);
  for (let index = 0; index < regions.length; index++) {
    const region = regions[index]!;
    lastRowOfRegion[region] = Math.max(lastRowOfRegion[region]!, rowOf(index, size));
  }
  const usedCol = new Array<boolean>(size).fill(false);
  const usedRegion = new Array<boolean>(size).fill(false);
  const columns: number[] = [];
  const found: number[][] = [];
  const identity = Array.from({ length: size }, (_, col) => col);

  const place = (row: number, previousCol: number): void => {
    if (found.length >= limit) return;
    if (row === size) {
      found.push([...columns]);
      return;
    }
    for (let region = 0; region < size; region++) {
      if (!usedRegion[region] && lastRowOfRegion[region]! < row) return;
    }
    for (const col of order?.[row] ?? identity) {
      if (usedCol[col] || Math.abs(col - previousCol) <= 1) continue;
      const region = regions[indexOf(row, col, size)]!;
      if (usedRegion[region]) continue;
      steps++;
      usedCol[col] = true;
      usedRegion[region] = true;
      columns.push(col);
      place(row + 1, col);
      columns.pop();
      usedCol[col] = false;
      usedRegion[region] = false;
      if (found.length >= limit) return;
    }
  };

  place(0, -2);
  return found;
}

/** How many solutions a partition has, up to `limit` (§8). */
export function countSolutions(regions: Regions, size: Size, limit = 2): number {
  return enumerateSolutions(regions, size, limit).length;
}

// ---------- the hint (§6) ----------

export type Hint =
  /** Crowns that already break a rule. Shown before anything else (§6). */
  | { readonly kind: 'violation'; readonly cells: readonly number[] }
  /** A crown that is not in the solution — allowed because the puzzle is unique (§6, §14). */
  | { readonly kind: 'wrong'; readonly index: number }
  /** The next conclusion the techniques reach from the player's crowns (§6). */
  | { readonly kind: 'step'; readonly step: SolveStep };

/**
 * The teaching hint of §6, in its order: a broken rule, then a crown that
 * cannot be right, then the next technique step — read from the player's
 * crowns alone. The ×s are never trusted; a step whose every cell the player
 * has already crossed out is old news, so it is applied quietly and the search
 * moves on. Null when nothing is left to say.
 */
export function findHint(
  marks: readonly Mark[],
  regions: Regions,
  solution: Solution,
  size: Size,
): Hint | null {
  const violations = findViolations(marks, regions, size);
  if (violations.any) {
    const cells: number[] = [];
    violations.cells.forEach((flagged, index) => {
      if (flagged) cells.push(index);
    });
    return { kind: 'violation', cells };
  }

  const crowns = crownIndices(marks);
  for (const index of crowns) {
    if (solution[rowOf(index, size)] !== colOf(index, size)) return { kind: 'wrong', index };
  }

  const state = initialState(buildLayout(regions, size), crowns);
  for (;;) {
    if (crownCount(state) === size) return null;
    const outcome = findStep(state, TIER_TECHNIQUES.hard);
    if (outcome === null || 'contradiction' in outcome) return null;
    const { step } = outcome;
    if (step.kind === 'place') return { kind: 'step', step };
    const fresh = step.cells.filter((index) => marks[index] !== CROSS);
    if (fresh.length > 0) return { kind: 'step', step: { ...step, cells: fresh } };
    applyStep(state, step);
  }
}
