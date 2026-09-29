/**
 * The two solvers of docs/BINARY_BALANCE_RULES.md §5–§7, and the hint of §8.
 *
 * The human-technique solver has five techniques, cheapest first: pair-gap
 * (T1), line-count (T2), link (T3), line-completion (T4) and a depth-one
 * hypothesis (T5). Every one is sound: it only ever writes a mark that every
 * legal completion of the board agrees on. So a board the techniques finish
 * has exactly one solution, and the tier a board is graded at (§7) is the
 * smallest technique set that finishes it.
 *
 * The counting solver is a plain row-by-row search that stops at the second
 * solution. It is the ground truth for uniqueness during generation (§6):
 * the technique solver is checked against it, never trusted instead of it.
 *
 * One implementation, three callers that must agree — the generator's grader,
 * the hint, and guarantee.test.ts (§5). Work is counted, never timed
 * (`solverWork`): the same seed always costs the same number of steps on any
 * machine, which is what makes the §6 budget assertable.
 *
 * Takuzu's third rule (no two lines alike) is not here and must never be
 * (§3, §14): the set of legal completions would change under it.
 */
import { findViolations, lineOfLink } from './engine';
import {
  EMPTY,
  SQUARE,
  CIRCLE,
  cellCount,
  halfLine,
  isWritten,
  linkOther,
  other,
  type Cell,
  type Difficulty,
  type Line,
  type Link,
  type Mark,
  type Size,
} from './types';

/** The five techniques, cheapest first (§7). Names never reach the screen. */
export type Technique = 'pair-gap' | 'line-count' | 'link' | 'line-completion' | 'hypothesis';

const ORDER: readonly Technique[] = [
  'pair-gap',
  'line-count',
  'link',
  'line-completion',
  'hypothesis',
];

/** The technique set of each tier (§7). Each is a prefix of the next. */
export const TIER_TECHNIQUES: Record<Difficulty, readonly Technique[]> = {
  easy: ['pair-gap', 'line-count', 'link'],
  medium: ['pair-gap', 'line-count', 'link', 'line-completion'],
  hard: ['pair-gap', 'line-count', 'link', 'line-completion', 'hypothesis'],
};

/** One cell proved, with everything the hint needs to explain it (§8). */
export interface SolveStep {
  /** Row-major index of the cell this proves. */
  readonly index: number;
  readonly value: Cell;
  readonly technique: Technique;
  /** The row or column the deduction was read off. */
  readonly line: Line;
  /**
   * The written cells that carry the proof — what a hint tints: T1's pair,
   * T2's half-line of one mark, T3's other end, T4's written line. Empty for
   * T5, whose proof is the chain it tried.
   */
  readonly support: readonly number[];
  /** The link T3 read (its index in the puzzle's link list), else null. */
  readonly link: number | null;
}

// ---------- work ----------

/**
 * Steps taken since the last reset — the unit generation is budgeted in (§6):
 * one per line (or link) a technique reads, per line completion T4 tests, per
 * hypothesis T5 tries, and per node the counting solver visits. Nothing at
 * runtime reads it; it costs one integer increment per step.
 */
let work = 0;

export const solverWork = {
  read: (): number => work,
  reset: (): void => {
    work = 0;
  },
};

// ---------- the legal-line alphabet ----------

const alphabets = new Map<number, readonly number[]>();

/**
 * Every legal line of one size as a bit pattern (bit c set = a square in
 * position c): half squares, no three alike in a row — 14 patterns at 6 wide
 * (§6). Enumerated over the 2^size patterns once per size.
 */
export function legalMasks(size: number): readonly number[] {
  const cached = alphabets.get(size);
  if (cached !== undefined) return cached;
  const half = halfLine(size);
  const out: number[] = [];
  for (let bits = 0; bits < 1 << size; bits++) {
    let ones = 0;
    let run = 1;
    let legal = true;
    for (let i = 0; i < size; i++) {
      const value = (bits >> i) & 1;
      ones += value;
      if (i > 0) run = ((bits >> (i - 1)) & 1) === value ? run + 1 : 1;
      if (run >= 3) {
        legal = false;
        break;
      }
    }
    if (legal && ones === half) out.push(bits);
  }
  alphabets.set(size, out);
  return out;
}

