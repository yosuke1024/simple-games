/**
 * Test-only helpers for docs/LOOP_PUZZLE_RULES.md §16「検証の範囲」. Nothing in
 * the game imports this file.
 *
 * `oracleCount` is the **independent** uniqueness check. It shares no code
 * and no formulation with `solver.ts`: where the solver marks edges and
 * reasons about dots, corners and chains, the oracle colours cells. A
 * simple loop on the lattice is exactly the boundary of a non-empty set of
 * cells that is one 4-connected piece whose outside (together with the world
 * beyond the board) is one 4-connected piece too, with no two cells of one
 * colour meeting only at a corner; and a number is how many
 * of the cell's four neighbours — off the board counts as outside — have the
 * other colour. So the oracle tries every colouring cell by cell in reading
 * order, prunes a number only once its neighbours are known, and checks the
 * two connectivity conditions at the leaves. It reads nothing but the rule
 * statement; it is slow, plain and obviously right, which is the point.
 */
import { gridFor } from './grid';
import { CROSS, LINE, UNKNOWN, type Layout, type Mark } from './types';

export interface OracleResult {
  /** Loops found, at most `limit`. */
  readonly count: number;
  /** False when `nodeLimit` cut the walk short: then `count` proves nothing. */
  readonly complete: boolean;
  readonly nodes: number;
  /** The first loop found, as LINE / CROSS per edge. */
  readonly solution: Mark[] | null;
  /** Every loop found, in the order found (at most `limit`). */
  readonly solutions: Mark[][];
}

export function oracleCount(layout: Layout, limit = 2, nodeLimit = 20_000_000): OracleResult {
  const { width: W, height: H, clues } = layout;
  const cells = W * H;
  const colour = new Int8Array(cells).fill(-1);
  let count = 0;
  let nodes = 0;
  let aborted = false;
  const solutions: Mark[][] = [];

  /** 1 inside, 0 outside, -1 not yet coloured; beyond the board is outside. */
  const at = (r: number, c: number): number =>
    r < 0 || c < 0 || r >= H || c >= W ? 0 : colour[r * W + c]!;

  /** Whether a number can still be met: differing neighbours so far vs. the unknown ones. */
  const clueHolds = (r: number, c: number): boolean => {
    const clue = clues[r * W + c];
    if (clue === null || clue === undefined) return true;
    const own = colour[r * W + c]!;
    let differ = 0;
    let unknown = 0;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const n = at(r + dr, c + dc);
      if (n === -1) unknown++;
      else if (n !== own) differ++;
    }
    return differ <= clue && differ + unknown >= clue;
  };

  const connected = (want: number): boolean => {
    // Outside includes the world beyond the board: every outside border cell is joined through it.
    const seen = new Uint8Array(cells);
    const stack: number[] = [];
    let total = 0;
    for (let i = 0; i < cells; i++) {
      if (colour[i] !== want) continue;
      total++;
      const r = Math.floor(i / W);
      const c = i % W;
      const border = r === 0 || c === 0 || r === H - 1 || c === W - 1;
      if (stack.length === 0 && want === 1) {
        seen[i] = 1;
        stack.push(i);
      } else if (want === 0 && border && seen[i] === 0) {
        seen[i] = 1;
        stack.push(i);
      }
    }
    if (total === 0) return want === 0;
    let reached = stack.length;
    while (stack.length > 0) {
      const i = stack.pop()!;
      const r = Math.floor(i / W);
      const c = i % W;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue;
        const j = rr * W + cc;
        if (seen[j] === 1 || colour[j] !== want) continue;
        seen[j] = 1;
        reached++;
        stack.push(j);
      }
    }
    return reached === total;
  };

  /**
   * Two cells of one colour meeting only at a corner, in the 2×2 block whose
   * bottom-right cell is (r, c): the boundary would touch itself there.
   */
  const checkerboardAt = (r: number, c: number): boolean => {
    if (r === 0 || c === 0) return false;
    const a = at(r - 1, c - 1);
    const b = at(r - 1, c);
    const d = at(r, c - 1);
    const e = at(r, c);
    return a === e && b === d && a !== b;
  };

  const checkerboard = (): boolean => {
    for (let r = 1; r < H; r++) {
      for (let c = 1; c < W; c++) if (checkerboardAt(r, c)) return true;
    }
    return false;
  };

  const boundary = (): Mark[] => {
    const grid = gridFor(W, H);
    const marks: Mark[] = [];
    for (let edge = 0; edge < grid.edgeCount; edge++) {
      const a = grid.edgeCells[2 * edge]!;
      const b = grid.edgeCells[2 * edge + 1]!;
      const ca = a < 0 ? 0 : colour[a]!;
      const cb = b < 0 ? 0 : colour[b]!;
      marks.push(ca === cb ? CROSS : LINE);
    }
    return marks;
  };

  const walk = (i: number): void => {
    if (count >= limit || aborted) return;
    if (++nodes > nodeLimit) {
      aborted = true;
      return;
    }
    if (i === cells) {
      if (colour.includes(1) && !checkerboard() && connected(1) && connected(0)) {
        count++;
        solutions.push(boundary());
      }
      return;
    }
    const r = Math.floor(i / W);
    const c = i % W;
    for (const value of [0, 1]) {
      colour[i] = value;
      // Every number whose neighbours could have just changed — above, left,
      // and this cell — and the one 2×2 block this cell completes.
      if (
        clueHolds(r, c) &&
        (r === 0 || clueHolds(r - 1, c)) &&
        (c === 0 || clueHolds(r, c - 1)) &&
        !checkerboardAt(r, c)
      ) {
        walk(i + 1);
      }
      if (count >= limit || aborted) break;
    }
    colour[i] = -1;
  };

  walk(0);
  return {
    count,
    complete: !aborted || count >= limit,
    nodes,
    solution: solutions[0] ?? null,
    solutions,
  };
}

