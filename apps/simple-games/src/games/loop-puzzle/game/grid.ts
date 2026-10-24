/**
 * The lattice of docs/LOOP_PUZZLE_RULES.md §1: how cells, dots and edges are
 * numbered and how they touch. Built once per board size and cached — every
 * rule, the solver, the generator and the save format read the same tables,
 * so there is one numbering and nothing to keep in sync.
 *
 * Numbering (§1):
 *
 * - cell (r, c) = r·W + c, for r < H, c < W;
 * - dot (r, c) = r·(W+1) + c, for r ≤ H, c ≤ W;
 * - horizontal edge (r, c) = r·W + c — from dot (r, c) to dot (r, c+1),
 *   for r ≤ H, c < W;
 * - vertical edge (r, c) = (H+1)·W + r·(W+1) + c — from dot (r, c) to dot
 *   (r+1, c), for r < H, c ≤ W.
 *
 * A cell's four edges are kept in the order top, right, bottom, left. Its
 * four corners are numbered 4·cell + j with j = 0 top-left, 1 top-right,
 * 2 bottom-right, 3 bottom-left; corner j is the pair of the cell's edges
 * that meet at that dot (the T2 technique reads them — §7).
 */

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly cellCount: number;
  readonly dotCount: number;
  readonly edgeCount: number;
  /** Horizontal edges come first; edges at or past this index are vertical. */
  readonly firstVertical: number;
  /** edge → its two dots, as [2e] and [2e + 1]. */
  readonly edgeDots: Int16Array;
  /** edge → the cells on either side, as [2e] and [2e + 1]; -1 off the board. */
  readonly edgeCells: Int16Array;
  /** cell → its edges [4c + 0..3] = top, right, bottom, left. */
  readonly cellEdges: Int16Array;
  /** dot → its edges [4d + 0..3] = up, right, down, left; -1 off the board. */
  readonly dotEdges: Int16Array;
  /** dot → how many edges it has: 4 inside, 3 on a side, 2 at a board corner. */
  readonly dotDegree: Int8Array;
  /** corner → its two edges, as [2k] and [2k + 1]. */
  readonly cornerEdges: Int16Array;
  /** corner → the dot it sits on. */
  readonly cornerDot: Int16Array;
  /**
   * corner → the dot's other edges, as [2k] and [2k + 1] with -1 for none:
   * two at an inner dot, one on the border, none at a board corner.
   */
  readonly cornerRest: Int16Array;
  /** corner → the corner the rest edges form (the diagonal cell's), or -1. */
  readonly cornerRestCorner: Int16Array;
  /** dot → the corners sitting on it, [4d + 0..3], -1 for none. */
  readonly dotCorners: Int16Array;
}

const cache = new Map<string, Grid>();

