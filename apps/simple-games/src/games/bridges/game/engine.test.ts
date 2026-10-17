/**
 * The board rules of docs/BRIDGES_RULES.md §1–§5 on hand-drawn boards: which
 * islands see each other (and that a bridge never jumps an island), which
 * edges cross, the 0 → 1 → 2 → 0 cycle and its two-bridge cap, a crossing
 * bridge blocking the way, island counts, the one-group rule, and the win.
 */
import { describe, expect, it } from 'vitest';
import {
  boardFacts,
  buildGraph,
  candidatesOf,
  componentCount,
  cycleBridge,
  edgeBetween,
  edgeInDirection,
  emptyBridges,
  isBlocked,
  isSolved,
  isValidBridges,
  isValidLayout,
  islandStates,
  islandTotal,
  numbersFrom,
} from './engine';
import type { Layout } from './types';

/** Islands from rows of text: `.` water, a digit an island with that number. */
function board(rows: readonly string[]): Layout {
  const width = rows[0]!.length;
  const islands = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < width; c++) {
      const ch = rows[r]![c]!;
      if (ch !== '.') islands.push({ index: r * width + c, value: Number(ch) });
    }
  }
  return { width, height: rows.length, islands };
}

/**
 * A row of three: the left island sees the middle one, the middle one the
 * right — and the left never the right, the middle island stands between.
 */
const ROW = board(['1.2.1', '.....', '.....']);

/**
 * A plus: the vertical pair (top, bottom) and the horizontal pair (left,
 * right) run through the same water cell in the middle, so they cross.
 */
const PLUS = board(['..1..', '.....', '1...1', '.....', '..1..']);

/** A square of four 2s: the answer is the loop of single bridges. */
const LOOP = board(['2.2', '...', '2.2']);

describe('who sees whom (§2)', () => {
  it('joins an island to the first island in each direction, and no further', () => {
    const graph = buildGraph(ROW);
    expect(graph.edges.map((edge) => [edge.a, edge.b, edge.horizontal])).toEqual([
      [0, 1, true],
      [1, 2, true],
    ]);
    // A bridge never jumps an island: the two ends of the row are not joined.
    expect(edgeBetween(graph, 0, 2)).toBe(-1);
    expect(edgeBetween(graph, 0, 1)).toBe(0);
    expect(edgeBetween(graph, 2, 1)).toBe(1);
  });

  it('lists the water a bridge runs over, and orders edges right before down', () => {
    const graph = buildGraph(LOOP);
    expect(graph.edges.map((edge) => [edge.a, edge.b, edge.horizontal, edge.cells])).toEqual([
      [0, 1, true, [1]],
      [0, 2, false, [3]],
      [1, 3, false, [5]],
      [2, 3, true, [7]],
    ]);
    expect(graph.islandEdges).toEqual([
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ]);
  });

  it('finds the edge in each direction, and none where nothing is in sight', () => {
    const graph = buildGraph(LOOP);
    expect(edgeInDirection(graph, 0, 'right')).toBe(0);
    expect(edgeInDirection(graph, 0, 'down')).toBe(1);
    expect(edgeInDirection(graph, 0, 'up')).toBe(-1);
    expect(edgeInDirection(graph, 0, 'left')).toBe(-1);
    expect(edgeInDirection(graph, 3, 'left')).toBe(3);
    expect(edgeInDirection(graph, 3, 'up')).toBe(2);
  });

  it('marks two edges that run through the same water as crossing', () => {
    const graph = buildGraph(PLUS);
    // Islands in index order: top 0, left 1, right 2, bottom 3.
    const vertical = edgeBetween(graph, 0, 3);
    const horizontal = edgeBetween(graph, 1, 2);
    expect(graph.crossings[vertical]).toEqual([horizontal]);
    expect(graph.crossings[horizontal]).toEqual([vertical]);
    expect(buildGraph(LOOP).crossings.every((list) => list.length === 0)).toBe(true);
  });
});

describe('building bridges (§4)', () => {
  it('cycles a pair 0 → 1 → 2 → 0, never past two', () => {
    const graph = buildGraph(ROW);
    let bridges: readonly number[] = emptyBridges(graph);
    const seen: number[] = [];
    for (let tap = 0; tap < 4; tap++) {
      bridges = cycleBridge(graph, bridges, 0)!;
      seen.push(bridges[0]!);
    }
    expect(seen).toEqual([1, 2, 0, 1]);
    expect(bridges[1]).toBe(0);
  });

  it('refuses an edge a crossing bridge blocks, and frees it once that bridge goes', () => {
    const graph = buildGraph(PLUS);
    const vertical = edgeBetween(graph, 0, 3);
    const horizontal = edgeBetween(graph, 1, 2);
    const built = cycleBridge(graph, emptyBridges(graph), vertical)!;
    expect(isBlocked(graph, built, horizontal)).toBe(true);
    expect(cycleBridge(graph, built, horizontal)).toBeNull();
    // The bridge that blocks is never blocked itself, and can be taken away.
    expect(isBlocked(graph, built, vertical)).toBe(false);
    const doubled = cycleBridge(graph, built, vertical)!;
    const cleared = cycleBridge(graph, doubled, vertical)!;
    expect(cleared[vertical]).toBe(0);
    expect(cycleBridge(graph, cleared, horizontal)).not.toBeNull();
  });

  it('refuses an edge that does not exist', () => {
    const graph = buildGraph(ROW);
    expect(cycleBridge(graph, emptyBridges(graph), -1)).toBeNull();
    expect(cycleBridge(graph, emptyBridges(graph), 2)).toBeNull();
    // Not an id at all: refused, rather than written beside the edges.
    for (const id of [Number.NaN, 0.5, Number.POSITIVE_INFINITY, null, '0']) {
      expect(cycleBridge(graph, emptyBridges(graph), id as number), String(id)).toBeNull();
    }
  });

  it('offers every island in sight as a candidate, unless a crossing bridge blocks it', () => {
    const graph = buildGraph(PLUS);
    const vertical = edgeBetween(graph, 0, 3);
    expect(candidatesOf(graph, emptyBridges(graph), 1)).toEqual([
      { edge: edgeBetween(graph, 1, 2), island: 2 },
    ]);
    const built = cycleBridge(graph, emptyBridges(graph), vertical)!;
    expect(candidatesOf(graph, built, 1)).toEqual([]);
    // A built edge stays a candidate: tapping it is how its bridges go.
    expect(candidatesOf(graph, built, 0)).toEqual([{ edge: vertical, island: 3 }]);
  });
});

