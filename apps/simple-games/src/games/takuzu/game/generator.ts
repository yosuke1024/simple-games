/**
 * Board generation — implements docs/TAKUZU_RULES.md §6.
 *
 * Two halves. First a finished board obeying all three rules, built by
 * backtracking over whole lines rather than cell by cell: rule 2 says every
 * row is half zeros and half ones and rule 1 forbids a triple inside it, so
 * the legal rows of a size are a short fixed alphabet — 14 of them at 6 wide,
 * 34 at 8 and 84 at 10 — that can be enumerated once and drawn from. Choosing
 * a row at a time makes rules 1 and 3 free for rows (no row is used twice) and
 * leaves only the columns to check while filling.
 *
 * Then the givens are dug out of it, one cell at a time in a seed-shuffled
 * order, keeping a removal only while the technique solver (§5) still settles
 * every cell. So the puzzle that ships is the one the solver finishes, which
 * is what makes the solution unique and the guessing unnecessary.
 *
 * A candidate that will not dig down to its band's target costs one derived
 * seed and another try (`<seed>#2`, `#3`, …), the same shape Nonogram §5 uses.
 * The gate on all of this is work, never wall clock — see `solverWork`.
 */
import { createRng, shuffled } from './rng';
import { isFullyDetermined, solverWork } from './solver';
import { EMPTY, ONE, ZERO, cellCount, halfLine, type Cell, type Mark, type Size } from './types';

/** Derived seeds tried before shipping the best candidate anyway (§6). */
export const ATTEMPT_LIMIT = 24;

/**
 * Line placements the backtracker may try before giving up on a seed. A
 * finished board is easy to find — the measured worst case is well inside two
 * figures — so this only exists to keep a pathological seed from spinning.
 */
export const SEARCH_LIMIT = 20_000;

export interface GeneratedPuzzle {
  readonly size: Size;
  readonly solution: readonly Cell[];
  /** The fixed cells (§1); EMPTY wherever the player has to work it out. */
  readonly givens: readonly Mark[];
  readonly givensCount: number;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Lines the solver read to build this puzzle: the budgeted work of §6. */
  readonly work: number;
  /** True when the cap was hit and the shallowest dig shipped anyway (§6). */
  readonly fallback: boolean;
}

/**
 * Every legal line of one size: half zeros, half ones, no three the same in a
 * row. Enumerated over the 2^size bit patterns once per size — 1024 of them at
 * the largest board, which is cheaper than any cleverer construction.
 */
const alphabets = new Map<Size, readonly (readonly Cell[])[]>();

export function legalLines(size: Size): readonly (readonly Cell[])[] {
  const cached = alphabets.get(size);
  if (cached !== undefined) return cached;

  const half = halfLine(size);
  const out: Cell[][] = [];
  for (let bits = 0; bits < 1 << size; bits++) {
    const line: Cell[] = [];
    let ones = 0;
    let run = 1;
    let legal = true;
    for (let i = 0; i < size; i++) {
      const value: Cell = (bits >> i) & 1 ? ONE : ZERO;
      line.push(value);
      if (value === ONE) ones++;
      if (i > 0) run = line[i - 1] === value ? run + 1 : 1;
      if (run >= 3) {
        legal = false;
        break;
      }
    }
    if (legal && ones === half) out.push(line);
  }
  alphabets.set(size, out);
  return out;
}

/**
 * A finished board obeying all three rules, or null when the search budget
 * runs out. Rows are drawn from the alphabet in one seed-shuffled order and
 * never repeated, so rules 1 and 3 hold for rows by construction; the columns
 * are checked as they fill.
 */
