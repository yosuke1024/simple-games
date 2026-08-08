/**
 * Board generation — implements docs/KAKURO_RULES.md §8.
 *
 * Four steps, and the third one is the hard one.
 *
 * 1. **The layout.** Start from the only shape that is always legal — the top
 *    row and left column are clue cells, everything else is white — and add
 *    clue cells in a seed-shuffled order, keeping each step only while the
 *    board is still a Kakuro: no run shorter than two or longer than nine on
 *    either axis, and the white cells still one connected region (§1). Because
 *    the starting shape is legal and no step may leave it, the layout that
 *    comes out is legal by construction — there is no repair pass, and no way
 *    to reach a board that has to be thrown away for its shape alone.
 * 2. **The fill.** Write digits into the white cells by backtracking in
 *    reading order, each cell drawing from what its two runs have not used, in
 *    a seed-shuffled digit order.
 * 3. **The tightening.** Change digits, one white cell at a time, until the
 *    techniques of §7 settle the whole board. This is the step that makes a
 *    Kakuro a puzzle rather than a grid — see `tighten`.
 * 4. **The clues.** Add each run up. This cannot fail and cannot disagree with
 *    the answer, which is the whole reason clues are never stored (§11).
 *
 * Then the gate: the technique solver (§7) must settle every cell starting
 * from a completely empty board. A Kakuro hands the player no digits, so there
 * is nothing to dig — the only two dials are the size and how finely the
 * layout is chopped, and a candidate either passes the gate or is thrown away.
 * A candidate that fails costs one derived seed and another try (`<seed>#2`,
 * `#3`, …), the same shape Nonogram §5 uses.
 *
 * The gate on all of this is work, never wall clock — see `solverWork`.
 */
import { buildRuns, runGeometry } from './engine';
import { createRng, shuffled } from './rng';
import { isFullyDetermined, solve, solverWork } from './solver';
import {
  ALL_DIGITS,
  BLOCK,
  DIGITS,
  EMPTY,
  WHITE,
  bitOf,
  cellCount,
  colOf,
  hasBit,
  rowOf,
  type CellKind,
  type Layout,
  type RunGeometry,
  type RunTable,
  type Size,
} from './types';

/** Derived seeds tried before giving up on a seed altogether (§8). */
export const ATTEMPT_LIMIT = 24;

/**
 * After this many derived seeds at the exact target, each further attempt
 * chops the layout one cell finer (§8).
 *
 * A Kakuro cannot fall back the way its siblings do. Takuzu and Futoshiki dig
 * givens out of a finished board, so "stop digging early" is always available
 * and always ships a real puzzle. Here there is nothing to dig: a board the
 * techniques cannot settle is not an easier puzzle, it is a puzzle that might
 * need a guess, and shipping one would break §7 outright. So the relief valve
 * moves the other dial instead — one more clue cell makes the runs shorter,
 * which makes the partition table say more, which is exactly what the solver
 * was short of. The board that ships is easier than its band asked for, which
 * is the one failure worth shipping (Nonogram §5, Takuzu §6).
 */
export const RELIEF_AFTER = 12;

/**
 * Digit placements the fill backtracker may try before giving up on a seed.
 * Measured worst case across every level and daily is well inside four
 * figures, so this only exists to keep a pathological layout from spinning.
 */
export const SEARCH_LIMIT = 60_000;

/**
 * Digit changes `tighten` may make before a candidate is abandoned (§8).
 *
 * Measured across every level and daily this game ships, a board that gets
 * there gets there in tens of steps, not hundreds — so a seed still climbing
 * at this point is one whose layout the techniques are not going to finish,
 * and a fresh derived seed is a better use of the next hundred solves than
 * more of this one. Raising it buys a slightly higher first-attempt rate for a
 * much higher worst case, which is the wrong trade for a gate measured on its
 * worst board.
 */
export const CLIMB_LIMIT = 400;

/**
 * Passes the layout maker takes over its candidate list.
 *
 * One pass is not always enough to reach the target, and not because the
 * shuffle was unlucky: whether a cell may become a clue cell depends on what
 * is around it, so a cell refused early — its row segment would have split
 * into a 1 and a 4 — can become legal after a neighbour is taken. Three passes
 * reach the target on every band this game ships; a fourth changed nothing in
 * the measurement, so the extra sweep would be work with no puzzle behind it.
 */
