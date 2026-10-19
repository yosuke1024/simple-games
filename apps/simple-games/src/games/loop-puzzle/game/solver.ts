/**
 * The two solvers of docs/LOOP_PUZZLE_RULES.md §7 and §8, on one propagation
 * engine.
 *
 * The engine holds a board of marks (UNKNOWN / LINE / CROSS per edge) and
 * applies sound deductions to a fixpoint. The techniques, cheapest first:
 *
 * - **T1 — counting.** A number with as many LINEs as it says takes CROSS on
 *   the rest; one with exactly as many open edges as it still needs takes
 *   LINE on all of them. A dot with two LINEs takes CROSS on the rest; a dot
 *   with one LINE and one open edge takes LINE on it; a dot with no LINE and
 *   one open edge takes CROSS on it. And the loop rule: an open edge joining
 *   the two ends of one chain would close it, so it is CROSS unless that
 *   chain is every LINE on the board and closing it meets every number.
 * - **T2 — corners.** For each corner of each cell (the two of its edges
 *   that meet at one dot) it keeps two facts, "at least one is LINE" and
 *   "at most one is LINE", and reads them three ways: a number splits into
 *   two opposite corners whose counts add up to it; a dot's degree is 0 or 2,
 *   so a corner and the dot's other edges add up to 0 or 2; and a corner
 *   whose bounds are tight decides its open edge. This is the family of
 *   "3 in a corner", "1 in a corner", "a line running into a 3".
 * - **T3 — trial.** Assume an open edge is LINE (then CROSS), run T1 + T2 to
 *   a fixpoint, and if that contradicts, the edge is the other mark. One
 *   level deep, never nested.
 *
 * `countSolutions` is the search that proves uniqueness: T1 + T2 at every
 * node (both sound, so no solution is lost) and a LINE / CROSS branch on an
 * open edge, counting to two. Both doors charge `solverWork` — one unit per
 * mark written, per dot or cell examined, per corner fact learned, per
 * search node and per trial — and both take an explicit work limit and say
 * so honestly when they hit it (§8): `complete: false` from the counter,
 * `status: 'limit'` from the technique solver. Neither ever reports a guess
 * as an answer.
 */
import { edgeBetween, gridFor, type Grid } from './grid';
import { CROSS, LINE, UNKNOWN, type Layout, type Mark, type Marks } from './types';

let work = 0;

/**
 * Marks written + dots / cells examined + corner facts + nodes + trials since
 * the last reset (§8). Deterministic, so it is what every budget is set in.
 * It is not a clock: the whole-board scans (the loop rule's sweep, the
 * closing clue check, the search's choice of branch) and the state copies
 * are not counted, so the time per unit varies by about two times between
 * generation and a dense counting search (§8).
 */
export const solverWork = {
  read: (): number => work,
  /** Charges work done outside the solver (the generator's region growth — §8). */
  add: (units: number): void => {
    work += units;
  },
  reset: (): void => {
    work = 0;
  },
};

/**
 * Search nodes one count may spend (§8). Proving a shipped board unique takes
 * one node on 4×4 and 5×5 (T1 + T2 settle it at the root) and about a dozen
 * on 6×6, about a thousand at worst. A count that runs out reports
 * `complete: false`, which every caller reads as "not proven unique" — never
 * as unique.
 */
export const COUNT_NODE_LIMIT = 5_000;

/**
 * Work one technique solve may spend before it gives up with `'limit'`
 * (§8). The generator reads that as "not solvable by these techniques".
 */
export const TECHNIQUE_WORK_LIMIT = 100_000;

/** The technique sets of §7: T1, T1 + T2, T1 + T2 + T3. */
export type Level = 1 | 2 | 3;

const AT_LEAST_ONE = 1;
const AT_MOST_ONE = 2;

// ---------- state ----------

interface State {
  readonly marks: Int8Array;
  /** Per corner: AT_LEAST_ONE | AT_MOST_ONE, learned by T2 (§7). */
  readonly flags: Uint8Array;
  /** LINE edges per dot. */
  readonly degree: Int8Array;
  /** At a chain's end (degree 1): the chain's other end. -1 elsewhere. */
  readonly partner: Int16Array;
  /** At a chain's end: how many LINE edges the chain has. */
  readonly chainLength: Int16Array;
  lines: number;
  unknown: number;
  /** A loop has closed holding every LINE: everything open is CROSS. */
  closed: boolean;
}

const cloneState = (s: State): State => ({
  marks: s.marks.slice(),
  flags: s.flags.slice(),
  degree: s.degree.slice(),
  partner: s.partner.slice(),
  chainLength: s.chainLength.slice(),
  lines: s.lines,
  unknown: s.unknown,
  closed: s.closed,
});

/** Copies `src` over `dst` (same board size) — the search and the trials reuse their states. */
function copyState(dst: State, src: State): State {
  dst.marks.set(src.marks);
  dst.flags.set(src.flags);
  dst.degree.set(src.degree);
  dst.partner.set(src.partner);
  dst.chainLength.set(src.chainLength);
  dst.lines = src.lines;
  dst.unknown = src.unknown;
  dst.closed = src.closed;
  return dst;
}