export function buildSolution(seed: string, size: Size): Cell[] | null {
  const half = halfLine(size);
  const alphabet = shuffled(legalLines(size), createRng(seed));
  const used = new Array<boolean>(alphabet.length).fill(false);
  const rows: (readonly Cell[])[] = [];
  const zerosInColumn = new Array<number>(size).fill(0);
  const onesInColumn = new Array<number>(size).fill(0);
  let searched = 0;

  const columnsDistinct = (): boolean => {
    for (let a = 0; a < size; a++) {
      for (let b = a + 1; b < size; b++) {
        let same = true;
        for (let row = 0; row < size && same; row++) same = rows[row]![a] === rows[row]![b];
        if (same) return false;
      }
    }
    return true;
  };

  const fits = (line: readonly Cell[]): boolean => {
    const depth = rows.length;
    for (let col = 0; col < size; col++) {
      const value = line[col]!;
      const count = value === ZERO ? zerosInColumn[col]! : onesInColumn[col]!;
      if (count + 1 > half) return false;
      if (depth >= 2 && rows[depth - 1]![col] === value && rows[depth - 2]![col] === value) {
        return false;
      }
    }
    return true;
  };

  const place = (): boolean => {
    if (rows.length === size) return columnsDistinct();
    for (let i = 0; i < alphabet.length; i++) {
      if (used[i]) continue;
      const line = alphabet[i]!;
      if (++searched > SEARCH_LIMIT) return false;
      if (!fits(line)) continue;

      used[i] = true;
      rows.push(line);
      for (let col = 0; col < size; col++) {
        if (line[col] === ZERO) zerosInColumn[col]!++;
        else onesInColumn[col]!++;
      }

      if (place()) return true;

      rows.pop();
      used[i] = false;
      for (let col = 0; col < size; col++) {
        if (line[col] === ZERO) zerosInColumn[col]!--;
        else onesInColumn[col]!--;
      }
    }
    return false;
  };

  if (!place()) return null;
  return rows.flat();
}

/**
 * Removes givens in a shuffled order, keeping a removal only while the solver
 * still settles the whole board, and stopping once the target is reached.
 *
 * One pass is enough, and that is a fact about the solver rather than a
 * shortcut: fewer givens can only ever prove less, so a cell that could not be
 * removed earlier can never be removed later either. A second pass in a
 * different order would find nothing a first pass in that order had not.
 */
function dig(solution: readonly Cell[], size: Size, target: number, seed: string): Mark[] {
  const givens: Mark[] = [...solution];
  const order = shuffled(
    Array.from({ length: cellCount(size) }, (_, index) => index),
    createRng(`${seed}-dig`),
  );
  let remaining = givens.length;

  for (const index of order) {
    if (remaining <= target) break;
    const removed = givens[index]!;
    givens[index] = EMPTY;
    if (isFullyDetermined(givens, size)) remaining--;
    else givens[index] = removed;
  }
  return givens;
}

/**
 * The same seed always returns the same puzzle (§6): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the puzzle that ships is a
 * pure function of the seed, the size and the target alone.
 *
 * `givensRatio` is a target, not a promise about this board. When a candidate
 * digs no deeper the seed is derived and a fresh solution tried; when the cap
 * is reached the shallowest surviving candidate ships. That puzzle is still
 * unique and still needs no guessing — it is only easier than the band asked
 * for, which is the one failure worth shipping. Tests watch the rate (it is
 * zero across every level and daily today).
 */
export function generatePuzzle(seed: string, size: Size, givensRatio: number): GeneratedPuzzle {
  const target = Math.round(cellCount(size) * givensRatio);
  const before = solverWork.read();

  let best: { solution: Cell[]; givens: Mark[]; count: number } | null = null;

  for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const solution = buildSolution(derived, size);
    if (solution === null) continue;

    const givens = dig(solution, size, target, derived);
    const count = givens.reduce<number>((sum, cell) => sum + (cell === EMPTY ? 0 : 1), 0);

    if (count <= target) {
      return {
        size,
        solution,
        givens,
        givensCount: count,
        attempts: attempt,
        work: solverWork.read() - before,
        fallback: false,
      };
    }
    if (best === null || count < best.count) best = { solution, givens, count };
  }

  const fallback = best ?? { solution: [] as Cell[], givens: [] as Mark[], count: 0 };
  return {
    size,
    solution: fallback.solution,
    givens: fallback.givens,
    givensCount: fallback.count,
    attempts: ATTEMPT_LIMIT,
    work: solverWork.read() - before,
    fallback: true,
  };
}