const LAYOUT_PASSES = 3;

/**
 * Cells one blocking step may strand before the step is abandoned.
 *
 * A cascade this long means the step is cutting across a crowded part of the
 * board, and the layout it would leave is one long thin corridor rather than a
 * Kakuro. Refusing it costs one candidate cell; the pass simply moves on.
 */
const MAX_GROUP = 6;

/**
 * What a level asks generation for (§9). One number, because after the size
 * there is only one dial: how many of the interior cells are clue cells. More
 * of them means shorter runs, and shorter runs mean the combination table says
 * more about each one — which is the whole of what makes an easy Kakuro easy.
 */
export interface PuzzleSpec {
  /** Interior cells to turn into clue cells. A target, not a promise (§8). */
  readonly blocks: number;
}

export interface GeneratedPuzzle {
  readonly size: Size;
  readonly layout: Layout;
  /** The digits, 0 in every clue cell (§1). */
  readonly solution: readonly number[];
  /** The runs with their clues — recomputed, never stored (§11). */
  readonly table: RunTable;
  /** Interior clue cells the layout ended up with. */
  readonly blockCount: number;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Reads the solver spent building this puzzle: the budgeted work of §8. */
  readonly work: number;
  /** True when the relief valve chopped the layout finer than asked (§8). */
  readonly fallback: boolean;
}

/** The cells a layout may turn into clue cells: everything but the two rails. */
export function interiorCells(width: number, height: number): number[] {
  const out: number[] = [];
  for (let index = 0; index < width * height; index++) {
    if (rowOf(index, width) > 0 && colOf(index, width) > 0) out.push(index);
  }
  return out;
}

/**
 * A white cell left alone in one of its runs — the only shape a clue cell can
 * strand, and the reason a step is a group rather than a single cell.
 *
 * Returns the first one found, or −1. Both axes are swept, because blocking a
 * cell shortens one row segment and one column segment at once.
 */
function strandedWhite(layout: Layout): number {
  const { width, height, cells } = layout;
  const sweep = (length: number, step: number, origin: (line: number) => number): number => {
    for (let line = 0; line < length; line++) {
      let start = -1;
      let run = 0;
      for (let k = 0; k <= (step === 1 ? width : height); k++) {
        const at = origin(line) + k * step;
        const white = k < (step === 1 ? width : height) && cells[at] === WHITE;
        if (white) {
          if (run === 0) start = at;
          run++;
          continue;
        }
        if (run === 1) return start;
        run = 0;
      }
    }
    return -1;
  };
  const inRow = sweep(height, 1, (line) => line * width);
  return inRow >= 0 ? inRow : sweep(width, width, (line) => line);
}

/**
 * Cells one step may take: `index`, plus whatever it strands.
 *
 * **This is a group and not a single cell, and that is the whole difference
 * between a dial and a plateau.** A step that may only ever add one clue cell
 * is monotone, so it can never accept a cell that momentarily leaves a
 * neighbour alone in its run — even when blocking that neighbour too would
 * leave a perfectly legal board. Measured, the one-cell version froze at about
 * a third of the interior on every size and refused to go further: at 6×6 it
 * reached 8 of 25 whatever it was asked for, which is a difficulty dial two
 * cells wide across twenty levels. Taking the stranded cells with it reaches
 * the count it is asked for on all three sizes.
 *
 * Null when the cascade does not settle inside its budget, which is the same
 * answer as "this step is not worth taking" — the caller reverts either way.
 */
function blockGroup(layout: Layout, index: number): number | null {
  const cells = layout.cells as CellKind[];
  cells[index] = BLOCK;
  let taken = 1;
  for (let round = 0; round < MAX_GROUP; round++) {
    const stranded = strandedWhite(layout);
    if (stranded < 0) return taken;
    cells[stranded] = BLOCK;
    taken++;
  }
  return null;
}

/**
 * A legal layout with about `blocks` interior clue cells (§8).
 *
 * The result is legal whatever happens, because the loop can only ever refuse
 * a step: every accepted step is re-read by `runGeometry`, which is the one
 * function in this game that decides whether a grid is a Kakuro at all (§1).
 * What the loop cannot promise is the count — a board can simply run out of
 * cells whose removal keeps every run at least two long. Callers read
 * `blockCount` off the finished puzzle rather than assuming the target.
 *
 * A step that would overshoot the target is refused rather than trimmed. A
 * group is only legal whole, so taking half of one would be exactly the
 * stranded run the group exists to avoid.
 */