/** Where a deduction was read from — what the Hint points at (§6). */
export type Anchor =
  | { readonly kind: 'cell'; readonly index: number }
  | { readonly kind: 'dot'; readonly index: number }
  | { readonly kind: 'loop'; readonly index: number }
  | { readonly kind: 'trial'; readonly index: number };

interface Deduction {
  readonly edge: number;
  readonly mark: Mark;
  readonly anchor: Anchor;
}

/** One solve's tables and scratch queues; the queues are empty between calls. */
class Engine {
  readonly grid: Grid;
  /** Per cell: the number, or -1 for none. */
  readonly clues: Int8Array;
  level: Level = 1;
  private readonly dotStack: Int16Array;
  private readonly dotQueued: Uint8Array;
  private dotTop = 0;
  private readonly cellStack: Int16Array;
  private readonly cellQueued: Uint8Array;
  private cellTop = 0;
  /** Set while the Hint wants the order deductions were made in. */
  log: Deduction[] | null = null;
  /**
   * Set while the Hint's T2 stage runs dry (§6): `assign` records each
   * conclusion here (UNKNOWN / LINE / CROSS per edge) and writes nothing, so
   * every conclusion rests on the player's own marks and on corner facts
   * read from them — never on a mark the engine wrote itself. Null otherwise.
   */
  private dry: Int8Array | null = null;
  /** Where the deduction being made is read from (kept as numbers: the hot loop allocates nothing). */
  private anchorKind: Anchor['kind'] = 'loop';
  private anchorIndex = -1;
  // Scratch for bounds, so the hot loop allocates nothing.
  private lo = 0;
  private hi = 0;

  constructor(layout: Layout) {
    this.grid = gridFor(layout.width, layout.height);
    this.clues = Int8Array.from(layout.clues, (clue) => (clue === null ? -1 : clue));
    this.dotStack = new Int16Array(this.grid.dotCount);
    this.dotQueued = new Uint8Array(this.grid.dotCount);
    this.cellStack = new Int16Array(this.grid.cellCount);
    this.cellQueued = new Uint8Array(this.grid.cellCount);
  }

  fresh(): State {
    const { grid } = this;
    const state: State = {
      marks: new Int8Array(grid.edgeCount),
      flags: new Uint8Array(4 * grid.cellCount),
      degree: new Int8Array(grid.dotCount),
      partner: new Int16Array(grid.dotCount).fill(-1),
      chainLength: new Int16Array(grid.dotCount),
      lines: 0,
      unknown: grid.edgeCount,
      closed: false,
    };
    for (let dot = 0; dot < grid.dotCount; dot++) this.pushDot(dot);
    for (let cell = 0; cell < grid.cellCount; cell++) this.pushCell(cell);
    return state;
  }

  private pushDot(dot: number): void {
    if (this.dotQueued[dot] === 1) return;
    this.dotQueued[dot] = 1;
    this.dotStack[this.dotTop++] = dot;
  }

  private pushCell(cell: number): void {
    if (this.cellQueued[cell] === 1) return;
    this.cellQueued[cell] = 1;
    this.cellStack[this.cellTop++] = cell;
  }

  private at(kind: Anchor['kind'], index: number): void {
    this.anchorKind = kind;
    this.anchorIndex = index;
  }

  /** Empties the queues — after a contradiction, so the next state starts clean. */
  clearQueues(): void {
    while (this.dotTop > 0) this.dotQueued[this.dotStack[--this.dotTop]!] = 0;
    while (this.cellTop > 0) this.cellQueued[this.cellStack[--this.cellTop]!] = 0;
  }

  /** Starts a dry run (see `dry`): conclusions are logged, not written. */
  beginDry(): void {
    this.dry = new Int8Array(this.grid.edgeCount);
  }

  endDry(): void {
    this.dry = null;
  }

  /** Re-examines everything — after marks were written from outside the engine. */
  queueAll(): void {
    for (let dot = 0; dot < this.grid.dotCount; dot++) this.pushDot(dot);
    for (let cell = 0; cell < this.grid.cellCount; cell++) this.pushCell(cell);
  }