/** The legal-line alphabet as cell arrays, for callers that read lines, not bits. */
export function legalLines(size: Size): (readonly Cell[])[] {
  return legalMasks(size).map((bits) =>
    Array.from({ length: size }, (_, i) => (((bits >> i) & 1) === 1 ? SQUARE : CIRCLE)),
  );
}

// ---------- layout ----------

interface CellLink {
  readonly other: number;
  readonly same: boolean;
  readonly link: number;
}

/** A link with both ends inside one line, as positions along it. */
interface InnerLink {
  readonly a: number;
  readonly b: number;
  readonly same: boolean;
}

/** A link from a position on a line to a cell off it. */
interface OuterLink {
  readonly pos: number;
  readonly other: number;
  readonly same: boolean;
}

/**
 * The fixed geometry of one puzzle: its 2N lines (rows, then columns), the
 * links at each cell, and the links each line sees inside and outside itself.
 * Built once per puzzle and shared by every board derived from it.
 */
export interface Layout {
  readonly size: Size;
  readonly half: number;
  readonly links: readonly Link[];
  readonly lines: readonly Line[];
  readonly lineCells: readonly (readonly number[])[];
  readonly cellLinks: readonly (readonly CellLink[])[];
  readonly innerLinks: readonly (readonly InnerLink[])[];
  readonly outerLinks: readonly (readonly OuterLink[])[];
}

export function buildLayout(links: readonly Link[], size: Size): Layout {
  const lines: Line[] = [];
  const lineCells: number[][] = [];
  for (let index = 0; index < size; index++) {
    lines.push({ axis: 'row', index });
    lineCells.push(Array.from({ length: size }, (_, col) => index * size + col));
  }
  for (let index = 0; index < size; index++) {
    lines.push({ axis: 'col', index });
    lineCells.push(Array.from({ length: size }, (_, row) => row * size + index));
  }

  const cellLinks: CellLink[][] = Array.from({ length: cellCount(size) }, () => []);
  const innerLinks: InnerLink[][] = lines.map(() => []);
  const outerLinks: OuterLink[][] = lines.map(() => []);

  links.forEach((link, k) => {
    const a = link.index;
    const b = linkOther(link, size);
    cellLinks[a]!.push({ other: b, same: link.same, link: k });
    cellLinks[b]!.push({ other: a, same: link.same, link: k });
    const rowA = Math.floor(a / size);
    const colA = a % size;
    if (link.dir === 'h') {
      innerLinks[rowA]!.push({ a: colA, b: colA + 1, same: link.same });
      outerLinks[size + colA]!.push({ pos: rowA, other: b, same: link.same });
      outerLinks[size + colA + 1]!.push({ pos: rowA, other: a, same: link.same });
    } else {
      innerLinks[size + colA]!.push({ a: rowA, b: rowA + 1, same: link.same });
      outerLinks[rowA]!.push({ pos: colA, other: b, same: link.same });
      outerLinks[rowA + 1]!.push({ pos: colA, other: a, same: link.same });
    }
  });

  return {
    size,
    half: halfLine(size),
    links,
    lines,
    lineCells,
    cellLinks,
    innerLinks,
    outerLinks,
  };
}

// ---------- the techniques ----------

/** A sweep's result: the steps it found, or proof the board cannot be finished. */
type Sweep = SolveStep[] | 'contradiction';

/**
 * T1 — the pair and the gap (§7). Inside any three neighbouring cells, two
 * equal marks and one empty leave the empty one no choice: the matching mark
 * would be three in a row. `○ ○ _`, `_ ○ ○` and `○ _ ○` are the same rule.
 */
