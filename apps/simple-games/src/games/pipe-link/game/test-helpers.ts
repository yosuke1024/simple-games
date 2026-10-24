/**
 * Test-only helpers (never imported by the app): a spanning-tree enumerator
 * and a brute-force solution counter written WITHOUT tiles.ts / board.ts /
 * solver.ts, so the exhaustive check (docs/PIPE_LINK_RULES.md §13) compares
 * the solver against an independent implementation. It keeps its own pipe
 * tables and its own connectivity check.
 */

/** Orientation k's pipe mask per type letter (bit 0 up, 1 right, 2 down, 3 left), written out by hand. */
export const INDEPENDENT_MASKS: Readonly<Record<string, readonly number[]>> = {
  e: [0b0001, 0b0010, 0b0100, 0b1000],
  s: [0b0101, 0b1010],
  l: [0b0011, 0b0110, 0b1100, 0b1001],
  t: [0b0111, 0b1110, 0b1101, 0b1011],
};

const LETTER_OF_TYPE: Readonly<Record<string, string>> = {
  end: 'e',
  straight: 's',
  elbow: 'l',
  tee: 't',
};

/** One grid edge between two cells: `a` is the left / upper cell. */
export interface GridEdge {
  readonly a: number;
  readonly b: number;
  readonly horizontal: boolean;
}

export function gridEdges(width: number, height: number): GridEdge[] {
  const edges: GridEdge[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      if (col + 1 < width) edges.push({ a: i, b: i + 1, horizontal: true });
      if (row + 1 < height) edges.push({ a: i, b: i + width, horizontal: false });
    }
  }
  return edges;
}

/**
 * Every spanning tree of the width × height grid whose degrees are all ≤ 3,
 * as per-cell pipe masks (bit 0 up, 1 right, 2 down, 3 left).
 */
export function spanningTreesMaxDegree3(width: number, height: number): number[][] {
  const n = width * height;
  const edges = gridEdges(width, height);
  const out: number[][] = [];
  const masks = new Array<number>(n).fill(0);
  const degree = new Array<number>(n).fill(0);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x]!;
    return x;
  };
  const walk = (index: number, used: number): void => {
    if (used === n - 1) {
      out.push([...masks]);
      return;
    }
    if (edges.length - index < n - 1 - used) return;
    const edge = edges[index]!;
    const ra = find(edge.a);
    const rb = find(edge.b);
    if (ra !== rb && degree[edge.a]! < 3 && degree[edge.b]! < 3) {
      const bitA = edge.horizontal ? 0b0010 : 0b0100;
      const bitB = edge.horizontal ? 0b1000 : 0b0001;
      masks[edge.a] = masks[edge.a]! | bitA;
      masks[edge.b] = masks[edge.b]! | bitB;
      degree[edge.a] = degree[edge.a]! + 1;
      degree[edge.b] = degree[edge.b]! + 1;
      parent[ra] = rb;
      walk(index + 1, used + 1);
      parent[ra] = ra;
      degree[edge.a] = degree[edge.a]! - 1;
      degree[edge.b] = degree[edge.b]! - 1;
      masks[edge.a] = masks[edge.a]! & ~bitA;
      masks[edge.b] = masks[edge.b]! & ~bitB;
    }
    walk(index + 1, used);
  };
  walk(0, 0);
  return out;
}

/** The type letter and orientation of a tree cell's mask, read from the independent table. */
export function letterOfMask(mask: number): { letter: string; orientation: number } {
  for (const [letter, list] of Object.entries(INDEPENDENT_MASKS)) {
    const orientation = list.indexOf(mask);
    if (orientation >= 0) return { letter, orientation };
  }
  throw new RangeError(`mask ${mask} is no tile`);
}

export function letterOfType(type: string): string {
  const letter = LETTER_OF_TYPE[type];
  if (letter === undefined) throw new RangeError(`unknown type ${type}`);
  return letter;
}