  /**
   * Writes one mark. False when it contradicts what is already known: the
   * edge holds the other mark, a dot would reach degree 3, a LINE lands after
   * the loop closed, or it closes a loop that does not hold every LINE.
   * In a dry run it records the conclusion instead (false when an earlier
   * conclusion said the other mark).
   */
  assign(s: State, edge: number, mark: Mark): boolean {
    const current = s.marks[edge]!;
    if (current === mark) return true;
    if (current !== UNKNOWN) return false;
    if (this.dry !== null) return this.conclude(edge, mark);
    const { grid } = this;
    work++;
    s.marks[edge] = mark;
    s.unknown--;
    if (this.log !== null) {
      this.log.push({ edge, mark, anchor: { kind: this.anchorKind, index: this.anchorIndex } });
    }
    const a = grid.edgeDots[2 * edge]!;
    const b = grid.edgeDots[2 * edge + 1]!;
    this.pushDot(a);
    this.pushDot(b);
    const c0 = grid.edgeCells[2 * edge]!;
    const c1 = grid.edgeCells[2 * edge + 1]!;
    if (c0 >= 0) this.pushCell(c0);
    if (c1 >= 0) this.pushCell(c1);
    if (mark !== LINE) return true;

    if (s.closed) return false;
    const da = s.degree[a]!;
    const db = s.degree[b]!;
    if (da >= 2 || db >= 2) return false;
    const lengthA = da === 0 ? 0 : s.chainLength[a]!;
    const lengthB = db === 0 ? 0 : s.chainLength[b]!;
    const endA = da === 0 ? a : s.partner[a]!;
    const endB = db === 0 ? b : s.partner[b]!;
    s.degree[a] = da + 1;
    s.degree[b] = db + 1;
    s.lines++;
    if (da === 1) s.partner[a] = -1;
    if (db === 1) s.partner[b] = -1;
    if (da === 1 && endA === b) {
      // The chain's two ends met: a closed loop. It must be every LINE.
      if (lengthA + 1 !== s.lines) return false;
      s.closed = true;
      return true;
    }
    const length = lengthA + lengthB + 1;
    s.partner[endA] = endB;
    s.partner[endB] = endA;
    s.chainLength[endA] = length;
    s.chainLength[endB] = length;
    return true;
  }

  /** A dry run's `assign`: logs the conclusion once, writes nothing. */
  private conclude(edge: number, mark: Mark): boolean {
    const dry = this.dry!;
    const before = dry[edge]!;
    if (before === mark) return true;
    if (before !== UNKNOWN) return false;
    work++;
    dry[edge] = mark;
    if (this.log !== null) {
      this.log.push({ edge, mark, anchor: { kind: this.anchorKind, index: this.anchorIndex } });
    }
    return true;
  }

  /**
   * T1 + (from level 2) T2 to a fixpoint (§7). False on a contradiction. In
   * a dry run the marks never change, so one pass of the closing rules ends
   * it: everything they could conclude has been logged.
   */
  propagate(s: State): boolean {
    for (;;) {
      while (this.dotTop > 0 || this.cellTop > 0) {
        let ok: boolean;
        if (this.dotTop > 0) {
          const dot = this.dotStack[--this.dotTop]!;
          this.dotQueued[dot] = 0;
          ok = this.examineDot(s, dot);
        } else {
          const cell = this.cellStack[--this.cellTop]!;
          this.cellQueued[cell] = 0;
          ok = this.examineCell(s, cell);
        }
        if (!ok) {
          this.clearQueues();
          return false;
        }
      }
      if (s.closed) {
        if (s.unknown === 0) return true;
        this.at('loop', -1);
        for (let edge = 0; edge < this.grid.edgeCount; edge++) {
          if (s.marks[edge] === UNKNOWN && !this.assign(s, edge, CROSS)) {
            this.clearQueues();
            return false;
          }
        }
        if (this.dry !== null) return true;
        continue;
      }
      // Every edge decided and no loop closed: no LINE at all, or an open chain.
      if (s.unknown === 0) return false;
      if (this.dry !== null) {
        this.sweepLoopRule(s);
        return true;
      }
      if (!this.sweepLoopRule(s)) return true;
    }
  }

  /**
   * T1's loop rule over every chain (§7): the open edge between a chain's two
   * ends would close it. True when it wrote something.
   */
  private sweepLoopRule(s: State): boolean {
    const { grid } = this;
    let wrote = false;
    for (let dot = 0; dot < grid.dotCount; dot++) {
      const other = s.partner[dot]!;
      if (other <= dot) continue;
      const edge = edgeBetween(grid, dot, other);
      if (edge < 0 || s.marks[edge] !== UNKNOWN) continue;
      if (s.chainLength[dot]! < s.lines || !this.closingMeetsClues(s, edge)) {
        this.at('loop', edge);
        this.assign(s, edge, CROSS);
        wrote = true;
      }
    }
    return wrote;
  }

  /** Whether closing the one chain with `edge`, and nothing else, would meet every number. */
  private closingMeetsClues(s: State, edge: number): boolean {
    const { grid, clues } = this;
    for (let cell = 0; cell < grid.cellCount; cell++) {
      const clue = clues[cell]!;
      if (clue < 0) continue;
      let lines = 0;
      for (let k = 0; k < 4; k++) {
        const e = grid.cellEdges[4 * cell + k]!;
        if (s.marks[e] === LINE || e === edge) lines++;
      }
      if (lines !== clue) return false;
    }
    return true;
  }

