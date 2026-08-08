/**
 * Core Futoshiki types. See docs/FUTOSHIKI_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * A board is one row-major flat array addressed by a single index, never by a
 * pair, so the solver and the generator keep their hot loops on flat arrays.
 * Boards are always square (§1), so a single size travels instead of a width
 * and a height, and a cell holds 0 for "nothing yet" or 1..N for a digit —
 * the same shape Sudoku uses, because the digits are the game.
 *
 * Candidate sets are N-bit masks (bit 0 = digit 1). Masks keep the solver
 * allocation-free in its hot loops, which is what lets generation stay inside
 * the work budget of §8.
 *
 * There is no difficulty type. Sudoku §6's rule is that a tier is only honest
 * when it names a set of ALLOWED techniques, and every Futoshiki this game
 * ships allows the same five (§7): the sign, the two singles, the two pairs.
 * What moves between levels is two counts — how many signs the board carries
 * and how many digits it hands over — interpolated inside a band (levels.ts).
 * A tier enum here would name the same technique set at every level, which is
 * a label with nothing behind it.
 *
 * Splitting the pairs off into a top tier was measured and rejected, the way
 * Sudoku §6 rejected "hard means a subset is required": across the 100 levels
 * and two months of dailies, one board in 160 needs a pair at all
 * (`guarantee.test.ts` counts it). A tier that allowed them would be a promise
 * about a technique almost no board asks for.
 */

/**
 * The four board sizes (§1). Below 4 a Latin square is a puzzle with nothing
 * in it; above 7 a cell stops being finger-sized at 320px once the gaps that
 * carry the signs are subtracted, which is the same floor Nonogram drew.
 */
export type Size = 4 | 5 | 6 | 7;
export const SIZES: readonly Size[] = [4, 5, 6, 7];

export const isSize = (value: unknown): value is Size =>
  value === 4 || value === 5 || value === 6 || value === 7;

export const cellCount = (size: Size): number => size * size;

/** A written digit. 7 is the largest board, so the union stays finite (§1). */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** An empty cell. Not a digit, and never a candidate. */
export const EMPTY = 0;

/** N×N values, row-major. 0 = empty, 1..N = a digit. */
export type Grid = readonly number[];

export const rowOf = (index: number, size: number): number => Math.floor(index / size);
export const colOf = (index: number, size: number): number => index % size;
export const indexOf = (row: number, col: number, size: number): number => row * size + col;

export const bitOf = (digit: number): number => 1 << (digit - 1);
export const hasBit = (mask: number, digit: number): boolean => (mask & bitOf(digit)) !== 0;

/** Every digit of one size — the candidate set of an untouched cell. */
export const allCandidates = (size: Size): number => (1 << size) - 1;

export function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m !== 0; m &= m - 1) n++;
  return n;
}

/** The digits in a mask, ascending. */
export function digitsOf(mask: number): Digit[] {
  const out: Digit[] = [];
  for (let digit = 1; digit <= 7; digit++) if (hasBit(mask, digit)) out.push(digit as Digit);
  return out;
}

/** The single digit in a one-bit mask, or null. */
export function soleDigit(mask: number): Digit | null {
  return popcount(mask) === 1 ? ((32 - Math.clz32(mask)) as Digit) : null;
}

/** The smallest digit a mask allows, or 0 for an empty mask. */
export const lowestDigit = (mask: number): number =>
  mask === 0 ? 0 : 32 - Math.clz32(mask & -mask);

/** The largest digit a mask allows, or 0 for an empty mask. */
export const highestDigit = (mask: number): number => (mask === 0 ? 0 : 32 - Math.clz32(mask));

/** One row or column, named the way a hint has to name it (§6). */
export interface Line {
  readonly axis: 'row' | 'col';
  readonly index: number;
}

/**
 * One inequality sign (§1, §3), stored as the answer to the only question the
 * rules ever ask of it: which of the two cells holds the smaller digit.
 *
 * The alternative — a cell pair plus a direction — would carry the same
 * information one indirection further away, and every reader (the solver's
 * propagation, the violation check, the fail-closed save validation) would
 * have to decode the direction before it could say anything. `less` and
 * `greater` are already the statement `board[less] < board[greater]`.
 *
 * The two cells are always orthogonally adjacent; `isConstraint` is what
 * enforces that on data arriving from a save.
 */
export interface Constraint {
  readonly less: number;
  readonly greater: number;
}

/** The pair in reading order: the upper-left cell first. */
export const constraintCells = (constraint: Constraint): readonly [number, number] =>
  constraint.less < constraint.greater
    ? [constraint.less, constraint.greater]
    : [constraint.greater, constraint.less];

/**
 * Which gap the sign is drawn in: 'row' between two side-by-side cells, 'col'
 * between two stacked ones. Null when the pair is not adjacent at all, which
 * only a corrupt save can produce (§11).
 */
export function constraintAxis(constraint: Constraint, size: Size): 'row' | 'col' | null {
  const [first, second] = constraintCells(constraint);
  if (first < 0 || second >= cellCount(size)) return null;
  if (second - first === 1 && rowOf(first, size) === rowOf(second, size)) return 'row';
  if (second - first === size) return 'col';
  return null;
}

/**
 * The character drawn in the gap, read left-to-right or top-to-bottom: '<'
 * when the first cell of the pair is the smaller one (§1). The board never
 * carries a translatable glyph — these two are ASCII in every language
 * (docs/I18N_POLICY.md).
 */
export const constraintSymbol = (constraint: Constraint): '<' | '>' =>
  constraint.less < constraint.greater ? '<' : '>';

/** Structural validation of one sign: two adjacent cells on the board (§11). */
export function isConstraint(value: unknown, size: Size): value is Constraint {
  if (typeof value !== 'object' || value === null) return false;
  const { less, greater } = value as { less: unknown; greater: unknown };
  if (!Number.isInteger(less) || !Number.isInteger(greater)) return false;
  const cells = cellCount(size);
  if ((less as number) < 0 || (less as number) >= cells) return false;
  if ((greater as number) < 0 || (greater as number) >= cells) return false;
  return constraintAxis({ less: less as number, greater: greater as number }, size) !== null;
}

export type GameMode = 'level' | 'daily';

/** There is no losing a Futoshiki — no mistake limit, no lives (§2, §14). */
export type GameStatus = 'playing' | 'solved';

/**
 * Structural validation for the fail-closed save loading of §11: right length,
 * and nothing in it that play could not have written. The rules themselves are
 * checked separately (engine.ts) — this is only the shape.
 */
export function isValidGrid(value: unknown, size: Size): value is number[] {
  if (!Array.isArray(value) || value.length !== cellCount(size)) return false;
  return value.every(
    (cell) => Number.isInteger(cell) && (cell as number) >= EMPTY && (cell as number) <= size,
  );
}

/** A grid with every cell written — what a solution has to be (§8). */
export function isFilledGrid(value: unknown, size: Size): value is number[] {
  return isValidGrid(value, size) && value.every((cell) => cell !== EMPTY);
}

/** Note masks: one per cell, and never a bit for a digit this size has not got. */
export function isValidNotes(value: unknown, size: Size): value is number[] {
  if (!Array.isArray(value) || value.length !== cellCount(size)) return false;
  return value.every(
    (mask) =>
      Number.isInteger(mask) && (mask as number) >= 0 && (mask as number) <= allCandidates(size),
  );
}