describe('counting and the one group (§3, §5)', () => {
  it('counts the bridges at each island, and states each against its number', () => {
    const graph = buildGraph(ROW);
    const bridges = [2, 1];
    expect(islandTotal(graph, bridges, 0)).toBe(2);
    expect(islandTotal(graph, bridges, 1)).toBe(3);
    expect(islandStates(graph, bridges)).toEqual(['over', 'over', 'complete']);
    expect(islandStates(graph, [1, 0])).toEqual(['complete', 'open', 'open']);
    expect(numbersFrom(graph, [1, 1])).toEqual([1, 2, 1]);
  });

  it('counts the groups the bridges make', () => {
    const graph = buildGraph(LOOP);
    expect(componentCount(graph, emptyBridges(graph))).toBe(4);
    expect(componentCount(graph, [2, 0, 0, 2])).toBe(2);
    expect(componentCount(graph, [1, 1, 1, 1])).toBe(1);
  });

  it('wins only when every number is met and the islands are one group', () => {
    const graph = buildGraph(LOOP);
    // Every number met, but two groups: the one way to look finished and not be.
    expect(isSolved(graph, [2, 0, 0, 2])).toBe(false);
    expect(boardFacts(graph, [2, 0, 0, 2])).toMatchObject({ allNumbersMet: true, groups: 2 });
    // The loop is the answer: a loop in the network is not against the rules.
    expect(isSolved(graph, [1, 1, 1, 1])).toBe(true);
    expect(isSolved(graph, [1, 1, 1, 0])).toBe(false);
    expect(isSolved(buildGraph(ROW), [1, 1])).toBe(true);
  });

  it('never calls a board with crossing bridges a win, or a legal board at all', () => {
    // The plus has no answer: its only two edges cross.
    const graph = buildGraph(PLUS);
    expect(isValidBridges(graph, [1, 1])).toBe(false);
    expect(isSolved(graph, [1, 1])).toBe(false);
    expect(isValidBridges(graph, [1, 0])).toBe(true);
  });

  it('refuses counts that are not 0–2, and arrays of the wrong length', () => {
    const graph = buildGraph(ROW);
    expect(isValidBridges(graph, [3, 0])).toBe(false);
    expect(isValidBridges(graph, [-1, 0])).toBe(false);
    expect(isValidBridges(graph, [0.5, 0])).toBe(false);
    expect(isValidBridges(graph, ['1', 0])).toBe(false);
    expect(isValidBridges(graph, [1])).toBe(false);
    expect(isValidBridges(graph, [1, 1, 0])).toBe(false);
  });
});

describe('legal layouts (§1)', () => {
  it('accepts the boards above', () => {
    expect(isValidLayout(ROW)).toBe(true);
    expect(isValidLayout(PLUS)).toBe(true);
    expect(isValidLayout(LOOP)).toBe(true);
  });

  it('refuses islands side by side, out of order, out of range, or past 8', () => {
    expect(isValidLayout(board(['11.', '...', '..1']))).toBe(false);
    expect(isValidLayout(board(['1..', '1..', '..1']))).toBe(false);
    expect(
      isValidLayout({
        width: 3,
        height: 3,
        islands: [
          { index: 9, value: 1 },
          { index: 0, value: 1 },
        ],
      }),
    ).toBe(false);
    expect(
      isValidLayout({
        width: 3,
        height: 3,
        islands: [
          { index: 2, value: 1 },
          { index: 0, value: 1 },
        ],
      }),
    ).toBe(false);
    expect(
      isValidLayout({
        width: 3,
        height: 3,
        islands: [
          { index: 0, value: 9 },
          { index: 2, value: 1 },
        ],
      }),
    ).toBe(false);
    expect(
      isValidLayout({
        width: 3,
        height: 3,
        islands: [
          { index: 0, value: 0 },
          { index: 2, value: 1 },
        ],
      }),
    ).toBe(false);
  });

  it('refuses a single island, and an island asking for more than its edges carry', () => {
    expect(isValidLayout(board(['1..', '...', '...']))).toBe(false);
    // The left island sees only one neighbour: 3 is more than two bridges.
    expect(isValidLayout(board(['3.2', '...', '...']))).toBe(false);
    // An island with nothing in sight at all.
    expect(isValidLayout(board(['1.1', '...', '...', '...', '.1.']))).toBe(false);
  });

  it('refuses sizes that are not whole and sane', () => {
    expect(isValidLayout({ ...LOOP, width: 2.5 })).toBe(false);
    expect(isValidLayout({ ...LOOP, width: 1 })).toBe(false);
    expect(isValidLayout({ ...LOOP, height: 40 })).toBe(false);
  });
});