  private examineDot(s: State, dot: number): boolean {
    const { grid } = this;
    work++;
    let lines = 0;
    let open = 0;
    let lastOpen = -1;
    for (let k = 0; k < 4; k++) {
      const edge = grid.dotEdges[4 * dot + k]!;
      if (edge < 0) continue;
      const mark = s.marks[edge]!;
      if (mark === LINE) lines++;
      else if (mark === UNKNOWN) {
        open++;
        lastOpen = edge;
      }
    }
    this.at('dot', dot);
    if (lines > 2) return false;
    if (lines === 2 && open > 0) {
      for (let k = 0; k < 4; k++) {
        const edge = grid.dotEdges[4 * dot + k]!;
        if (edge >= 0 && s.marks[edge] === UNKNOWN && !this.assign(s, edge, CROSS)) return false;
      }
      // Every edge here is decided now; the corners have nothing left to say.
      return true;
    } else if (lines === 1) {
      if (open === 0) return false;
      // The dot is queued again by the write; T2 reads it then.
      if (open === 1) return this.assign(s, lastOpen, LINE);
    } else if (lines === 0 && open === 1) {
      return this.assign(s, lastOpen, CROSS);
    }
    if (this.level < 2) return true;
    if (lines === 0 && open === grid.dotDegree[dot]) {
      // Nothing decided at this dot and no corner fact: T2 can learn nothing here.
      let facts = 0;
      for (let j = 0; j < 4; j++) {
        const corner = grid.dotCorners[4 * dot + j]!;
        if (corner >= 0) facts |= s.flags[corner]!;
      }
      if (facts === 0) return true;
    }
    for (let j = 0; j < 4; j++) {
      const corner = grid.dotCorners[4 * dot + j]!;
      if (corner < 0) continue;
      // At an inner dot the two diagonal corners are one relation: read it once.
      const rest = grid.cornerRestCorner[corner]!;
      if (rest >= 0 && rest < corner) continue;
      if (!this.cornerAtDot(s, corner)) return false;
    }
    return true;
  }

  private examineCell(s: State, cell: number): boolean {
    const clue = this.clues[cell]!;
    if (clue < 0) return true;
    const { grid } = this;
    work++;
    let lines = 0;
    let open = 0;
    for (let k = 0; k < 4; k++) {
      const mark = s.marks[grid.cellEdges[4 * cell + k]!]!;
      if (mark === LINE) lines++;
      else if (mark === UNKNOWN) open++;
    }
    if (lines > clue || lines + open < clue) return false;
    this.at('cell', cell);
    if (open > 0 && (lines === clue || lines + open === clue)) {
      const mark: Mark = lines === clue ? CROSS : LINE;
      for (let k = 0; k < 4; k++) {
        const edge = grid.cellEdges[4 * cell + k]!;
        if (s.marks[edge] === UNKNOWN && !this.assign(s, edge, mark)) return false;
      }
    }
    if (this.level < 2) return true;
    // T2: the cell's edges are two opposite corners, whose counts add to the clue.
    for (let j = 0; j < 2; j++) {
      this.at('cell', cell);
      const p = 4 * cell + j;
      const q = 4 * cell + (j ^ 2);
      this.boundsOf(s, p);
      const loP = this.lo;
      const hiP = this.hi;
      this.boundsOf(s, q);
      const loQ = this.lo;
      const hiQ = this.hi;
      if (!this.tighten(s, p, Math.max(loP, clue - hiQ), Math.min(hiP, clue - loQ))) return false;
      if (!this.tighten(s, q, Math.max(loQ, clue - hiP), Math.min(hiQ, clue - loP))) return false;
    }
    return true;
  }

  /** A corner's LINE count bounds from its marks and its facts, into lo / hi. */
  private boundsOf(s: State, corner: number): void {
    const { grid } = this;
    const m1 = s.marks[grid.cornerEdges[2 * corner]!]!;
    const m2 = s.marks[grid.cornerEdges[2 * corner + 1]!]!;
    let lo = (m1 === LINE ? 1 : 0) + (m2 === LINE ? 1 : 0);
    let hi = 2 - (m1 === CROSS ? 1 : 0) - (m2 === CROSS ? 1 : 0);
    const flags = s.flags[corner]!;
    if ((flags & AT_LEAST_ONE) !== 0 && lo < 1) lo = 1;
    if ((flags & AT_MOST_ONE) !== 0 && hi > 1) hi = 1;
    this.lo = lo;
    this.hi = hi;
  }

  /**
   * Narrows a corner to [lo, hi] LINEs (§7, T2): learns the facts, and
   * decides an edge the bounds leave one way to go. False on a contradiction.
   */
  private tighten(s: State, corner: number, lo: number, hi: number): boolean {
    const { grid } = this;
    this.boundsOf(s, corner);
    if (this.lo > lo) lo = this.lo;
    if (this.hi < hi) hi = this.hi;
    if (lo > hi) return false;
    const before = s.flags[corner]!;
    const after = before | (lo >= 1 ? AT_LEAST_ONE : 0) | (hi <= 1 ? AT_MOST_ONE : 0);
    if (after !== before) {
      work++;
      s.flags[corner] = after;
      this.pushDot(grid.cornerDot[corner]!);
      this.pushCell(corner >> 2);
    }
    const e1 = grid.cornerEdges[2 * corner]!;
    const e2 = grid.cornerEdges[2 * corner + 1]!;
    const m1 = s.marks[e1]!;
    const m2 = s.marks[e2]!;
    if (m1 === UNKNOWN && m2 === UNKNOWN) {
      if (lo === 2) return this.assign(s, e1, LINE) && this.assign(s, e2, LINE);
      if (hi === 0) return this.assign(s, e1, CROSS) && this.assign(s, e2, CROSS);
      return true;
    }
    if (m1 !== UNKNOWN && m2 !== UNKNOWN) return true;
    const open = m1 === UNKNOWN ? e1 : e2;
    const known = (m1 === UNKNOWN ? m2 : m1) === LINE ? 1 : 0;
    const canLine = lo <= known + 1 && known + 1 <= hi;
    const canCross = lo <= known && known <= hi;
    if (!canLine && !canCross) return false;
    if (!canLine) return this.assign(s, open, CROSS);
    if (!canCross) return this.assign(s, open, LINE);
    return true;
  }

