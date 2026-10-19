/**
 * The rules of docs/BRIDGES_RULES.md §1–§4, read in one place.
 *
 * `buildGraph` turns a layout into the edges a bridge may take: from each
 * island, the first island to its right and the first island below it —
 * never one further along, since a bridge cannot pass over an island (§2).
 * Two edges cross when one runs across a cell the other runs down; a bridge
 * may not cross another (§2), so at most one of the two can carry any.
 *
 * Every reader of the rules goes through here: the win (`isSolved`), the
 * move (`cycleBridge`), the display (`islandStates`), the solver's start
 * (solver.ts), the generator's answer check and the save's fail-closed
 * decode (serialize.ts). There is no second reading of what a legal board is.
 */
import {
  MAX_BRIDGES_PER_PAIR,
  MAX_ISLAND_VALUE,
  MIN_ISLAND_VALUE,
  colOf,
  rowOf,
  type Bridges,
  type Layout,
} from './types';

/** One place a bridge may run: between two islands that see each other (§2). */
export interface Edge {
  readonly id: number;
  /** The island ordinal on the left (a horizontal edge) or on top (a vertical one). */
  readonly a: number;
  /** The island ordinal on the right or below. */
  readonly b: number;
  readonly horizontal: boolean;
  /** The water cells strictly between the two islands, from a to b. */
  readonly cells: readonly number[];
}

export interface Graph {
  readonly layout: Layout;
  /**
   * Every edge, in a fixed order: islands in index order, and for each its
   * edge to the right before its edge downward. A save stores bridges in
   * this order (§10), so it is part of the format.
   */
  readonly edges: readonly Edge[];
  /** The edge ids touching each island, by ordinal. */
  readonly islandEdges: readonly (readonly number[])[];
  /** The edge ids each edge crosses (§2). */
  readonly crossings: readonly (readonly number[])[];
  /** The island ordinal on each cell, or -1 for water. */
  readonly islandAt: readonly number[];
}

export type Direction = 'up' | 'down' | 'left' | 'right';
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/**
 * The graph of a layout. Assumes a structurally valid layout (`isValidLayout`);
 * an island with nothing in sight simply has no edges.
 */
export function buildGraph(layout: Layout): Graph {
  const { width, height, islands } = layout;
  const islandAt = new Array<number>(width * height).fill(-1);
  islands.forEach((island, ordinal) => {
    islandAt[island.index] = ordinal;
  });

  const edges: Edge[] = [];
  const islandEdges: number[][] = islands.map(() => []);
  const across = new Array<number>(width * height).fill(-1);
  const down = new Array<number>(width * height).fill(-1);

  const add = (a: number, b: number, horizontal: boolean, cells: number[]): void => {
    const id = edges.length;
    edges.push({ id, a, b, horizontal, cells });
    islandEdges[a]!.push(id);
    islandEdges[b]!.push(id);
    for (const cell of cells) (horizontal ? across : down)[cell] = id;
  };

  islands.forEach((island, ordinal) => {
    const row = rowOf(island.index, width);
    const col = colOf(island.index, width);
    // Right: the first island in the same row.
    const rightCells: number[] = [];
    for (let c = col + 1; c < width; c++) {
      const cell = row * width + c;
      const other = islandAt[cell]!;
      if (other !== -1) {
        add(ordinal, other, true, rightCells);
        break;
      }
      rightCells.push(cell);
    }
    // Down: the first island in the same column.
    const downCells: number[] = [];
    for (let r = row + 1; r < height; r++) {
      const cell = r * width + col;
      const other = islandAt[cell]!;
      if (other !== -1) {
        add(ordinal, other, false, downCells);
        break;
      }
      downCells.push(cell);
    }
  });

  // Two edges cross exactly where one runs across a cell the other runs down.
  const crossings: number[][] = edges.map(() => []);
  for (let cell = 0; cell < width * height; cell++) {
    const h = across[cell]!;
    const v = down[cell]!;
    if (h === -1 || v === -1) continue;
    crossings[h]!.push(v);
    crossings[v]!.push(h);
  }

  return { layout, edges, islandEdges, crossings, islandAt };
}