function pairGapSteps(board: readonly Mark[], layout: Layout, firstOnly: boolean): Sweep {
  const { size, lines, lineCells } = layout;
  const out: SolveStep[] = [];
  for (let k = 0; k < lines.length; k++) {
    work++;
    const cells = lineCells[k]!;
    for (let i = 0; i + 2 < size; i++) {
      const first = cells[i]!;
      const middle = cells[i + 1]!;
      const last = cells[i + 2]!;
      const a = board[first]!;
      const b = board[middle]!;
      const c = board[last]!;
      let hole: number;
      let pair: readonly number[];
      let mark: Cell;
      if (a === EMPTY && isWritten(b) && b === c) {
        hole = first;
        pair = [middle, last];
        mark = b;
      } else if (b === EMPTY && isWritten(a) && a === c) {
        hole = middle;
        pair = [first, last];
        mark = a;
      } else if (c === EMPTY && isWritten(a) && a === b) {
        hole = last;
        pair = [first, middle];
        mark = a;
      } else {
        continue;
      }
      out.push({
        index: hole,
        value: other(mark),
        technique: 'pair-gap',
        line: lines[k]!,
        support: pair,
        link: null,
      });
      if (firstOnly) return out;
    }
  }
  return out;
}

/**
 * T2 — counting the line (§7). A line holds exactly half of each mark, so
 * once half of it is one mark, everything still empty is the other one.
 */
function lineCountSteps(board: readonly Mark[], layout: Layout, firstOnly: boolean): Sweep {
  const { size, half, lines, lineCells } = layout;
  const out: SolveStep[] = [];
  for (let k = 0; k < lines.length; k++) {
    work++;
    const cells = lineCells[k]!;
    let circles = 0;
    let squares = 0;
    for (let i = 0; i < size; i++) {
      const value = board[cells[i]!]!;
      if (value === CIRCLE) circles++;
      else if (value === SQUARE) squares++;
    }
    if (circles + squares === size) continue;
    if (circles !== half && squares !== half) continue;
    const full: Cell = circles === half ? CIRCLE : SQUARE;
    const support = cells.filter((index) => board[index] === full);
    for (let i = 0; i < size; i++) {
      const index = cells[i]!;
      if (board[index] !== EMPTY) continue;
      out.push({
        index,
        value: other(full),
        technique: 'line-count',
        line: lines[k]!,
        support,
        link: null,
      });
      if (firstOnly) return out;
    }
  }
  return out;
}

/**
 * T3 — the link (§7). One end of a `=` decided decides the other as the same
 * mark; one end of a `×` decided decides the other as the opposite.
 */
function linkSteps(board: readonly Mark[], layout: Layout, firstOnly: boolean): Sweep {
  const { size, links } = layout;
  const out: SolveStep[] = [];
  for (let k = 0; k < links.length; k++) {
    work++;
    const link = links[k]!;
    const a = link.index;
    const b = linkOther(link, size);
    const va = board[a]!;
    const vb = board[b]!;
    let from: number;
    let to: number;
    let mark: Cell;
    if (isWritten(va) && vb === EMPTY) {
      from = a;
      to = b;
      mark = va;
    } else if (isWritten(vb) && va === EMPTY) {
      from = b;
      to = a;
      mark = vb;
    } else {
      continue;
    }
    out.push({
      index: to,
      value: link.same ? mark : other(mark),
      technique: 'link',
      line: lineOfLink(link, size),
      support: [from],
      link: k,
    });
    if (firstOnly) return out;
  }
  return out;
}

/**
 * T4 — completing the line (§7). Every legal pattern for one line that keeps
 * the marks already written, the links inside the line, and the links to
 * decided cells off it; a cell every surviving pattern agrees on is settled.
 * No surviving pattern at all means the board cannot be finished.
 *
 * Sound because the solution restricted to this line is always one of the
 * surviving patterns: the sweep only ever writes their common part.
 */
/** What T4 reads off one line: the empty positions every survivor agrees on. */
interface LineReading {
  /** Empty positions settled by every surviving pattern. */
  readonly settled: number;
  /** Bit set where the survivors hold a square — the value of a settled position. */
  readonly squares: number;
}

/**
 * T4 on one line: the legal patterns that keep its written marks, the links
 * inside it, and the links to decided cells off it. Null when none survive —
 * the board cannot be finished. A full line reads as nothing to settle.
 */