  /**
   * T2 at a dot (§7): the corner and the dot's other edges add up to 0 or 2.
   * The other edges are the diagonal cell's corner at an inner dot, one edge
   * on the border, and nothing at a board corner.
   */
  private cornerAtDot(s: State, corner: number): boolean {
    const { grid } = this;
    this.boundsOf(s, corner);
    const loP = this.lo;
    const hiP = this.hi;
    const r0 = grid.cornerRest[2 * corner]!;
    const r1 = grid.cornerRest[2 * corner + 1]!;
    const restCorner = grid.cornerRestCorner[corner]!;
    let loR = 0;
    let hiR = 0;
    if (restCorner >= 0) {
      this.boundsOf(s, restCorner);
      loR = this.lo;
      hiR = this.hi;
    } else if (r0 >= 0 && r1 < 0) {
      const mark = s.marks[r0]!;
      loR = mark === LINE ? 1 : 0;
      hiR = mark === CROSS ? 0 : 1;
    }
    let minP = 3;
    let maxP = -1;
    let minR = 3;
    let maxR = -1;
    for (let p = loP; p <= hiP; p++) {
      for (let r = loR; r <= hiR; r++) {
        const total = p + r;
        if (total !== 0 && total !== 2) continue;
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
      }
    }
    if (maxP < 0) return false;
    const dot = grid.cornerDot[corner]!;
    this.at('dot', dot);
    if (!this.tighten(s, corner, minP, maxP)) return false;
    this.at('dot', dot);
    if (restCorner >= 0) return this.tighten(s, restCorner, minR, maxR);
    if (r0 >= 0 && r1 < 0 && s.marks[r0] === UNKNOWN) {
      if (minR === 1) return this.assign(s, r0, LINE);
      if (maxR === 0) return this.assign(s, r0, CROSS);
    }
    return true;
  }

  /**
   * One round of T3 (§7): every open edge, LINE then CROSS, assumed and
   * propagated; a contradiction decides the edge the other way. Returns the
   * edges it decided, or 'contradiction' / 'limit'.
   */
  trialRound(
    s: State,
    budgetEnd: number,
    stopAfterFirst = false,
  ): number | 'contradiction' | 'limit' {
    const { grid } = this;
    let decided = 0;
    const log = this.log;
    const trial = cloneState(s);
    for (let edge = 0; edge < grid.edgeCount; edge++) {
      if (s.marks[edge] !== UNKNOWN) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        const mark: Mark = attempt === 0 ? LINE : CROSS;
        if (work > budgetEnd) return 'limit';
        work++;
        copyState(trial, s);
        this.log = null;
        const holds = this.assign(trial, edge, mark) && this.propagate(trial);
        this.clearQueues();
        this.log = log;
        if (holds) continue;
        this.at('trial', edge);
        if (!this.assign(s, edge, mark === LINE ? CROSS : LINE) || !this.propagate(s)) {
          this.clearQueues();
          return 'contradiction';
        }
        decided++;
        break;
      }
      if (s.unknown === 0 || (stopAfterFirst && decided > 0)) break;
    }
    return decided;
  }

  /**
   * Every T1 conclusion one rule draws at one place from `s` as it stands —
   * each number, each dot, and the loop rule — with nothing propagated
   * (§6: the Hint's first step reads only what the player has written).
   * Numbers first, then dots, then the loop rule. `s` is left untouched.
   */
  singleSteps(s: State): Deduction[] {
    const out: Deduction[] = [];
    const probe = cloneState(s);
    const level = this.level;
    this.level = 1;
    const collect = (examine: (t: State) => boolean): void => {
      copyState(probe, s);
      const log: Deduction[] = [];
      this.log = log;
      const ok = examine(probe);
      this.log = null;
      this.clearQueues();
      if (ok) out.push(...log);
    };
    for (let cell = 0; cell < this.grid.cellCount; cell++) {
      if (this.clues[cell]! >= 0) collect((t) => this.examineCell(t, cell));
    }
    for (let dot = 0; dot < this.grid.dotCount; dot++) collect((t) => this.examineDot(t, dot));
    collect((t) => {
      this.sweepLoopRule(t);
      return true;
    });
    this.level = level;
    return out;
  }

  /** Writes the player's marks into a fresh state. False when they break a rule. */
  seed(s: State, marks: Marks | undefined): boolean {
    if (marks === undefined) return true;
    this.at('loop', -1);
    for (let edge = 0; edge < marks.length; edge++) {
      const mark = marks[edge]!;
      if (mark !== UNKNOWN && !this.assign(s, edge, mark)) return false;
    }
    return true;
  }
}

