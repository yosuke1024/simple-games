/**
 * Core Kakuro types. See docs/KAKURO_RULES.md — the single source of truth for
 * the rules these shapes serve.
 *
 * A board is one row-major flat array addressed by a single index, never by a
 * pair, so the solver and the generator keep their hot loops on flat arrays.
 * Unlike Takuzu and Futoshiki a Kakuro board is not intrinsically square — the
 * grid is W×H and the layout carries both numbers — even though all three
 * shipped sizes happen to be square (§1). Writing the general shape costs one
 * extra field and buys run extraction that has no squareness baked into it,
 * which is the one place a wrong assumption would be invisible until a run ran
 * off the end of a row.
 *
 * Candidate sets are 9-bit masks (bit 0 = digit 1). Digits are always 1..9 at
 * every size (§3), so the mask width is a constant rather than a function of
 * the board — which is what lets the partition table of solver.ts be computed
 * once for the whole game instead of once per size.
 *
 * There is no difficulty type, and that is a measurement rather than a
 * preference. Sudoku §6's rule is that a tier is only honest when it names a
 * set of ALLOWED techniques, and every Kakuro this game ships allows the same
 * six (§7): the fixed partition, the intersection, the two singles, the naked
 * pair and the sum tightening. What moves between levels is the board size and
 * how finely the layout is chopped into runs — two numbers on a continuum,
 * interpolated inside a band (levels.ts). A tier enum here would name the same
 * technique set at every level, which is a label with nothing behind it.
 *
 * `guarantee.test.ts` counts which of the six the shipped boards actually
 * need, for the same reason Futoshiki's does: a tier that allowed a technique
 * almost no board asks for would be a promise about nothing.
 */

/**
 * What a cell is (§1). Two kinds and no third: a clue cell may or may not
 * carry a sum, but "carries nothing" is a property of the runs around it, not
 * a separate kind — a spacer and a two-sum clue cell are drawn differently and
 * behave identically, so making the difference a kind would put derived
 * information in the layout where it could drift from the runs.
 */
export type CellKind = 0 | 1;
export const BLOCK: CellKind = 0;
export const WHITE: CellKind = 1;

/**
 * The three board sizes (§1), as the full outside dimension — clue cells
 * included, which is what a player counts when they look at the grid.
 *
 * Every run needs a clue cell in front of it, so the top row and the left
 * column are always clue cells and the playable interior is (n−1)×(n−1): 25
 * cells at 6×6, 49 at 8×8, 81 at 10×10. That is also why 10 is the ceiling and
 * not an arbitrary one — a run may hold at most 9 cells because the digits
 * 1..9 may not repeat inside it (§3), and 10 minus the clue column is exactly
 * 9. An 11-wide board would admit a row that cannot legally be filled at all.
 *
 * The floor is 6 for the opposite reason: at 5×5 the interior is 4×4 and, with
 * every run at least 2 long, there is almost nothing left to choose — the
 * layouts collapse onto each other and the levels stop being different
 * puzzles.
 */
export type Size = 6 | 8 | 10;
export const SIZES: readonly Size[] = [6, 8, 10];

export const isSize = (value: unknown): value is Size => value === 6 || value === 8 || value === 10;

/** A written digit. Always 1..9, at every size (§3). */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** An empty white cell — and what a clue cell always holds. Never a digit. */
export const EMPTY = 0;

/** Every digit — the candidate set of an untouched white cell. */
export const ALL_DIGITS = 0b1_1111_1111;

/** The longest a run may be: nine cells, nine digits, none repeated (§3). */
export const MAX_RUN = 9;

/** The shortest a run may be. A one-cell run would be a given, not a puzzle. */
export const MIN_RUN = 2;

export const bitOf = (digit: number): number => 1 << (digit - 1);
export const hasBit = (mask: number, digit: number): boolean => (mask & bitOf(digit)) !== 0;

export function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m !== 0; m &= m - 1) n++;
  return n;
}

/** The digits in a mask, ascending. */
export function digitsOf(mask: number): Digit[] {
  const out: Digit[] = [];
  for (let digit = 1; digit <= 9; digit++) if (hasBit(mask, digit)) out.push(digit as Digit);
  return out;
}

/** The single digit in a one-bit mask, or null. */
export function soleDigit(mask: number): Digit | null {
  return popcount(mask) === 1 ? ((32 - Math.clz32(mask)) as Digit) : null;
}

/**
 * The shape of the board (§1): which cells the player writes in and which
 * carry the sums.
 *
 * The clue numbers are deliberately NOT here. A clue is the sum of the run
 * behind it, so it is a fact about the layout plus the answer, and storing it
 * would create a second copy that can disagree with the first. Nonogram makes
 * the same call about its line clues and §11 makes it again about the save
 * format: layout and solution are persisted, clues are recomputed, and a clue
 * that drifted is therefore not a state this game can reach. `buildRuns`
 * (engine.ts) is the one place the two are put together.
 */
export interface Layout {
  readonly width: number;
  readonly height: number;
  /** Row-major, `width * height` long. */
  readonly cells: readonly CellKind[];
}

