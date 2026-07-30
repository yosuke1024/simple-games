/**
 * Puzzle generation (docs/SUDOKU_RULES.md §7).
 *
 * Build a full board, then dig cells out of it while two invariants hold: the
 * puzzle keeps exactly one solution, and the tier's technique set can still
 * finish it. A tier is therefore a promise about two things at once — which
 * techniques a board may demand, and how sparse it is — and both are
 * guaranteed by construction rather than searched for.
 *
 * That pairing is deliberate. Measured over many seeds, a symmetric board dug
 * as deep as uniqueness allows needs a subset technique only about one time in
 * twenty: singles and locked candidates are simply that strong. Defining
 * "hard" as "a subset is strictly necessary" would mean either rejecting
 * nineteen boards out of twenty (far past the time budget) or shipping boards
 * labelled hard that play as medium. Bounding the technique set and digging
 * deeper is honest, fast, and monotonic — every step up allows more techniques
 * AND leaves fewer clues.
 *
 * Everything derives from the seed, so a level or a date yields the same
 * puzzle on every device with no content pipeline and no download.
 */
import { solvableWithin } from './grader';
import { createRng, shuffled } from './rng';
import { countSolutions, generateSolvedGrid } from './solver';
import { CELLS, SIZE, type Difficulty, type Grid, type Puzzle } from './types';

/** The mathematical floor for a uniquely solvable Sudoku. */
const MIN_CLUES = 17;

/**
 * How each tier digs.
 *
 * `unitSizes` is the sequence of removal-group sizes: 2 removes a
 * 180°-rotation pair, 1 removes a single cell. Easy and medium stay fully
 * symmetric. Hard runs the symmetric pass first and then keeps going one cell
 * at a time — it trades some of that symmetry for the extra three clues of
 * depth that make it noticeably harder to read.
 *
 * `minClues` is where digging stops. Easy stops early on purpose: a beginner's
 * board should look approachable, not just be solvable with singles.
 */
const DIG_PLAN: Record<Difficulty, { readonly minClues: number; readonly unitSizes: readonly (1 | 2)[] }> = {
  easy: { minClues: 36, unitSizes: [2] },
  medium: { minClues: MIN_CLUES, unitSizes: [2] },
  hard: { minClues: MIN_CLUES, unitSizes: [2, 1] },
};

/** Clue counts each tier is expected to land in — an outcome, pinned by tests. */
export const CLUE_RANGE: Record<Difficulty, { readonly min: number; readonly max: number }> = {
  easy: { min: 36, max: 46 },
  medium: { min: 22, max: 34 },
  hard: { min: 20, max: 30 },
};

/** Derived-seed attempts, for the case a dig fails its own invariants. */
const MAX_ATTEMPTS = 4;

/** Removal groups: 180° symmetric pairs, or single cells. */
function removalGroups(unitSize: 1 | 2): readonly (readonly number[])[] {
  if (unitSize === 1) return Array.from({ length: CELLS }, (_, index) => [index]);
  const groups: number[][] = [];
  const seen = new Set<number>();
  for (let i = 0; i < CELLS; i++) {
    if (seen.has(i)) continue;
    const mirror = CELLS - 1 - i;
    seen.add(i);
    seen.add(mirror);
    groups.push(i === mirror ? [i] : [i, mirror]);
  }
  return groups;
}

const GROUPS: Record<1 | 2, readonly (readonly number[])[]> = {
  1: removalGroups(1),
  2: removalGroups(2),
};

export function clueCount(grid: Grid): number {
  let count = 0;
  for (let i = 0; i < CELLS; i++) if (grid[i] !== 0) count++;
  return count;
}

/**
 * Digs one board for the target tier. A removal is undone when it breaks
 * uniqueness or leaves a puzzle the tier's techniques cannot finish.
 *
 * Passes repeat while progress is being made, reshuffling each time: a group
 * rejected early often becomes removable once the board around it changed, and
 * a different order reaches a different — usually deeper — minimal board.
 */
function digBoard(seed: string, target: Difficulty): { givens: Grid; solution: Grid } {
  const rng = createRng(seed);
  const solution = generateSolvedGrid(seed, rng);
  const givens = [...solution];
  const plan = DIG_PLAN[target];

  for (const unitSize of plan.unitSizes) {
    const groups = GROUPS[unitSize];
    for (;;) {
      let progressed = false;
      for (const group of shuffled(groups, rng)) {
        if (group.every((index) => givens[index] === 0)) continue;
        // Checked against the whole group, not one cell: a pair removal must
        // not step over the floor either.
        if (clueCount(givens) - group.length < plan.minClues) continue;

        const removed = group.map((index) => givens[index]!);
        for (const index of group) givens[index] = 0;

        // Uniqueness first: it is the cheaper check, and a board with two
        // solutions can never be played — or graded — honestly.
        const stillFair = countSolutions(givens, 2) === 1 && solvableWithin(givens, target);
        if (!stillFair) {
          group.forEach((index, k) => (givens[index] = removed[k]!));
          continue;
        }
        progressed = true;
      }
      if (!progressed) break;
    }
  }

  return { givens, solution };
}

/**
 * A puzzle of the requested difficulty, derived entirely from the seed.
 *
 * The invariants are re-checked before the board is handed out; a derived seed
 * is tried if one ever fails, so generation cannot hand the player an unfair
 * board and cannot fail to produce one either.
 */
export function generatePuzzle(seed: string, difficulty: Difficulty): Puzzle {
  let last: { givens: Grid; solution: Grid } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const board = digBoard(attempt === 1 ? seed : `${seed}#${attempt}`, difficulty);
    last = board;
    const fair =
      countSolutions(board.givens, 2) === 1 &&
      solvableWithin(board.givens, difficulty) &&
      clueCount(board.givens) >= MIN_CLUES;
    if (fair) return { seed, difficulty, givens: board.givens, solution: board.solution };
  }

  // Unreachable in practice; the fallback keeps generation total.
  return { seed, difficulty, givens: last!.givens, solution: last!.solution };
}

/** Row-major string form, for golden tests and fixtures. */
export function gridToString(grid: Grid): string {
  let out = '';
  for (let i = 0; i < CELLS; i++) out += String(grid[i] ?? 0);
  return out;
}

/** Parses the 81-character form. Returns null when malformed. */
export function gridFromString(text: string): Grid | null {
  if (text.length !== CELLS) return null;
  const grid: number[] = [];
  for (const character of text) {
    const value = character === '.' || character === '0' ? 0 : Number(character);
    if (!Number.isInteger(value) || value < 0 || value > SIZE) return null;
    grid.push(value);
  }
  return grid;
}
