/**
 * The logical solver (docs/MINESWEEPER_RULES.md §5).
 *
 * It knows exactly two inference rules, and that is the point: the generator
 * only ships a board this solver can finish, so "played correctly, you always
 * win" is a guarantee rather than a hope (§4). Adding a third rule here would
 * quietly change what the app promises, because boards that need it would start
 * being shipped.
 *
 *   counting — a number cell whose proved mines already account for its number
 *              has nothing but safe cells left; a number cell with exactly as
 *              many unknown neighbours as it still needs is surrounded by mines.
 *   subset   — when A's unknown neighbours are all among B's, the cells B has
 *              and A does not hold exactly (B's remainder − A's remainder)
 *              mines. That settles the 1-2 patterns a person reads at a glance.
 *
 * Both are exposed two ways: `solveFrom` answers "does logic finish this
 * board?" for generation, and `findSafeCell` answers "what can be proved right
 * now?" for Hint — which is why every deduction carries the number cells that
 * justify it (§7: a hint highlights its reason, it does not just point).
 *
 * Deductions are read off the open numbers alone. The player's flags are never
 * consulted: a hint that trusted a wrong flag would confidently lie.
 */
import { neighbourTable, openRegion, safeCellCount, type MineField } from './board';

export type InferenceRule = 'counting' | 'subset';

export interface Deduction {
  readonly rule: InferenceRule;
  /** 'safe': none of `cells` holds a mine. 'mine': every one of them does. */
  readonly kind: 'safe' | 'mine';
  /** Cells the rule settles — always cells nothing was known about yet. */
  readonly cells: readonly number[];
  /** The open number cells that prove it. */
  readonly reason: readonly number[];
}

/** One provably safe cell, and why — what Hint shows (§7). */
export interface SafeCell {
  readonly index: number;
  readonly rule: InferenceRule;
  readonly reason: readonly number[];
}

/** What a solver sees: the board's open numbers and nothing else. */
export interface SolverView {
  readonly width: number;
  readonly height: number;
  /** Adjacent-mine count where the cell is open, null where it is not. */
  readonly numbers: readonly (number | null)[];
}

export interface SolveOutcome {
  /** Every safe cell was opened using the two rules alone — no guess needed. */
  readonly solved: boolean;
  /** Safe cells still shut when the rules ran out; 0 exactly when solved. */
  readonly remaining: number;
  /** Deductions applied — a rough cost signal for the generator's tests. */
  readonly steps: number;
}

/** Safety valve; a real board settles in far fewer facts than this. */
const MAX_STEPS = 5000;

/** Mutable working knowledge. `mine` holds the cells proved to hold one. */
interface SolveState {
  readonly cells: number;
  readonly table: readonly (readonly number[])[];
  readonly numbers: (number | null)[];
  readonly mine: boolean[];
  /** Scratch buffers, so a scan that finds nothing allocates nothing. */
  readonly bufferA: number[];
  readonly bufferB: number[];
  readonly bufferC: number[];
}

function createState(view: SolverView): SolveState {
  const cells = view.width * view.height;
  return {
    cells,
    table: neighbourTable(view.width, view.height),
    numbers: [...view.numbers],
    mine: new Array<boolean>(cells).fill(false),
    bufferA: new Array<number>(8).fill(0),
    bufferB: new Array<number>(8).fill(0),
    bufferC: new Array<number>(8).fill(0),
  };
}

/**
 * Neighbours of `cell` whose contents are still an open question, written into
 * `out`. Returns how many. Open cells and proved mines are settled and are
 * therefore excluded.
 */
function unknownsOf(state: SolveState, cell: number, out: number[]): number {
  let n = 0;
  for (const neighbour of state.table[cell]!) {
    if (state.numbers[neighbour] !== null) continue;
    if (state.mine[neighbour]) continue;
    out[n++] = neighbour;
  }
  return n;
}

/** How many mines around `cell` have already been proved. */
function provedMines(state: SolveState, cell: number): number {
  let n = 0;
  for (const neighbour of state.table[cell]!) if (state.mine[neighbour]) n++;
  return n;
}

const slice = (buffer: readonly number[], length: number): number[] =>
  buffer.slice(0, length);

/**
 * Reports each fact a scan finds. Returning false stops the scan — Hint uses
 * that to leave the moment it has something to show.
 */
type FactHandler = (deduction: Deduction) => boolean;

/** The counting rule over every open number cell. Returns facts reported. */
function scanCounting(state: SolveState, onFact: FactHandler): number {
  const unknowns = state.bufferA;
  let facts = 0;
  for (let cell = 0; cell < state.cells; cell++) {
    const number = state.numbers[cell];
    if (number === null || number === undefined) continue;
    const count = unknownsOf(state, cell, unknowns);
    if (count === 0) continue;
    const remaining = number - provedMines(state, cell);
    const kind = remaining === 0 ? 'safe' : remaining === count ? 'mine' : null;
    if (kind === null) continue;
    facts++;
    if (!onFact({ rule: 'counting', kind, cells: slice(unknowns, count), reason: [cell] })) {
      return facts;
    }
  }
  return facts;
}