export const cellCount = (layout: Layout): number => layout.width * layout.height;
export const rowOf = (index: number, width: number): number => Math.floor(index / width);
export const colOf = (index: number, width: number): number => index % width;
export const indexOf = (row: number, col: number, width: number): number => row * width + col;

export const isWhite = (layout: Layout, index: number): boolean => layout.cells[index] === WHITE;

/**
 * One run without its number: where it is, and which cells it covers.
 *
 * This is what the layout alone can say. The generator needs exactly this much
 * before it has an answer to add up — it fills the board run by run — which is
 * why the shape exists separately from `Run` rather than a `Run` with a zero
 * in the sum. A zero sum is not a run whose sum is unknown; it is a run no
 * legal board can have, and a type that can express it invites a caller to
 * read one.
 *
 * `clue` is the index of the cell the number is drawn in — the cell to the
 * left of a horizontal run or above a vertical one. A run stores it rather
 * than letting the UI work it back out, because the Hint highlights the clue
 * as the justification for its sentence ("this row is 16 across two cells, so
 * it can only be 7 and 9" — §6), and the run is what the Hint is handed.
 */
export interface RunShape {
  readonly axis: 'row' | 'col';
  /** The clue cell carrying this run's sum. */
  readonly clue: number;
  /** The white cells, in reading order — left to right, or top to bottom. */
  readonly cells: readonly number[];
}

/**
 * One run: the white cells that must hold distinct digits adding up to one
 * clue (§3). A `RunShape` with the number the answer puts on it.
 */
export interface Run extends RunShape {
  /** The number drawn in the clue cell: the sum of `cells` in the answer. */
  readonly sum: number;
}

/**
 * Every run of one board, plus the two lookups the solver spends its whole
 * life in: from a white cell to the horizontal run it belongs to, and to the
 * vertical one.
 *
 * Every white cell belongs to exactly one of each (§1), so both lookups are
 * plain arrays with one slot per cell and −1 in the clue cells. The
 * alternative — searching the run list for the cell — would put a scan inside
 * the intersection technique, which is the technique that runs most often.
 */
export interface RunGeometry {
  readonly shapes: readonly RunShape[];
  /** Index into `shapes` of the horizontal run through each cell; −1 elsewhere. */
  readonly rowRun: readonly number[];
  /** Index into `shapes` of the vertical run through each cell; −1 elsewhere. */
  readonly colRun: readonly number[];
  /** Every white cell, in reading order — what "fill the board" iterates. */
  readonly white: readonly number[];
}

/** The geometry with every sum filled in: what a game is actually played on. */
export interface RunTable extends Omit<RunGeometry, 'shapes'> {
  readonly runs: readonly Run[];
}

/** The two numbers a clue cell may carry (§1). Null where it carries none. */
export interface Clue {
  /** The sum of the horizontal run starting one cell to the right. */
  readonly right: number | null;
  /** The sum of the vertical run starting one cell below. */
  readonly down: number | null;
}

export type GameMode = 'level' | 'daily';

/** There is no losing a Kakuro — no mistake limit, no lives (§2, §14). */
export type GameStatus = 'playing' | 'solved';

/**
 * Structural validation of a layout for the fail-closed save loading of §11.
 *
 * This is the shape only: right length, right alphabet. Whether the white
 * cells actually split into legal runs is a separate and much stronger
 * question, and `runGeometry` (engine.ts) is what answers it — a layout can be
 * perfectly well-formed here and still be unplayable because one white cell
 * sits alone in its column.
 */
export function isValidLayout(value: unknown, size: Size): value is Layout {
  if (typeof value !== 'object' || value === null) return false;
  const { width, height, cells } = value as Partial<Layout>;
  if (width !== size || height !== size) return false;
  if (!Array.isArray(cells) || cells.length !== size * size) return false;
  return cells.every((cell) => cell === BLOCK || cell === WHITE);
}

/**
 * Structural validation of a grid of digits: right length, and nothing in it
 * that play could not have written — a digit 1..9 in a white cell, nothing at
 * all in a clue cell (§11). The rules themselves are checked separately.
 */
export function isValidGrid(value: unknown, layout: Layout): value is number[] {
  if (!Array.isArray(value) || value.length !== cellCount(layout)) return false;
  return value.every((cell, index) => {
    if (!Number.isInteger(cell)) return false;
    if (!isWhite(layout, index)) return cell === EMPTY;
    return (cell as number) >= EMPTY && (cell as number) <= 9;
  });
}

/** A grid with every white cell written — what a solution has to be (§8). */
export function isFilledGrid(value: unknown, layout: Layout): value is number[] {
  return (
    isValidGrid(value, layout) &&
    value.every((cell, index) => !isWhite(layout, index) || cell !== EMPTY)
  );
}

/** Note masks: one per cell, never a bit outside 1..9, never on a clue cell. */
export function isValidNotes(value: unknown, layout: Layout): value is number[] {
  if (!Array.isArray(value) || value.length !== cellCount(layout)) return false;
  return value.every((mask, index) => {
    if (!Number.isInteger(mask) || (mask as number) < 0 || (mask as number) > ALL_DIGITS) {
      return false;
    }
    return isWhite(layout, index) || mask === 0;
  });
}