export function generateLayout(
  seed: string,
  width: number,
  height: number,
  blocks: number,
): Layout {
  const cells: CellKind[] = Array.from({ length: width * height }, (_, index) =>
    rowOf(index, width) === 0 || colOf(index, width) === 0 ? BLOCK : WHITE,
  );
  const layout: Layout = { width, height, cells };
  const target = Math.max(0, Math.floor(blocks));
  const order = shuffled(interiorCells(width, height), createRng(`${seed}-layout`));
  let placed = 0;

  for (let pass = 0; pass < LAYOUT_PASSES && placed < target; pass++) {
    let added = 0;
    for (const index of order) {
      if (placed >= target) break;
      if (cells[index] !== WHITE) continue;
      const before = [...cells];
      const taken = blockGroup(layout, index);
      if (taken !== null && placed + taken <= target && runGeometry(layout) !== null) {
        placed += taken;
        added += taken;
      } else {
        for (let at = 0; at < cells.length; at++) cells[at] = before[at]!;
      }
    }
    if (added === 0) break;
  }

  return { width, height, cells: [...cells] };
}

/**
 * Digits for every white cell, or null when the search budget runs out.
 *
 * Reading-order backtracking with a seed-shuffled digit order at every cell.
 * The only rule that applies while filling is §3's no-repeat, tracked as one
 * mask per run so the legality test is a single AND — the sums are whatever
 * the finished board says they are, which is why this step cannot fail for
 * reasons of arithmetic.
 */
export function fillLayout(seed: string, layout: Layout, geometry: RunGeometry): number[] | null {
  const rng = createRng(`${seed}-fill`);
  const values = new Array<number>(cellCount(layout)).fill(EMPTY);
  const used = new Array<number>(geometry.shapes.length).fill(0);
  const { white, rowRun, colRun } = geometry;
  let searched = 0;

  const fill = (position: number): boolean => {
    if (position === white.length) return true;
    const index = white[position]!;
    const row = rowRun[index]!;
    const col = colRun[index]!;
    const open = ALL_DIGITS & ~used[row]! & ~used[col]!;

    for (const digit of shuffled(DIGITS, rng)) {
      const bit = bitOf(digit);
      if ((open & bit) === 0) continue;
      if (++searched > SEARCH_LIMIT) return false;

      values[index] = digit;
      used[row]! |= bit;
      used[col]! |= bit;
      if (fill(position + 1)) return true;
      values[index] = EMPTY;
      used[row]! &= ~bit;
      used[col]! &= ~bit;
    }
    return false;
  };

  return fill(0) ? values : null;
}

/**
 * Digits that the techniques of §7 can actually settle, starting from the fill
 * — or null when this layout and this seed do not get there.
 *
 * **This is the step that makes a Kakuro a puzzle, and it has no counterpart
 * in the three siblings.** Sudoku, Takuzu and Futoshiki start from a finished
 * board that is already the only answer and take digits away until it stops
 * being so. Kakuro has nothing to take away — the clues are the whole of the
 * puzzle (§1) — so the question is not "how much can I remove" but "is this
 * particular answer the only one its own sums admit". Measured over 200 random
 * fills per layout at every size and density this game ships, it almost never
 * is: at 6×6 about one fill in a hundred, and at 8×8 and 10×10 none at all.
 * That is not a weakness of the solver. Counting the fillings by brute force
 * over the same boards gives the same figure — the fills that have exactly one
 * solution and the fills the six techniques finish are the *same* fills, so
 * the solver is already reading everything the clues say, and what is missing
 * is a reason for the sums to be worth reading.
 *
 * So the sums are chosen rather than accepted. A clue is the sum of its run
 * (§8 step 4), so changing one digit re-writes two clues and leaves a board
 * that is still legal by construction — no repair, no rejection, every
 * neighbour of a fill is another fill. That makes the fills a search space
 * with a free move, and the score is the one number that matters: how many
 * cells the techniques settle from an empty board. Take a cell they could not
 * settle, give it another digit its two runs still allow, keep the change
 * unless it settles fewer. Every accepted board is a board the techniques
 * finish, so the §7 promise is not weakened by any of this — the gate in
 * `generatePuzzle` is still run, and still the only thing that decides.
 *
 * The step limit is what keeps a hopeless layout from spinning; the loop is a
 * hill climb, so it has no other stopping rule. A seed that runs out costs a
 * derived seed, which is the same price every other failure here costs.
 */