/** True when the masks form a spanning tree with every mouth matched (own BFS, own counting). */
function independentlySolved(width: number, height: number, masks: readonly number[]): boolean {
  const n = width * height;
  let links = 0;
  const adjacency: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const col = i % width;
    const row = Math.floor(i / width);
    const m = masks[i]!;
    // Mouths into the edge, or unmatched mouths, fail at once.
    if (m & 0b0001 && (row === 0 || !(masks[i - width]! & 0b0100))) return false;
    if (m & 0b0010 && (col === width - 1 || !(masks[i + 1]! & 0b1000))) return false;
    if (m & 0b0100 && (row === height - 1 || !(masks[i + width]! & 0b0001))) return false;
    if (m & 0b1000 && (col === 0 || !(masks[i - 1]! & 0b0010))) return false;
    if (m & 0b0010) {
      links++;
      adjacency[i]!.push(i + 1);
      adjacency[i + 1]!.push(i);
    }
    if (m & 0b0100) {
      links++;
      adjacency[i]!.push(i + width);
      adjacency[i + width]!.push(i);
    }
  }
  if (links !== n - 1) return false;
  const seen = new Array<boolean>(n).fill(false);
  const stack = [0];
  seen[0] = true;
  let reached = 1;
  while (stack.length > 0) {
    for (const j of adjacency[stack.pop()!]!) {
      if (!seen[j]) {
        seen[j] = true;
        reached++;
        stack.push(j);
      }
    }
  }
  return reached === n;
}

/**
 * Every solution of a board given by type letters, by brute force: cells in
 * row-major order, pruned only by the board's edge and the left / upper
 * neighbour's matching pipe; leaves checked with an own BFS. Returns the
 * solutions as orientation arrays, in lexicographic order.
 */
export function bruteForceSolutions(
  width: number,
  height: number,
  letters: readonly string[],
): number[][] {
  const n = width * height;
  const masks = new Array<number>(n).fill(0);
  const chosen = new Array<number>(n).fill(0);
  const out: number[][] = [];
  const place = (i: number): void => {
    if (i === n) {
      if (independentlySolved(width, height, masks)) out.push([...chosen]);
      return;
    }
    const col = i % width;
    const row = Math.floor(i / width);
    const list = INDEPENDENT_MASKS[letters[i]!]!;
    for (let k = 0; k < list.length; k++) {
      const m = list[k]!;
      if (row === 0 && m & 0b0001) continue;
      if (row === height - 1 && m & 0b0100) continue;
      if (col === 0 && m & 0b1000) continue;
      if (col === width - 1 && m & 0b0010) continue;
      if (col > 0 && Boolean(masks[i - 1]! & 0b0010) !== Boolean(m & 0b1000)) continue;
      if (row > 0 && Boolean(masks[i - width]! & 0b0100) !== Boolean(m & 0b0001)) continue;
      masks[i] = m;
      chosen[i] = k;
      place(i + 1);
    }
    masks[i] = 0;
  };
  place(0);
  return out;
}

/** Every orientation array of a board (the full product of the types' periods), in lexicographic order. */
export function allOrientations(letters: readonly string[]): number[][] {
  const out: number[][] = [];
  const current = new Array<number>(letters.length).fill(0);
  const walk = (i: number): void => {
    if (i === letters.length) {
      out.push([...current]);
      return;
    }
    const period = INDEPENDENT_MASKS[letters[i]!]!.length;
    for (let k = 0; k < period; k++) {
      current[i] = k;
      walk(i + 1);
    }
  };
  walk(0);
  return out;
}

export interface IndependentCount {
  /** Solutions found, up to the limit — exact only when `complete`. */
  readonly count: number;
  readonly complete: boolean;
  readonly nodes: number;
  readonly solutions: readonly number[][];
}

