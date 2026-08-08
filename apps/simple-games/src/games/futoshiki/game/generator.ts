/**
 * Board generation — implements docs/FUTOSHIKI_RULES.md §8.
 *
 * Three steps. First a Latin square: every row and every column holds 1..N
 * once (§3), built by backtracking in row-major order with the digit order
 * shuffled from the seed. Then the signs: every orthogonally adjacent pair of
 * cells is a possible place for one, the list is shuffled, the first k are
 * taken, and each one is pointed by the finished square — so a sign can never
 * contradict the answer, it is read off it.
 *
 * Then the givens are dug out, one cell at a time in a seed-shuffled order,
 * keeping a removal only while the technique solver (§7) still settles every
 * cell. So the puzzle that ships is the one the solver finishes, which is what
 * makes the solution unique and the guessing unnecessary.
 *
 * A candidate that will not dig down to its band's target costs one derived
 * seed and another try (`<seed>#2`, `#3`, …), the same shape Nonogram §5 uses.
 * The gate on all of this is work, never wall clock — see `solverWork`.
 */
import { createRng, shuffled } from './rng';
import { isFullyDetermined, solverWork } from './solver';
import {
  EMPTY,
  bitOf,
  cellCount,
  colOf,
  rowOf,
  type Constraint,
  type Grid,
  type Size,
} from './types';

/** Derived seeds tried before shipping the best candidate anyway (§8). */
export const ATTEMPT_LIMIT = 24;

/**
 * Cell placements the Latin-square backtracker may try before giving up on a
 * seed. A 7×7 square is easy to find — the measured worst case is a few
 * hundred — so this only exists to keep a pathological seed from spinning.
 */
export const SEARCH_LIMIT = 20_000;

/**
 * What a level asks generation for (§9). Two numbers, because two dials move:
 * how many signs the board carries and how many digits it hands over. Both are
 * counts rather than ratios, so the level table reads as the thing a player
 * sees on the board.
 */
export interface PuzzleSpec {
  /** How many signs to place. Exact — the board carries what it was asked for. */
  readonly constraints: number;
  /** The most givens the dig may leave. A target, not a promise (§8). */
  readonly givens: number;
}

export interface GeneratedPuzzle {
  readonly size: Size;
  readonly solution: readonly number[];
  /** The signs, in reading order (§1). */
  readonly constraints: readonly Constraint[];
  /** The fixed digits (§1); 0 wherever the player has to work it out. */
  readonly givens: readonly number[];
  readonly givensCount: number;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Reads the solver spent building this puzzle: the budgeted work of §8. */
  readonly work: number;
  /** True when the cap was hit and the shallowest dig shipped anyway (§8). */
  readonly fallback: boolean;
}

/**
 * Every gap where a sign could go: the pair to the right of a cell and the
 * pair below it, in reading order. There are 2·N·(N−1) of them — 24 at 4×4 and
 * 84 at 7×7 — which is the pool a level's sign count is drawn from.
 */
export function adjacentPairs(size: Size): readonly (readonly [number, number])[] {
  const pairs: [number, number][] = [];
  for (let index = 0; index < cellCount(size); index++) {
    if (colOf(index, size) < size - 1) pairs.push([index, index + 1]);
    if (rowOf(index, size) < size - 1) pairs.push([index, index + size]);
  }
  return pairs;
}

/**
 * A finished Latin square, or null when the search budget runs out. Row-major
 * backtracking with a seed-shuffled digit order at every cell: the shuffle is
 * what makes two seeds differ, and the masks make the legality test one AND.
 */