const toMarks = (s: State): Mark[] => Array.from(s.marks, (m) => m as Mark);

// ---------- the technique solver (§7) ----------

export type TechniqueStatus = 'solved' | 'stuck' | 'contradiction' | 'limit';

export interface TechniqueResult {
  /** solved: every edge decided, one loop. stuck: the techniques ran out. limit: the work limit ran out. */
  readonly status: TechniqueStatus;
  /** The board when the techniques stopped. */
  readonly marks: readonly Mark[];
  /** Edges T3 decided along the way — 0 when T1 + T2 sufficed (§7). */
  readonly trials: number;
}

/**
 * Runs the techniques of `level` to a fixpoint (§7), from the bare clues or
 * from a board of marks. Every technique is sound, so 'solved' means the
 * board has exactly one solution and this is it.
 */
export function solveWithTechniques(
  layout: Layout,
  level: Level,
  start?: Marks,
  workLimit: number = TECHNIQUE_WORK_LIMIT,
): TechniqueResult {
  const engine = new Engine(layout);
  engine.level = level;
  const budgetEnd = work + workLimit;
  const s = engine.fresh();
  let trials = 0;
  const finish = (status: TechniqueStatus): TechniqueResult => ({
    status,
    marks: toMarks(s),
    trials,
  });
  if (!engine.seed(s, start) || !engine.propagate(s)) {
    engine.clearQueues();
    return finish('contradiction');
  }
  for (;;) {
    if (s.unknown === 0) return finish(s.closed && s.lines > 0 ? 'solved' : 'contradiction');
    if (level < 3) return finish('stuck');
    const decided = engine.trialRound(s, budgetEnd);
    if (decided === 'contradiction' || decided === 'limit') return finish(decided);
    if (decided === 0) return finish('stuck');
    trials += decided;
  }
}

/**
 * The cheapest technique set that solves a layout (§7), with the edges T3
 * decided by trial on the way; null when none up to `maxLevel` does
 * (including a work limit hit). `workLimit` caps the whole grading — each
 * solve gets what is left of it, and never more than TECHNIQUE_WORK_LIMIT.
 */
export function gradeOf(
  layout: Layout,
  maxLevel: Level = 3,
  workLimit: number = Infinity,
): { readonly grade: Level; readonly trials: number } | null {
  const end = work + workLimit;
  for (const level of [1, 2, 3] as const) {
    if (level > maxLevel) break;
    const result = solveWithTechniques(
      layout,
      level,
      undefined,
      Math.min(TECHNIQUE_WORK_LIMIT, end - work),
    );
    if (result.status === 'solved') return { grade: level, trials: result.trials };
  }
  return null;
}

// ---------- counting (§8) ----------

export interface CountResult {
  /** Solutions found, at most `limit`. */
  readonly count: number;
  /**
   * True when `count` is exact: the search finished, or found `limit`
   * solutions. False when the node limit cut it short — then nothing is
   * proven, and a board must not be called unique (§8).
   */
  readonly complete: boolean;
  /** Search nodes spent. */
  readonly nodes: number;
  /** The first solution found, as a fully decided board. */
  readonly solution: Mark[] | null;
}

/**
 * Counts the loops a layout admits, up to `limit` (two is enough to say
 * "unique"), with T1 + T2 at every node and a LINE / CROSS branch on an open
 * edge — at a chain's end when there is one, else round the clue that still
 * needs the most. Stops at `nodeLimit` nodes, or once it has spent
 * `workLimit` (checked at each node; unlimited by default), and says so.
 *
 * `known` is a solution the caller already holds (the loop the generator
 * grew the board from). It is counted from the start, and the search tries
 * the mark that disagrees with it first, so a board with a second loop gives
 * it up within a few nodes — the case that dominates thinning (§8). It
 * changes the order only: the search is just as exhaustive, and a board is
 * unique only when nothing else turned up.
 */