const includesIn = (buffer: readonly number[], length: number, value: number): boolean => {
  for (let i = 0; i < length; i++) if (buffer[i] === value) return true;
  return false;
};

/**
 * The subset rule. Candidates for B are the open number cells touching A's
 * first unknown neighbour: if A's unknowns all sit inside B's, then B is a
 * neighbour of every one of them, so eight candidates is the whole search.
 */
function scanSubset(state: SolveState, onFact: FactHandler): number {
  const unknownsA = state.bufferA;
  const unknownsB = state.bufferB;
  const difference = state.bufferC;
  let facts = 0;

  for (let a = 0; a < state.cells; a++) {
    const numberA = state.numbers[a];
    if (numberA === null || numberA === undefined) continue;
    const countA = unknownsOf(state, a, unknownsA);
    if (countA === 0) continue;
    const remainingA = numberA - provedMines(state, a);

    for (const b of state.table[unknownsA[0]!]!) {
      if (b === a) continue;
      const numberB = state.numbers[b];
      if (numberB === null || numberB === undefined) continue;
      const countB = unknownsOf(state, b, unknownsB);
      // Equal sets carry no new information; a smaller B cannot contain A.
      if (countB <= countA) continue;

      let contained = true;
      for (let i = 0; i < countA && contained; i++) {
        contained = includesIn(unknownsB, countB, unknownsA[i]!);
      }
      if (!contained) continue;

      let countDifference = 0;
      for (let i = 0; i < countB; i++) {
        const cell = unknownsB[i]!;
        if (!includesIn(unknownsA, countA, cell)) difference[countDifference++] = cell;
      }

      const remaining = numberB - provedMines(state, b) - remainingA;
      const kind = remaining === 0 ? 'safe' : remaining === countDifference ? 'mine' : null;
      if (kind === null) continue;
      facts++;
      if (
        !onFact({
          rule: 'subset',
          kind,
          cells: slice(difference, countDifference),
          reason: [a, b],
        })
      ) {
        return facts;
      }
    }
  }
  return facts;
}

/**
 * Solves the board as a player would, starting from the region the first tap
 * opened, and reports whether logic alone finished it. This is the check that
 * decides whether a generated layout may be shipped (§5).
 *
 * Facts are applied as they are found rather than one per full rescan: the two
 * rules only ever add true statements about a real field, so applying more of
 * them early can never invalidate a later one — and it keeps generation inside
 * its time budget.
 */
export function solveFrom(field: MineField, firstIndex: number): SolveOutcome {
  const cells = field.mines.length;
  const opened = new Array<boolean>(cells).fill(false);
  let openedCount = openRegion(field, firstIndex, opened);
  const target = safeCellCount(field);

  const state = createState({
    width: field.width,
    height: field.height,
    numbers: opened.map((isOpen, index) => (isOpen ? field.counts[index]! : null)),
  });

  let steps = 0;

  /** Opens a proved-safe cell (and whatever its region drags along with it). */
  const open = (cell: number): void => {
    const before = openedCount;
    openedCount += openRegion(field, cell, opened);
    if (openedCount === before) return;
    for (let i = 0; i < cells; i++) {
      if (opened[i] && state.numbers[i] === null) state.numbers[i] = field.counts[i]!;
    }
  };

  const apply: FactHandler = (deduction) => {
    steps++;
    if (deduction.kind === 'mine') {
      for (const cell of deduction.cells) state.mine[cell] = true;
    } else {
      for (const cell of deduction.cells) open(cell);
    }
    return steps < MAX_STEPS;
  };

  while (openedCount < target && steps < MAX_STEPS) {
    // Counting first: it is cheaper, and it settles most of a board on its own.
    if (scanCounting(state, apply) > 0) continue;
    if (scanSubset(state, apply) > 0) continue;
    break;
  }

  return { solved: openedCount === target, remaining: target - openedCount, steps };
}

/**
 * One cell the two rules prove is safe right now, with the numbers that prove
 * it — Hint, and nothing more (§7). Cells proved to hold mines are used to
 * reach the answer but never returned: pointing at a mine would take away the
 * part of the game the player came for.
 *
 * Returns null only when nothing can be proved. §4 makes that unreachable on a
 * board this app generated, but the caller still has to say something.
 */
export function findSafeCell(view: SolverView): SafeCell | null {
  const state = createState(view);
  // A box rather than a local: the handler below writes it from inside a
  // closure, which a plain `let` would hide from the type narrowing here.
  const found: { cell: SafeCell | null } = { cell: null };

  const handler: FactHandler = (deduction) => {
    if (deduction.kind === 'safe') {
      found.cell = { index: deduction.cells[0]!, rule: deduction.rule, reason: deduction.reason };
      return false;
    }
    for (const cell of deduction.cells) state.mine[cell] = true;
    return true;
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    // Each mine fact settles a cell nothing was known about, so a round that
    // reports nothing at all is the end of what these two rules can say.
    if (scanCounting(state, handler) > 0) {
      if (found.cell !== null) return found.cell;
      continue;
    }
    if (scanSubset(state, handler) > 0) {
      if (found.cell !== null) return found.cell;
      continue;
    }
    return null;
  }
  return null;
}