export function buildSolution(seed: string, size: Size): number[] | null {
  const rng = createRng(seed);
  const cells = cellCount(size);
  const grid = new Array<number>(cells).fill(EMPTY);
  const rowMask = new Array<number>(size).fill(0);
  const colMask = new Array<number>(size).fill(0);
  const digits = Array.from({ length: size }, (_, i) => i + 1);
  let searched = 0;

  const fill = (index: number): boolean => {
    if (index === cells) return true;
    const row = rowOf(index, size);
    const col = colOf(index, size);
    for (const digit of shuffled(digits, rng)) {
      const bit = bitOf(digit);
      if ((rowMask[row]! & bit) !== 0 || (colMask[col]! & bit) !== 0) continue;
      if (++searched > SEARCH_LIMIT) return false;

      grid[index] = digit;
      rowMask[row]! |= bit;
      colMask[col]! |= bit;
      if (fill(index + 1)) return true;
      grid[index] = EMPTY;
      rowMask[row]! &= ~bit;
      colMask[col]! &= ~bit;
    }
    return false;
  };

  return fill(0) ? grid : null;
}

/**
 * Picks `count` signs and points each one at the solution, then returns them
 * in reading order.
 *
 * Reading order is not cosmetic: it is the order the save format writes them
 * in (§11) and the order the board draws them in, so a puzzle's signs are the
 * same list on every device and in every session. `count` above the number of
 * gaps simply takes them all.
 */
export function pickConstraints(
  seed: string,
  size: Size,
  solution: Grid,
  count: number,
): Constraint[] {
  const chosen = shuffled(adjacentPairs(size), createRng(`${seed}-signs`)).slice(
    0,
    Math.max(0, Math.floor(count)),
  );
  return chosen
    .map(([first, second]) =>
      solution[first]! < solution[second]!
        ? { less: first, greater: second }
        : { less: second, greater: first },
    )
    .sort((a, b) => {
      const [aFirst, aSecond] = a.less < a.greater ? [a.less, a.greater] : [a.greater, a.less];
      const [bFirst, bSecond] = b.less < b.greater ? [b.less, b.greater] : [b.greater, b.less];
      return aFirst - bFirst || aSecond - bSecond;
    });
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
function dig(
  solution: readonly number[],
  size: Size,
  constraints: readonly Constraint[],
  target: number,
  seed: string,
): number[] {
  const givens = [...solution];
  const order = shuffled(
    Array.from({ length: cellCount(size) }, (_, index) => index),
    createRng(`${seed}-dig`),
  );
  let remaining = givens.length;

  for (const index of order) {
    if (remaining <= target) break;
    const removed = givens[index]!;
    givens[index] = EMPTY;
    if (isFullyDetermined(givens, size, constraints)) remaining--;
    else givens[index] = removed;
  }
  return givens;
}

/**
 * The same seed always returns the same puzzle (§8): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the puzzle that ships is a
 * pure function of the seed, the size and the spec alone.
 *
 * The givens count is a target, not a promise about this board. When a
 * candidate digs no deeper the seed is derived and a fresh square tried; when
 * the cap is reached the shallowest surviving candidate ships. That puzzle is
 * still unique and still needs no guessing — it is only easier than the band
 * asked for, which is the one failure worth shipping. Tests watch the rate (it
 * is zero across every level and daily today).
 */
export function generatePuzzle(seed: string, size: Size, spec: PuzzleSpec): GeneratedPuzzle {
  const target = Math.max(0, Math.round(spec.givens));
  const before = solverWork.read();

  let best: {
    solution: number[];
    constraints: Constraint[];
    givens: number[];
    count: number;
  } | null = null;

  for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const solution = buildSolution(derived, size);
    if (solution === null) continue;

    const constraints = pickConstraints(derived, size, solution, spec.constraints);
    const givens = dig(solution, size, constraints, target, derived);
    const count = givens.reduce<number>((sum, cell) => sum + (cell === EMPTY ? 0 : 1), 0);

    if (count <= target) {
      return {
        size,
        solution,
        constraints,
        givens,
        givensCount: count,
        attempts: attempt,
        work: solverWork.read() - before,
        fallback: false,
      };
    }
    if (best === null || count < best.count) best = { solution, constraints, givens, count };
  }

  const shallowest = best ?? { solution: [], constraints: [], givens: [], count: 0 };
  return {
    size,
    solution: shallowest.solution,
    constraints: shallowest.constraints,
    givens: shallowest.givens,
    givensCount: shallowest.count,
    attempts: ATTEMPT_LIMIT,
    work: solverWork.read() - before,
    fallback: true,
  };
}