function readLine(board: readonly Mark[], layout: Layout, k: number): LineReading | null {
  const { size, lineCells, innerLinks, outerLinks } = layout;
  const cells = lineCells[k]!;
  const full = (1 << size) - 1;
  let circles = 0;
  let squares = 0;
  let empty = 0;
  for (let i = 0; i < size; i++) {
    const value = board[cells[i]!]!;
    if (value === SQUARE) squares |= 1 << i;
    else if (value === CIRCLE) circles |= 1 << i;
    else empty |= 1 << i;
  }
  if (empty === 0) return { settled: 0, squares: 0 };
  work++;

  // A decided cell off the line pins its partner on it.
  for (const outer of outerLinks[k]!) {
    const value = board[outer.other]!;
    if (!isWritten(value)) continue;
    const required = outer.same ? value : other(value);
    if (required === SQUARE) squares |= 1 << outer.pos;
    else circles |= 1 << outer.pos;
  }
  if ((squares & circles) !== 0) return null;

  const inner = innerLinks[k]!;
  let all = full;
  let some = 0;
  let survivors = 0;
  for (const pattern of legalMasks(size)) {
    work++;
    if ((pattern & circles) !== 0 || (~pattern & squares & full) !== 0) continue;
    let keeps = true;
    for (const link of inner) {
      const differ = ((pattern >> link.a) ^ (pattern >> link.b)) & 1;
      if ((differ === 0) !== link.same) {
        keeps = false;
        break;
      }
    }
    if (!keeps) continue;
    survivors++;
    all &= pattern;
    some |= pattern;
  }
  if (survivors === 0) return null;
  return { settled: empty & (all | (~some & full)), squares: all };
}

/**
 * T4 — completing the line (§7). Every legal pattern for one line that keeps
 * the marks already written, the links inside the line, and the links to
 * decided cells off it; a cell every surviving pattern agrees on is settled.
 * No surviving pattern at all means the board cannot be finished.
 *
 * Sound because the solution restricted to this line is always one of the
 * surviving patterns: the sweep only ever writes their common part.
 */
function lineCompletionSteps(board: readonly Mark[], layout: Layout, firstOnly: boolean): Sweep {
  const { size, lines, lineCells } = layout;
  const out: SolveStep[] = [];
  for (let k = 0; k < lines.length; k++) {
    const reading = readLine(board, layout, k);
    if (reading === null) return 'contradiction';
    if (reading.settled === 0) continue;
    const cells = lineCells[k]!;
    const support = cells.filter((index) => board[index] !== EMPTY);
    for (let i = 0; i < size; i++) {
      if (((reading.settled >> i) & 1) === 0) continue;
      out.push({
        index: cells[i]!,
        value: ((reading.squares >> i) & 1) === 1 ? SQUARE : CIRCLE,
        technique: 'line-completion',
        line: lines[k]!,
        support,
        link: null,
      });
      if (firstOnly) return out;
    }
  }
  return out;
}

/**
 * T5's inner fixpoint: T1–T4 run from a board that was already a T1–T4
 * fixpoint before `start` was written, so only what `start` touches can move.
 * Reads only the lines whose inputs changed — the changed cell's row and
 * column, and those of its link partners — which reaches the same fixpoint as
 * a full sweep (the techniques are monotone, so their closure does not depend
 * on the order), at a fraction of the reads. T1 and T2 need no pass of their
 * own here: within one line, T4's surviving patterns already say everything
 * they would. Writes into `board`; true when a rule breaks.
 */
function propagate(board: Mark[], layout: Layout, start: number): boolean {
  const { size, lineCells, cellLinks } = layout;
  const written: number[] = [start];
  const queued = new Uint8Array(2 * size);
  const queue: number[] = [];
  const enqueue = (k: number): void => {
    if (queued[k] === 1) return;
    queued[k] = 1;
    queue.push(k);
  };

  for (;;) {
    while (written.length > 0) {
      const index = written.pop()!;
      if (breaksAt(board, layout, index)) return true;
      const value = board[index] as Cell;
      enqueue(Math.floor(index / size));
      enqueue(size + (index % size));
      for (const link of cellLinks[index]!) {
        enqueue(Math.floor(link.other / size));
        enqueue(size + (link.other % size));
        if (board[link.other] !== EMPTY) continue;
        work++;
        board[link.other] = link.same ? value : other(value);
        written.push(link.other);
      }
    }
    const k = queue.shift();
    if (k === undefined) return false;
    queued[k] = 0;
    const reading = readLine(board, layout, k);
    if (reading === null) return true;
    const cells = lineCells[k]!;
    for (let i = 0; i < size; i++) {
      if (((reading.settled >> i) & 1) === 0) continue;
      const index = cells[i]!;
      board[index] = ((reading.squares >> i) & 1) === 1 ? SQUARE : CIRCLE;
      written.push(index);
    }
  }
}