/** The lattice for a W×H board — built once per size and shared. */
export function gridFor(width: number, height: number): Grid {
  const key = `${width}x${height}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const grid = buildGrid(width, height);
  cache.set(key, grid);
  return grid;
}

export const horizontalEdge = (grid: Grid, row: number, col: number): number =>
  row * grid.width + col;

export const verticalEdge = (grid: Grid, row: number, col: number): number =>
  grid.firstVertical + row * (grid.width + 1) + col;

export const dotIndex = (grid: Grid, row: number, col: number): number =>
  row * (grid.width + 1) + col;

export const isHorizontal = (grid: Grid, edge: number): boolean => edge < grid.firstVertical;

/**
 * Where an edge sits, for the UI and for reading aloud: its orientation and
 * the dot it starts from (the left end of a horizontal edge, the top end of a
 * vertical one).
 */
export function edgePosition(
  grid: Grid,
  edge: number,
): { readonly horizontal: boolean; readonly row: number; readonly col: number } {
  if (edge < grid.firstVertical) {
    return { horizontal: true, row: Math.floor(edge / grid.width), col: edge % grid.width };
  }
  const local = edge - grid.firstVertical;
  return {
    horizontal: false,
    row: Math.floor(local / (grid.width + 1)),
    col: local % (grid.width + 1),
  };
}

/** The edge joining two dots, or -1 when they are not neighbours. */
export function edgeBetween(grid: Grid, a: number, b: number): number {
  for (let k = 0; k < 4; k++) {
    const edge = grid.dotEdges[4 * a + k]!;
    if (edge < 0) continue;
    const u = grid.edgeDots[2 * edge]!;
    const v = grid.edgeDots[2 * edge + 1]!;
    if ((u === a && v === b) || (u === b && v === a)) return edge;
  }
  return -1;
}

function buildGrid(width: number, height: number): Grid {
  const W = width;
  const H = height;
  const cellCount = W * H;
  const dotCount = (W + 1) * (H + 1);
  const firstVertical = (H + 1) * W;
  const edgeCount = firstVertical + H * (W + 1);
  const dot = (r: number, c: number): number => r * (W + 1) + c;
  const hEdge = (r: number, c: number): number => r * W + c;
  const vEdge = (r: number, c: number): number => firstVertical + r * (W + 1) + c;

  const edgeDots = new Int16Array(2 * edgeCount);
  const edgeCells = new Int16Array(2 * edgeCount).fill(-1);
  for (let r = 0; r <= H; r++) {
    for (let c = 0; c < W; c++) {
      const e = hEdge(r, c);
      edgeDots[2 * e] = dot(r, c);
      edgeDots[2 * e + 1] = dot(r, c + 1);
      if (r > 0) edgeCells[2 * e] = (r - 1) * W + c;
      if (r < H) edgeCells[2 * e + 1] = r * W + c;
    }
  }
  for (let r = 0; r < H; r++) {
    for (let c = 0; c <= W; c++) {
      const e = vEdge(r, c);
      edgeDots[2 * e] = dot(r, c);
      edgeDots[2 * e + 1] = dot(r + 1, c);
      if (c > 0) edgeCells[2 * e] = r * W + c - 1;
      if (c < W) edgeCells[2 * e + 1] = r * W + c;
    }
  }

  const cellEdges = new Int16Array(4 * cellCount);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = r * W + c;
      cellEdges[4 * cell] = hEdge(r, c);
      cellEdges[4 * cell + 1] = vEdge(r, c + 1);
      cellEdges[4 * cell + 2] = hEdge(r + 1, c);
      cellEdges[4 * cell + 3] = vEdge(r, c);
    }
  }

  const dotEdges = new Int16Array(4 * dotCount).fill(-1);
  for (let r = 0; r <= H; r++) {
    for (let c = 0; c <= W; c++) {
      const d = dot(r, c);
      if (r > 0) dotEdges[4 * d] = vEdge(r - 1, c);
      if (c < W) dotEdges[4 * d + 1] = hEdge(r, c);
      if (r < H) dotEdges[4 * d + 2] = vEdge(r, c);
      if (c > 0) dotEdges[4 * d + 3] = hEdge(r, c - 1);
    }
  }

  const dotDegree = new Int8Array(dotCount);
  for (let d = 0; d < dotCount; d++) {
    for (let k = 0; k < 4; k++) if (dotEdges[4 * d + k]! >= 0) dotDegree[d]!++;
  }

  const cornerCount = 4 * cellCount;
  const cornerEdges = new Int16Array(2 * cornerCount);
  const cornerDot = new Int16Array(cornerCount);
  const cornerRest = new Int16Array(2 * cornerCount).fill(-1);
  const cornerRestCorner = new Int16Array(cornerCount).fill(-1);
  const dotCorners = new Int16Array(4 * dotCount).fill(-1);
  const dotCornerFill = new Uint8Array(dotCount);
  // Corner j of a cell: which of the cell's edges (top 0 / right 1 / bottom 2
  // / left 3) meet there, and the dot's offset from the cell's top-left dot.
  const CORNER_SIDES = [
    [0, 3],
    [0, 1],
    [2, 1],
    [2, 3],
  ] as const;
  const CORNER_OFFSET = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ] as const;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cell = r * W + c;
      for (let j = 0; j < 4; j++) {
        const k = 4 * cell + j;
        const [a, b] = CORNER_SIDES[j]!;
        const ea = cellEdges[4 * cell + a]!;
        const eb = cellEdges[4 * cell + b]!;
        cornerEdges[2 * k] = ea;
        cornerEdges[2 * k + 1] = eb;
        const [dr, dc] = CORNER_OFFSET[j]!;
        const d = dot(r + dr, c + dc);
        cornerDot[k] = d;
        dotCorners[4 * d + dotCornerFill[d]!++] = k;
        let rest = 0;
        for (let side = 0; side < 4; side++) {
          const e = dotEdges[4 * d + side]!;
          if (e < 0 || e === ea || e === eb) continue;
          cornerRest[2 * k + rest++] = e;
        }
      }
    }
  }
  // The rest of an inner dot is two perpendicular edges, which bound exactly
  // one cell: the diagonal neighbour's corner on the same dot.
  for (let k = 0; k < cornerCount; k++) {
    const r0 = cornerRest[2 * k]!;
    const r1 = cornerRest[2 * k + 1]!;
    if (r0 < 0 || r1 < 0) continue;
    const d = cornerDot[k]!;
    for (let s = 0; s < 4; s++) {
      const other = dotCorners[4 * d + s]!;
      if (other < 0 || other === k) continue;
      const o0 = cornerEdges[2 * other]!;
      const o1 = cornerEdges[2 * other + 1]!;
      if ((o0 === r0 && o1 === r1) || (o0 === r1 && o1 === r0)) cornerRestCorner[k] = other;
    }
  }

  return {
    width,
    height,
    cellCount,
    dotCount,
    edgeCount,
    firstVertical,
    edgeDots,
    edgeCells,
    cellEdges,
    dotEdges,
    dotDegree,
    cornerEdges,
    cornerDot,
    cornerRest,
    cornerRestCorner,
    dotCorners,
  };
}