export function countSolutions(
  layout: Layout,
  options: {
    readonly limit?: number;
    readonly nodeLimit?: number;
    readonly workLimit?: number;
    readonly known?: Marks;
  } = {},
): CountResult {
  const limit = options.limit ?? 2;
  const nodeLimit = options.nodeLimit ?? COUNT_NODE_LIMIT;
  const budgetEnd = work + (options.workLimit ?? Infinity);
  const known = options.known;
  const engine = new Engine(layout);
  engine.level = 2;
  const { grid, clues } = engine;
  let count = known === undefined ? 0 : 1;
  let nodes = 0;
  let aborted = false;
  let solution: Mark[] | null = known === undefined ? null : [...known];
  const pool: State[] = [];

  const branchEdge = (s: State): number => {
    for (let dot = 0; dot < grid.dotCount; dot++) {
      if (s.degree[dot] !== 1) continue;
      for (let k = 0; k < 4; k++) {
        const edge = grid.dotEdges[4 * dot + k]!;
        if (edge >= 0 && s.marks[edge] === UNKNOWN) return edge;
      }
    }
    let best = -1;
    let bestNeed = 0;
    for (let cell = 0; cell < grid.cellCount; cell++) {
      const clue = clues[cell]!;
      if (clue <= 0) continue;
      let lines = 0;
      let open = -1;
      for (let k = 0; k < 4; k++) {
        const edge = grid.cellEdges[4 * cell + k]!;
        const mark = s.marks[edge]!;
        if (mark === LINE) lines++;
        else if (mark === UNKNOWN && open < 0) open = edge;
      }
      if (open >= 0 && clue - lines > bestNeed) {
        bestNeed = clue - lines;
        best = open;
      }
    }
    if (best >= 0) return best;
    return s.marks.indexOf(UNKNOWN);
  };

  const isKnown = (s: State): boolean => {
    if (known === undefined) return false;
    for (let edge = 0; edge < grid.edgeCount; edge++) {
      if ((s.marks[edge] === LINE) !== (known[edge] === LINE)) return false;
    }
    return true;
  };

  const search = (s: State, depth: number): void => {
    if (count >= limit || aborted) return;
    if (++nodes > nodeLimit || work > budgetEnd) {
      aborted = true;
      return;
    }
    work++;
    if (!engine.propagate(s)) return;
    if (s.unknown === 0) {
      if (s.closed && s.lines > 0 && !isKnown(s)) {
        count++;
        solution ??= toMarks(s);
      }
      return;
    }
    const edge = branchEdge(s);
    const first: Mark = known !== undefined && known[edge] === LINE ? CROSS : LINE;
    const second: Mark = first === LINE ? CROSS : LINE;
    const branch = copyState((pool[depth] ??= cloneState(s)), s);
    if (engine.assign(branch, edge, first)) search(branch, depth + 1);
    else engine.clearQueues();
    if (count >= limit || aborted) return;
    if (engine.assign(s, edge, second)) search(s, depth + 1);
    else engine.clearQueues();
  };

  search(engine.fresh(), 0);
  return { count, complete: !aborted || count >= limit, nodes, solution };
}

/** Exactly one solution, proven within the node (and work) limit (§8). Null otherwise. */
export function uniqueSolution(
  layout: Layout,
  options: {
    readonly nodeLimit?: number;
    readonly workLimit?: number;
    readonly known?: Marks;
  } = {},
): Mark[] | null {
  const result = countSolutions(layout, { limit: 2, ...options });
  return result.complete && result.count === 1 ? result.solution : null;
}

// ---------- the Hint's next step (§6) ----------

export interface SolveStep {
  readonly edge: number;
  /** What the edge must be: LINE or CROSS. */
  readonly mark: Mark;
  /** The cheapest technique set that finds it (§7). */
  readonly level: Level;
  /** Where it was read from: the number, the dot, the closing chain, or a trial. */
  readonly anchor: Anchor;
}

/**
 * The next thing the techniques settle on this board (§6): T1 first — one
 * rule, one place, read from the marks exactly as they are — then T2, read
 * from those marks and the corner facts they give, then T3; within a level,
 * a LINE before a CROSS (a LINE moves the loop on; a CROSS is a note). Null
 * when nothing can be said — the board is finished, contradicts itself, or
 * the work limit ran out.
 */
export function findStep(layout: Layout, marks: Marks): SolveStep | null {
  const engine = new Engine(layout);
  const s = engine.fresh();
  if (!engine.seed(s, marks)) return null;
  engine.clearQueues();
  const pick = (log: readonly Deduction[], level: Level): SolveStep | null => {
    const fresh = log.filter((d) => marks[d.edge] === UNKNOWN);
    const choice = fresh.find((d) => d.mark === LINE) ?? fresh[0];
    return choice === undefined ? null : { ...choice, level };
  };

  // T1, one rule at one place on the marks exactly as the player sees them —
  // never a conclusion that leans on a CROSS the player has not written.
  engine.level = 1;
  const single = pick(engine.singleSteps(s), 1);
  if (single !== null) return single;

  // T2 runs dry: it learns corner facts from the marks as they stand and
  // logs every edge those facts decide, but writes none of them. Each
  // conclusion therefore rests on what the player sees (and on facts read
  // from it), never on a mark the engine wrote and the player has not —
  // a full fixpoint's later conclusions often do (§6). An empty log means
  // the marks are already a T1 + T2 fixpoint: the first edge a written
  // propagation would decide is one this run logs.
  engine.level = 2;
  engine.queueAll();
  const log: Deduction[] = [];
  engine.log = log;
  engine.beginDry();
  const ok = engine.propagate(s);
  engine.endDry();
  engine.log = null;
  if (!ok) return null;
  const corner = pick(log, 2);
  if (corner !== null) return corner;
  if (s.unknown === 0) return null;

  engine.level = 3;
  const trialLog: Deduction[] = [];
  engine.log = trialLog;
  const decided = engine.trialRound(s, work + TECHNIQUE_WORK_LIMIT, true);
  engine.log = null;
  if (typeof decided !== 'number' || decided === 0) return null;
  // The trial's own conclusion comes first in the log; what it then implies follows.
  const first = trialLog.find((d) => d.anchor.kind === 'trial');
  return first === undefined ? null : { ...first, level: 3 };
}