/**
 * T5 — a depth-one hypothesis (§7). One mark is tried in one empty cell and
 * T1–T4 run to their fixpoint; if that breaks a rule, the cell holds the
 * other mark. Lines with the fewest empty cells are tried first, and the first
 * contradiction found is the one step.
 *
 * Only ever reached with T1–T4 silent (`findSteps` consults it last, and only
 * Hard's set holds it), so the board is a T1–T4 fixpoint — the precondition
 * `propagate` relies on.
 */
function hypothesisSteps(board: readonly Mark[], layout: Layout): Sweep {
  const { size, lines, lineCells } = layout;
  const order = lines
    .map((_, k) => k)
    .map((k) => ({ k, open: lineCells[k]!.filter((index) => board[index] === EMPTY).length }))
    .filter((entry) => entry.open > 0)
    .sort((a, b) => a.open - b.open || a.k - b.k);

  const tried = new Uint8Array(cellCount(size));
  // Marks a quiet hypothesis already wrote: trying one of them could only
  // reach a subset of that hypothesis's fixpoint, which held no contradiction,
  // so it cannot find one either. Skipping them changes the cost, never the
  // step found.
  const quiet = new Uint8Array(cellCount(size) * 2);
  for (const { k } of order) {
    for (const index of lineCells[k]!) {
      if (board[index] !== EMPTY || tried[index] === 1) continue;
      tried[index] = 1;
      for (const guess of [CIRCLE, SQUARE] as const) {
        if (quiet[index * 2 + guess] === 1) continue;
        work++;
        const trial = [...board];
        trial[index] = guess;
        const broken = propagate(trial, layout, index);
        if (!broken) {
          for (let cell = 0; cell < trial.length; cell++) {
            const value = trial[cell]!;
            if (board[cell] === EMPTY && isWritten(value)) quiet[cell * 2 + value] = 1;
          }
        }
        if (broken) {
          return [
            {
              index,
              value: other(guess),
              technique: 'hypothesis',
              line: lines[k]!,
              support: [],
              link: null,
            },
          ];
        }
      }
    }
  }
  return [];
}

const SWEEPS: Record<
  Technique,
  (board: readonly Mark[], layout: Layout, firstOnly: boolean) => Sweep
> = {
  'pair-gap': pairGapSteps,
  'line-count': lineCountSteps,
  link: linkSteps,
  'line-completion': lineCompletionSteps,
  hypothesis: (board, layout) => hypothesisSteps(board, layout),
};

/**
 * Everything the cheapest technique that has anything to say can prove from
 * this board, in one sweep. A more expensive technique is only consulted once
 * the cheaper ones are silent — how a person plays, and why work stays small.
 */
export function findSteps(
  board: readonly Mark[],
  layout: Layout,
  techniques: readonly Technique[],
  firstOnly = false,
): Sweep {
  for (const technique of ORDER) {
    if (!techniques.includes(technique)) continue;
    const found = SWEEPS[technique](board, layout, firstOnly);
    if (found === 'contradiction' || found.length > 0) return found;
  }
  return [];
}

/**
 * Whether writing the cell at `index` broke a rule there: three alike through
 * it, more than half of its mark in its row or column, or a link at it that
 * disagrees. Every new break involves the cell just written, so checking it
 * alone after each write sees them all.
 */