/** No bridges anywhere: the board every game starts from. */
export const emptyBridges = (graph: Graph): number[] =>
  new Array<number>(graph.edges.length).fill(0);

/** The other end of an edge, seen from one of its islands. */
export const otherEnd = (edge: Edge, island: number): number =>
  edge.a === island ? edge.b : edge.a;

/** The edge joining two islands, or -1 when they do not see each other (§2). */
export function edgeBetween(graph: Graph, a: number, b: number): number {
  for (const id of graph.islandEdges[a] ?? []) {
    if (otherEnd(graph.edges[id]!, a) === b) return id;
  }
  return -1;
}

/** The edge leaving an island in one direction, or -1 when nothing is in sight there. */
export function edgeInDirection(graph: Graph, island: number, direction: Direction): number {
  for (const id of graph.islandEdges[island] ?? []) {
    const edge = graph.edges[id]!;
    const fromA = edge.a === island;
    if (edge.horizontal && direction === (fromA ? 'right' : 'left')) return id;
    if (!edge.horizontal && direction === (fromA ? 'down' : 'up')) return id;
  }
  return -1;
}

/** Bridges at one island: the sum over its edges (§2). */
export function islandTotal(graph: Graph, bridges: Bridges, island: number): number {
  let total = 0;
  for (const id of graph.islandEdges[island] ?? []) total += bridges[id] ?? 0;
  return total;
}

/**
 * Whether an edge is closed off by a bridge that crosses it (§2). Only an
 * empty edge can be: two crossing edges can never both carry bridges.
 */
export function isBlocked(graph: Graph, bridges: Bridges, edge: number): boolean {
  if ((bridges[edge] ?? 0) > 0) return false;
  return (graph.crossings[edge] ?? []).some((other) => (bridges[other] ?? 0) > 0);
}

/**
 * One tap on a pair of islands (§4): 0 → 1 → 2 → 0 bridges. Null when the
 * edge is blocked by a crossing bridge — a bridge that cannot be built is
 * simply not built — or is not an edge of this board at all (not an integer
 * id in range). An island may go over its number on the way; that is shown
 * (§5), never refused, so the cycle is the same on every pair.
 */
export function cycleBridge(graph: Graph, bridges: Bridges, edge: number): number[] | null {
  if (!Number.isInteger(edge) || edge < 0 || edge >= graph.edges.length) return null;
  if (isBlocked(graph, bridges, edge)) return null;
  const next = [...bridges];
  next[edge] = ((bridges[edge] ?? 0) + 1) % (MAX_BRIDGES_PER_PAIR + 1);
  return next;
}

/**
 * The islands an island can be joined to right now (§4): one per direction
 * with an island in sight, unless a crossing bridge closes the way. An edge
 * that already carries bridges is always listed — tapping it is how they go.
 */
export function candidatesOf(
  graph: Graph,
  bridges: Bridges,
  island: number,
): { readonly edge: number; readonly island: number }[] {
  const out: { edge: number; island: number }[] = [];
  for (const id of graph.islandEdges[island] ?? []) {
    if (isBlocked(graph, bridges, id)) continue;
    out.push({ edge: id, island: otherEnd(graph.edges[id]!, island) });
  }
  return out;
}

/** Island component label per ordinal, joined by edges carrying at least one bridge. */
export function componentsOf(graph: Graph, bridges: Bridges): number[] {
  const count = graph.layout.islands.length;
  const label = new Array<number>(count).fill(-1);
  let next = 0;
  for (let start = 0; start < count; start++) {
    if (label[start] !== -1) continue;
    const stack = [start];
    label[start] = next;
    while (stack.length > 0) {
      const island = stack.pop()!;
      for (const id of graph.islandEdges[island]!) {
        if ((bridges[id] ?? 0) === 0) continue;
        const other = otherEnd(graph.edges[id]!, island);
        if (label[other] === -1) {
          label[other] = next;
          stack.push(other);
        }
      }
    }
    next++;
  }
  return label;
}