export function tighten(
  seed: string,
  layout: Layout,
  geometry: RunGeometry,
  fill: readonly number[],
): number[] | null {
  const rng = createRng(`${seed}-tighten`);
  const values = [...fill];
  const empty = new Array<number>(cellCount(layout)).fill(EMPTY);
  const { shapes, rowRun, colRun, white } = geometry;

  /** The white cells the techniques leave empty — the score, and the moves. */
  const unsettled = (): number[] => {
    const table = buildRuns(layout, values);
    if (table === null) return [...white];
    const result = solve(empty, table);
    // A contradiction is worse than any stuck board: score it as the whole
    // grid so the climb always steps back off it.
    if (result.contradiction) return [...white];
    return white.filter((index) => result.entries[index] === EMPTY);
  };

  let stuck = unsettled();
  for (let step = 0; step < CLIMB_LIMIT; step++) {
    if (stuck.length === 0) return values;

    const index = stuck[Math.floor(rng() * stuck.length)]!;
    const row = shapes[rowRun[index]!]!;
    const col = shapes[colRun[index]!]!;
    let used = 0;
    for (const peer of row.cells) if (peer !== index) used |= bitOf(values[peer]!);
    for (const peer of col.cells) if (peer !== index) used |= bitOf(values[peer]!);

    const options: number[] = [];
    for (const digit of DIGITS) {
      if (!hasBit(used, digit) && digit !== values[index]) options.push(digit);
    }
    if (options.length === 0) continue;

    const previous = values[index]!;
    values[index] = options[Math.floor(rng() * options.length)]!;
    const next = unsettled();
    if (next.length > stuck.length) values[index] = previous;
    else stuck = next;
  }

  return stuck.length === 0 ? values : null;
}

/**
 * The same seed always returns the same puzzle (§8): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the puzzle that ships is a
 * pure function of the seed, the size and the spec alone.
 *
 * The block count is a target, not a promise about this board. Once the first
 * `RELIEF_AFTER` derived seeds have failed the gate, each further attempt asks
 * for one more clue cell, and a board that ships that way carries `fallback`
 * (§8). Tests watch the rate — it is zero across every level and daily today.
 */
export function generatePuzzle(seed: string, size: Size, spec: PuzzleSpec): GeneratedPuzzle {
  const before = solverWork.read();
  const target = Math.max(0, Math.floor(spec.blocks));

  for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const blocks = target + Math.max(0, attempt - RELIEF_AFTER);
    const layout = generateLayout(derived, size, size, blocks);
    const geometry = runGeometry(layout);
    if (geometry === null) continue;

    const fill = fillLayout(derived, layout, geometry);
    if (fill === null) continue;

    const solution = tighten(derived, layout, geometry, fill);
    if (solution === null) continue;

    const table = buildRuns(layout, solution);
    if (table === null) continue;

    const empty = new Array<number>(cellCount(layout)).fill(EMPTY);
    if (!isFullyDetermined(empty, table)) continue;

    return {
      size,
      layout,
      solution,
      table,
      blockCount: layout.cells.reduce<number>(
        (sum, kind, index) =>
          sum + (kind === BLOCK && rowOf(index, size) > 0 && colOf(index, size) > 0 ? 1 : 0),
        0,
      ),
      attempts: attempt,
      work: solverWork.read() - before,
      fallback: blocks > target,
    };
  }

  // Unlike its siblings there is no degraded board to ship here: every
  // candidate that reached this point was rejected because the techniques
  // could not settle it, and handing one to a player would break the no-guess
  // promise of §7 outright. The relief valve above is the graceful failure;
  // reaching this line means 24 derived seeds — the last twelve of them
  // progressively easier — all failed, which cannot happen for a legal size
  // and would mean this file is broken. `guarantee.test.ts` walks every board
  // this game ships, so the throw is a statement about impossible input, not a
  // risk taken with a player's session.
  throw new Error(`kakuro: no ${size}x${size} board after ${ATTEMPT_LIMIT} seeds from "${seed}"`);
}