function breaksAt(board: readonly Mark[], layout: Layout, index: number): boolean {
  const { size, half, lineCells, cellLinks } = layout;
  const value = board[index]!;
  if (!isWritten(value)) return false;
  const row = Math.floor(index / size);
  const col = index % size;
  for (const [k, pos] of [
    [row, col],
    [size + col, row],
  ] as const) {
    work++;
    const cells = lineCells[k]!;
    let count = 0;
    for (let i = 0; i < size; i++) if (board[cells[i]!] === value) count++;
    if (count > half) return true;
    for (let start = Math.max(0, pos - 2); start <= Math.min(pos, size - 3); start++) {
      if (
        board[cells[start]!] === value &&
        board[cells[start + 1]!] === value &&
        board[cells[start + 2]!] === value
      ) {
        return true;
      }
    }
  }
  for (const link of cellLinks[index]!) {
    const partner = board[link.other]!;
    if (isWritten(partner) && (partner === value) !== link.same) return true;
  }
  return false;
}

interface Fixpoint {
  readonly solved: boolean;
  readonly contradiction: boolean;
}

/** Runs a technique set to its fixpoint on `board`, writing into it. */
function solveInPlace(board: Mark[], layout: Layout, techniques: readonly Technique[]): Fixpoint {
  for (;;) {
    const steps = findSteps(board, layout, techniques);
    if (steps === 'contradiction') return { solved: false, contradiction: true };
    if (steps.length === 0) break;
    for (const step of steps) {
      const current = board[step.index]!;
      if (current === step.value) continue;
      if (current !== EMPTY) return { solved: false, contradiction: true };
      board[step.index] = step.value;
      if (breaksAt(board, layout, step.index)) return { solved: false, contradiction: true };
    }
  }
  return { solved: board.every((cell) => cell !== EMPTY), contradiction: false };
}

export interface SolveResult {
  readonly board: readonly Mark[];
  /** Every cell determined — the puzzle needs nothing beyond these techniques. */
  readonly solved: boolean;
  /** The board cannot be finished. Never true on a board this generator shipped. */
  readonly contradiction: boolean;
}

/**
 * Runs a technique set to a fixpoint from a board (§7). Every step of a sweep
 * is applied before the next sweep — the techniques are sound, so a step found
 * now is still true later, and batching turns a solve into one sweep per round
 * of reasoning rather than one per cell.
 */
export function solve(
  start: readonly Mark[],
  layout: Layout,
  techniques: readonly Technique[],
): SolveResult {
  const board = [...start];
  const result = solveInPlace(board, layout, techniques);
  return { board, ...result };
}

/** Whether a technique set alone finishes this board — the dig's test (§6). */
export function isSolvable(
  start: readonly Mark[],
  layout: Layout,
  techniques: readonly Technique[],
): boolean {
  return solve(start, layout, techniques).solved;
}

/**
 * Grades a board (§7): Easy's set to a fixpoint, then Medium's on from there,
 * then Hard's. One flow rather than three fresh solves, because the techniques
 * are monotone — more marks never prove less — so a lower set's fixpoint is a
 * valid place for the next set to continue from. Null when even Hard's set
 * stops short, or the board cannot be finished at all.
 */
export function grade(givens: readonly Mark[], layout: Layout): Difficulty | null {
  const board = [...givens];
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const result = solveInPlace(board, layout, TIER_TECHNIQUES[tier]);
    if (result.contradiction) return null;
    if (result.solved) return tier;
  }
  return null;
}

// ---------- the counting solver (§6) ----------

/**
 * How many solutions a puzzle has, up to `limit` (§6). A row at a time from the
 * legal-line alphabet — rows may repeat, there is no third rule — filtered
 * first by the row's own givens and `=` / `×`, then placed while the columns
 * keep rule 1 and rule 2 and the vertical links hold. Nodes count as work;
 * nothing here trusts the technique solver.
 */