/** How many separate groups the islands form under the bridges built (§3). */
export function componentCount(graph: Graph, bridges: Bridges): number {
  const label = componentsOf(graph, bridges);
  return label.length === 0 ? 0 : Math.max(...label) + 1;
}

/** Whether a bridges array is one the board can hold (§2): right length, 0–2 each, nothing crossing. */
export function isValidBridges(graph: Graph, bridges: readonly unknown[]): bridges is Bridges {
  if (bridges.length !== graph.edges.length) return false;
  for (const count of bridges) {
    if (typeof count !== 'number' || !Number.isInteger(count)) return false;
    if (count < 0 || count > MAX_BRIDGES_PER_PAIR) return false;
  }
  const counts = bridges as Bridges;
  for (let id = 0; id < counts.length; id++) {
    if (counts[id] === 0) continue;
    if (graph.crossings[id]!.some((other) => other > id && counts[other]! > 0)) return false;
  }
  return true;
}

/**
 * The win (§3): a legal board where every island carries exactly its number
 * and the bridges join every island into one group. Read from the rules,
 * never by comparing against the answer.
 */
export function isSolved(graph: Graph, bridges: readonly unknown[]): boolean {
  if (!isValidBridges(graph, bridges)) return false;
  const islands = graph.layout.islands;
  for (let island = 0; island < islands.length; island++) {
    if (islandTotal(graph, bridges, island) !== islands[island]!.value) return false;
  }
  return componentCount(graph, bridges) === 1;
}

export type IslandState = 'open' | 'complete' | 'over';

/** Each island against its number (§5): short of it, exactly on it, or past it. */
export function islandStates(graph: Graph, bridges: Bridges): IslandState[] {
  return graph.layout.islands.map((island, ordinal) => {
    const total = islandTotal(graph, bridges, ordinal);
    if (total === island.value) return 'complete';
    return total > island.value ? 'over' : 'open';
  });
}

/**
 * The facts the board shows (§5): which islands are over their number, and —
 * once every number is met — whether the islands are still in more than one
 * group, which is the one way a board can look finished and not be.
 */
export interface BoardFacts {
  readonly states: readonly IslandState[];
  readonly allNumbersMet: boolean;
  readonly groups: number;
}

export function boardFacts(graph: Graph, bridges: Bridges): BoardFacts {
  const states = islandStates(graph, bridges);
  return {
    states,
    allNumbersMet: states.every((state) => state === 'complete'),
    groups: componentCount(graph, bridges),
  };
}

/**
 * Structural validation of a layout (§1, §10): a sane size, islands in strict
 * index order inside the board, numbers 1–8, no two islands side by side, at
 * least two islands, and no island asking for more than its edges can carry.
 */
export function isValidLayout(layout: Layout): boolean {
  const { width, height, islands } = layout;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return false;
  if (width < 2 || height < 2 || width > 16 || height > 16) return false;
  if (!Array.isArray(islands) || islands.length < 2) return false;
  const cells = width * height;
  const occupied = new Uint8Array(cells);
  let previous = -1;
  for (const island of islands) {
    const { index, value } = island;
    if (!Number.isInteger(index) || index <= previous || index >= cells) return false;
    if (!Number.isInteger(value) || value < MIN_ISLAND_VALUE || value > MAX_ISLAND_VALUE) {
      return false;
    }
    occupied[index] = 1;
    previous = index;
  }
  for (const { index } of islands) {
    const row = rowOf(index, width);
    const col = colOf(index, width);
    if (col + 1 < width && occupied[index + 1] === 1) return false;
    if (row + 1 < height && occupied[index + width] === 1) return false;
  }
  const graph = buildGraph(layout);
  return islands.every(
    (island, ordinal) => island.value <= graph.islandEdges[ordinal]!.length * MAX_BRIDGES_PER_PAIR,
  );
}

/** The numbers an answer gives its islands: each island's total (§6, step 2). */
export function numbersFrom(graph: Graph, bridges: Bridges): number[] {
  return graph.layout.islands.map((_, ordinal) => islandTotal(graph, bridges, ordinal));
}