/**
 * What the corner technique (T2, §7) can conclude from a board of marks
 * **without writing a single mark** — the yardstick for the Hint's promise
 * that a T2 step rests on what the player sees (§6).
 *
 * Written apart from the solver's engine, as a plain fixpoint over every
 * cell and corner (no queues, no chains, no shared code): each corner's
 * LINE count has bounds from its two marks and from the two facts T2 can
 * remember about it — "at least one" and "at most one" (§7) — and the three
 * readings of §7 narrow them until nothing changes. An edge is concluded
 * whenever a narrowed corner, or a border dot's lone other edge, leaves it
 * one way to go. The marks themselves are never changed, so nothing
 * concluded here leans on anything but the marks and facts read from them.
 *
 * Null when the readings contradict the marks.
 */
export function cornerConclusions(
  layout: Layout,
  marks: readonly Mark[],
): Map<number, Mark> | null {
  const grid = gridFor(layout.width, layout.height);
  const corners = 4 * grid.cellCount;
  const atLeastOne = new Uint8Array(corners);
  const atMostOne = new Uint8Array(corners);
  const out = new Map<number, Mark>();
  let broken = false;

  const conclude = (edge: number, mark: Mark): void => {
    if (marks[edge] !== UNKNOWN) {
      if (marks[edge] !== mark) broken = true;
      return;
    }
    const before = out.get(edge);
    if (before !== undefined && before !== mark) broken = true;
    out.set(edge, mark);
  };

  const edgesOf = (corner: number): [number, number] => [
    grid.cornerEdges[2 * corner]!,
    grid.cornerEdges[2 * corner + 1]!,
  ];

  const boundsOf = (corner: number): [number, number] => {
    let lo = 0;
    let hi = 2;
    for (const edge of edgesOf(corner)) {
      if (marks[edge] === LINE) lo++;
      if (marks[edge] === CROSS) hi--;
    }
    if (atLeastOne[corner] === 1) lo = Math.max(lo, 1);
    if (atMostOne[corner] === 1) hi = Math.min(hi, 1);
    return [lo, hi];
  };

  /** Narrows a corner to [lo, hi]; true when it learned a new fact. */
  const narrow = (corner: number, lo: number, hi: number): boolean => {
    const [ownLo, ownHi] = boundsOf(corner);
    lo = Math.max(lo, ownLo);
    hi = Math.min(hi, ownHi);
    if (lo > hi) {
      broken = true;
      return false;
    }
    let learned = false;
    if (lo >= 1 && atLeastOne[corner] === 0) {
      atLeastOne[corner] = 1;
      learned = true;
    }
    if (hi <= 1 && atMostOne[corner] === 0) {
      atMostOne[corner] = 1;
      learned = true;
    }
    const [e1, e2] = edgesOf(corner);
    const open = [e1, e2].filter((edge) => marks[edge] === UNKNOWN);
    if (open.length === 2) {
      if (lo === 2) for (const edge of open) conclude(edge, LINE);
      if (hi === 0) for (const edge of open) conclude(edge, CROSS);
    } else if (open.length === 1) {
      const other = open[0] === e1 ? e2 : e1;
      const known = marks[other] === LINE ? 1 : 0;
      const canLine = lo <= known + 1 && known + 1 <= hi;
      const canCross = lo <= known && known <= hi;
      if (!canLine && !canCross) broken = true;
      else if (!canLine) conclude(open[0]!, CROSS);
      else if (!canCross) conclude(open[0]!, LINE);
    }
    return learned;
  };

  for (let changed = true; changed && !broken;) {
    changed = false;
    // A number: its two opposite corners add up to it.
    for (let cell = 0; cell < grid.cellCount; cell++) {
      const clue = layout.clues[cell];
      if (clue === null || clue === undefined) continue;
      for (const j of [0, 1]) {
        const p = 4 * cell + j;
        const q = 4 * cell + (j ^ 2);
        const [loQ, hiQ] = boundsOf(q);
        if (narrow(p, clue - hiQ, clue - loQ)) changed = true;
        const [loP, hiP] = boundsOf(p);
        if (narrow(q, clue - hiP, clue - loP)) changed = true;
      }
    }
    // A dot: a corner and the dot's other edges add up to 0 or 2.
    for (let corner = 0; corner < corners; corner++) {
      const restCorner = grid.cornerRestCorner[corner]!;
      const r0 = grid.cornerRest[2 * corner]!;
      const lone = restCorner < 0 && r0 >= 0 ? r0 : -1;
      const [loP, hiP] = boundsOf(corner);
      let [loR, hiR] = [0, 0];
      if (restCorner >= 0) [loR, hiR] = boundsOf(restCorner);
      else if (lone >= 0)
        [loR, hiR] = [marks[lone] === LINE ? 1 : 0, marks[lone] === CROSS ? 0 : 1];
      const ps: number[] = [];
      const rs: number[] = [];
      for (let p = loP; p <= hiP; p++) {
        for (let r = loR; r <= hiR; r++) {
          if (p + r !== 0 && p + r !== 2) continue;
          ps.push(p);
          rs.push(r);
        }
      }
      if (ps.length === 0) {
        broken = true;
        break;
      }
      if (narrow(corner, Math.min(...ps), Math.max(...ps))) changed = true;
      if (restCorner >= 0) {
        if (narrow(restCorner, Math.min(...rs), Math.max(...rs))) changed = true;
      } else if (lone >= 0 && marks[lone] === UNKNOWN) {
        if (Math.min(...rs) === 1) conclude(lone, LINE);
        if (Math.max(...rs) === 0) conclude(lone, CROSS);
      }
    }
  }
  return broken ? null : out;
}