export type Hint =
  /** A mark that disagrees with the answer (§6, step 1). */
  | { readonly kind: 'wrong'; readonly edge: number; readonly mark: Mark }
  /** The next deduction (§6, step 2). */
  | { readonly kind: 'step'; readonly step: SolveStep }
  /** The techniques are silent: one edge of the verified answer (§6, step 3). */
  | { readonly kind: 'reveal'; readonly edge: number; readonly mark: Mark };

/** The edge a hint marks, whatever its kind. */
export const hintEdge = (hint: Hint): number => (hint.kind === 'step' ? hint.step.edge : hint.edge);

/** The mark a hint says its edge must take (for 'wrong': the mark that is there now). */
export const hintMark = (hint: Hint): Mark => (hint.kind === 'step' ? hint.step.mark : hint.mark);

/** Whether two hints say the same thing about the same place (§6: asked again, counted once). */
export function sameHint(a: Hint, b: Hint): boolean {
  if (a.kind !== b.kind || hintEdge(a) !== hintEdge(b) || hintMark(a) !== hintMark(b)) return false;
  if (a.kind !== 'step' || b.kind !== 'step') return true;
  return (
    a.step.level === b.step.level &&
    a.step.anchor.kind === b.step.anchor.kind &&
    a.step.anchor.index === b.step.anchor.index
  );
}

/**
 * The board the Hint reads (§6): the player's marks, with a CROSS on every
 * edge they left open that is already settled in plain sight —
 *
 * - the open sides of a number the board shows as met (§5: a 0 from the
 *   first frame, any other number once its lines are all drawn),
 * - the other edges of a dot two lines already meet at (a third would
 *   branch — §3), and
 * - the edges in `hinted`: those an earlier hint showed must be CROSS.
 *
 * A CROSS is a note nobody has to write (§3), so a hint must never wait for
 * one: read from the bare marks, a player who writes no CROSS would be shown
 * the same CROSS beside a 0 on every tap and never reach a line (the
 * 2026-10-17 review). Only read once no mark disagrees with the answer, so
 * every CROSS added here is one the answer has (a met number's lines are
 * then its right lines, and every hint given was proven or revealed).
 */
export function hintMarks(layout: Layout, marks: Marks, hinted: readonly number[] = []): Mark[] {
  const grid = gridFor(layout.width, layout.height);
  const seen = [...marks];
  for (let cell = 0; cell < grid.cellCount; cell++) {
    const clue = layout.clues[cell];
    if (clue === null || clue === undefined) continue;
    let lines = 0;
    for (let k = 0; k < 4; k++) if (marks[grid.cellEdges[4 * cell + k]!] === LINE) lines++;
    if (lines !== clue) continue;
    for (let k = 0; k < 4; k++) {
      const edge = grid.cellEdges[4 * cell + k]!;
      if (seen[edge] === UNKNOWN) seen[edge] = CROSS;
    }
  }
  for (let dot = 0; dot < grid.dotCount; dot++) {
    let lines = 0;
    for (let k = 0; k < 4; k++) {
      const edge = grid.dotEdges[4 * dot + k]!;
      if (edge >= 0 && marks[edge] === LINE) lines++;
    }
    if (lines !== 2) continue;
    for (let k = 0; k < 4; k++) {
      const edge = grid.dotEdges[4 * dot + k]!;
      if (edge >= 0 && seen[edge] === UNKNOWN) seen[edge] = CROSS;
    }
  }
  for (const edge of hinted) if (seen[edge] === UNKNOWN) seen[edge] = CROSS;
  return seen;
}

/**
 * The hint of §6: a mark that disagrees with the answer (a LINE first, then
 * a CROSS), else the next step the techniques prove from the board the Hint
 * reads (`hintMarks` — the player's marks and the CROSSes already settled in
 * plain sight or by an earlier hint), else one open edge of the answer.
 * Never writes to the board. Null when there is nothing left to say — every
 * edge agrees and the loop is done.
 *
 * `hinted` is the edges earlier hints showed must be CROSS; an edge the
 * answer does not cross out is ignored, so a stray entry can never mislead.
 */
export function findHint(
  layout: Layout,
  solution: Marks,
  marks: Marks,
  hinted: readonly number[] = [],
): Hint | null {
  for (let edge = 0; edge < marks.length; edge++) {
    if (marks[edge] === LINE && solution[edge] !== LINE) return { kind: 'wrong', edge, mark: LINE };
  }
  for (let edge = 0; edge < marks.length; edge++) {
    if (marks[edge] === CROSS && solution[edge] === LINE) {
      return { kind: 'wrong', edge, mark: CROSS };
    }
  }
  const seen = hintMarks(
    layout,
    marks,
    hinted.filter((edge) => solution[edge] === CROSS),
  );
  const step = findStep(layout, seen);
  if (step !== null) return { kind: 'step', step };
  // Prefer an answer LINE the player has not drawn, then an answer CROSS.
  for (const mark of [LINE, CROSS] as const) {
    for (let edge = 0; edge < seen.length; edge++) {
      if (seen[edge] === UNKNOWN && solution[edge] === mark) return { kind: 'reveal', edge, mark };
    }
  }
  return null;
}