export function countSolutions(givens: readonly Mark[], layout: Layout, limit = 2): number {
  const { size, half, links } = layout;
  const alphabet = legalMasks(size);
  const full = (1 << size) - 1;

  const sameAbove = new Array<number>(size).fill(0);
  const diffAbove = new Array<number>(size).fill(0);
  const rowSame: { a: number; b: number; same: boolean }[][] = Array.from(
    { length: size },
    () => [],
  );
  for (const link of links) {
    const row = Math.floor(link.index / size);
    const col = link.index % size;
    if (link.dir === 'h') rowSame[row]!.push({ a: col, b: col + 1, same: link.same });
    else if (link.same) sameAbove[row + 1]! |= 1 << col;
    else diffAbove[row + 1]! |= 1 << col;
  }

  const candidates: number[][] = [];
  for (let row = 0; row < size; row++) {
    let squares = 0;
    let circles = 0;
    for (let col = 0; col < size; col++) {
      const value = givens[row * size + col];
      if (value === SQUARE) squares |= 1 << col;
      else if (value === CIRCLE) circles |= 1 << col;
    }
    candidates.push(
      alphabet.filter((pattern) => {
        if ((pattern & circles) !== 0 || (~pattern & squares & full) !== 0) return false;
        return rowSame[row]!.every(
          (link) => ((((pattern >> link.a) ^ (pattern >> link.b)) & 1) === 0) === link.same,
        );
      }),
    );
  }

  const squaresInColumn = new Array<number>(size).fill(0);
  let found = 0;

  const place = (row: number, previous: number, before: number): void => {
    if (row === size) {
      found++;
      return;
    }
    for (const pattern of candidates[row]!) {
      if (row >= 1) {
        const differ = previous ^ pattern;
        if ((differ & sameAbove[row]!) !== 0) continue;
        if ((differ & diffAbove[row]!) !== diffAbove[row]!) continue;
      }
      if (row >= 2 && (~(pattern ^ previous) & ~(previous ^ before) & full) !== 0) continue;
      let fits = true;
      for (let col = 0; col < size; col++) {
        const square = (pattern >> col) & 1;
        const squares = squaresInColumn[col]! + square;
        if (squares > half || row + 1 - squares > half) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      work++;
      for (let col = 0; col < size; col++) squaresInColumn[col]! += (pattern >> col) & 1;
      place(row + 1, pattern, previous);
      for (let col = 0; col < size; col++) squaresInColumn[col]! -= (pattern >> col) & 1;
      if (found >= limit) return;
    }
  };

  place(0, 0, 0);
  return found;
}

// ---------- the hint (§8) ----------

export type Hint =
  /** Cells and links that already break a rule. Shown before anything else (§8). */
  | {
      readonly kind: 'violation';
      readonly cells: readonly number[];
      readonly links: readonly number[];
    }
  /** A mark that is not in the solution — said only when asked (§8, §14). */
  | { readonly kind: 'wrong'; readonly index: number }
  /** The next cell the techniques settle from the player's board (§8). */
  | { readonly kind: 'step'; readonly step: SolveStep };

/**
 * The teaching hint of §8, in its order: a broken rule, then a mark that cannot
 * be right (first in row order), then the next technique step read from the
 * board with every technique (T1–T5). Null when nothing is left to say. It
 * never writes a mark.
 *
 * By the third stage every mark agrees with the solution, so the board is one
 * the puzzle's own techniques finish and the step is always the solution's.
 */
export function findHint(
  givens: readonly Mark[],
  marks: readonly Mark[],
  links: readonly Link[],
  solution: readonly Cell[],
  size: Size,
): Hint | null {
  const board = givens.map((given, index) => (given === EMPTY ? (marks[index] ?? EMPTY) : given));
  const violations = findViolations(board, links, size);
  if (violations.any) {
    const cells: number[] = [];
    violations.cells.forEach((flagged, index) => {
      if (flagged) cells.push(index);
    });
    const brokenLinks: number[] = [];
    violations.links.forEach((flagged, index) => {
      if (flagged) brokenLinks.push(index);
    });
    return { kind: 'violation', cells, links: brokenLinks };
  }

  for (let index = 0; index < board.length; index++) {
    if (givens[index] !== EMPTY) continue;
    const mark = marks[index] ?? EMPTY;
    if (mark !== EMPTY && mark !== solution[index]) return { kind: 'wrong', index };
  }

  const steps = findSteps(board, buildLayout(links, size), TIER_TECHNIQUES.hard, true);
  if (steps === 'contradiction' || steps.length === 0) return null;
  return { kind: 'step', step: steps[0]! };
}