/**
 * A second, independent solution counter for boards too large for
 * `bruteForceSolutions` (the 1,000-seed check — docs/PIPE_LINK_RULES.md §13).
 * Shares no code with solver.ts and no tables with tiles.ts: it places cells
 * in row-major order from INDEPENDENT_MASKS, matches each pipe against the
 * left and upper neighbours and the board's edge, and keeps a union-find
 * (with rollback) of the joined cells, cutting a branch when a join closes a
 * loop or a group runs out of pipes still pointing at unplaced cells while
 * it is not the whole board. A leaf that survives is a spanning tree with
 * every mouth matched. Stops at `limit` solutions, or `nodeLimit` nodes
 * (then `complete` is false).
 */
export function independentCount(
  width: number,
  height: number,
  letters: readonly string[],
  limit = 2,
  nodeLimit = 5_000_000,
): IndependentCount {
  const n = width * height;
  const masks = new Array<number>(n).fill(0);
  const chosen = new Array<number>(n).fill(0);
  const parent = Array.from({ length: n }, (_, i) => i);
  const size = new Array<number>(n).fill(1);
  /** Per root: pipes of the group still pointing at unplaced cells. */
  const pending = new Array<number>(n).fill(0);
  const solutions: number[][] = [];
  let nodes = 0;
  let complete = true;
  // Rollback log: [kind, a, b] — kind 0 = union (child a under root b), 1 = pending change (cell a by b).
  const log: number[] = [];
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x]!;
    return x;
  };
  const addPending = (root: number, delta: number): void => {
    pending[root] = pending[root]! + delta;
    log.push(1, root, delta);
  };
  /** Joins i to its placed neighbour j; false when the join closes a loop. */
  const join = (i: number, j: number): boolean => {
    let a = find(i);
    let b = find(j);
    if (a === b) return false;
    if (size[a]! > size[b]!) {
      const t = a;
      a = b;
      b = t;
    }
    parent[a] = b;
    size[b] = size[b]! + size[a]!;
    log.push(0, a, b);
    addPending(b, pending[a]!);
    return true;
  };
  const undoTo = (mark: number): void => {
    while (log.length > mark) {
      const b = log.pop()!;
      const a = log.pop()!;
      const kind = log.pop()!;
      if (kind === 1) pending[a] = pending[a]! - b;
      else {
        parent[a] = a;
        size[b] = size[b]! - size[a]!;
      }
    }
  };
  const place = (i: number): boolean => {
    // Returns false to stop the whole search.
    if (i === n) {
      solutions.push([...chosen]);
      return solutions.length < limit;
    }
    if (nodes >= nodeLimit) {
      complete = false;
      return false;
    }
    nodes++;
    const col = i % width;
    const row = Math.floor(i / width);
    const list = INDEPENDENT_MASKS[letters[i]!]!;
    for (let k = 0; k < list.length; k++) {
      const m = list[k]!;
      if (row === 0 && m & 0b0001) continue;
      if (row === height - 1 && m & 0b0100) continue;
      if (col === 0 && m & 0b1000) continue;
      if (col === width - 1 && m & 0b0010) continue;
      if (col > 0 && Boolean(masks[i - 1]! & 0b0010) !== Boolean(m & 0b1000)) continue;
      if (row > 0 && Boolean(masks[i - width]! & 0b0100) !== Boolean(m & 0b0001)) continue;
      const mark = log.length;
      masks[i] = m;
      chosen[i] = k;
      // The new cell's own pipes toward unplaced cells: right and down.
      addPending(i, (m & 0b0010 ? 1 : 0) + (m & 0b0100 ? 1 : 0));
      let ok = true;
      if (m & 0b1000) {
        addPending(find(i - 1), -1);
        ok = join(i, i - 1);
      }
      if (ok && m & 0b0001) {
        addPending(find(i - width), -1);
        ok = join(i, i - width);
      }
      if (ok) {
        const root = find(i);
        if (pending[root] === 0 && size[root]! < n) ok = false;
      }
      if (ok && !place(i + 1)) {
        undoTo(mark);
        masks[i] = 0;
        return false;
      }
      undoTo(mark);
      masks[i] = 0;
    }
    return true;
  };
  place(0);
  return { count: solutions.length, complete, nodes, solutions };
}
