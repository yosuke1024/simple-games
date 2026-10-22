/**
 * Exhaustive checks (docs/PIPE_LINK_RULES.md §13, §14): every spanning tree
 * of small grids with all degrees ≤ 3, read as a board of tile types, is
 * checked against an independent brute force (test-helpers.ts, which uses
 * none of tiles.ts / board.ts / solver.ts). The tallies are printed with a
 * `[pipe-link]` prefix and pinned, so the numbers in §14 reproduce.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBoard, isAllLit, isSolved, totalPipes } from './board';
import { countSolutions, solve } from './solver';
import type { TileType } from './tiles';
import {
  allOrientations,
  bruteForceSolutions,
  letterOfMask,
  spanningTreesMaxDegree3,
} from './test-helpers';

const T: Record<string, TileType> = { e: 'end', s: 'straight', l: 'elbow', t: 'tee' };

interface Tally {
  trees: number;
  distinctBoards: Set<string>;
  byKind: Record<string, number>;
  maxNodes: number;
  maxWork: number;
}

const newTally = (): Tally => ({
  trees: 0,
  distinctBoards: new Set(),
  byKind: {},
  maxNodes: 0,
  maxWork: 0,
});

const sameArray = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Checks one tree's board against the brute force and adds it to the tally.
 * Returns the list of disagreements (empty when everything agrees) — plain
 * comparisons in the loop and one expect per test keep 76,464 trees fast.
 */
function checkTree(
  width: number,
  height: number,
  masks: readonly number[],
  tally: Tally,
): string[] {
  const problems: string[] = [];
  const cells = masks.map(letterOfMask);
  const letters = cells.map((c) => c.letter);
  const name = letters.join('');
  const treeOrientations = cells.map((c) => c.orientation);
  const board = createBoard(
    width,
    height,
    letters.map((l) => T[l]!),
    0,
  );
  const brute = bruteForceSolutions(width, height, letters);
  const isBrute = (s: readonly number[]) => brute.some((b) => sameArray(b, s));
  // The tree itself is always a solution.
  if (!isBrute(treeOrientations)) problems.push(`${name}: tree is not a brute-force solution`);

  const count = countSolutions(board);
  if (!count.complete) problems.push(`${name}: count incomplete`);
  if (count.count !== Math.min(brute.length, 2)) {
    problems.push(`${name}: count ${count.count} vs brute ${brute.length}`);
  }
  if (!count.solutions.every(isBrute)) problems.push(`${name}: count found a non-solution`);

  const result = solve(board);
  if (result.status === 'solved') {
    // Techniques decided everything: that must be the one and only solution.
    const decided = result.domains.map((d) => 31 - Math.clz32(d));
    if (brute.length !== 1 || !sameArray(decided, brute[0]!)) {
      problems.push(`${name}: solved to a non-unique or wrong arrangement`);
    }
    if (result.order.length !== board.types.length) problems.push(`${name}: order incomplete`);
  } else if (result.status !== 'stuck') {
    problems.push(`${name}: status ${result.status}`);
  } else {
    // Stuck: soundness — every solution is still inside the domains.
    for (const s of brute) {
      if (!s.every((k, cell) => (result.domains[cell]! & (1 << k)) !== 0)) {
        problems.push(`${name}: a solution was eliminated`);
      }
    }
  }

  tally.trees++;
  tally.distinctBoards.add(name);
  const solutions = brute.length === 1 ? 'unique' : `${brute.length} solutions`;
  const key = `${solutions} / ${result.status} / L${result.level}`;
  tally.byKind[key] = (tally.byKind[key] ?? 0) + 1;
  tally.maxNodes = Math.max(tally.maxNodes, count.nodes);
  tally.maxWork = Math.max(tally.maxWork, result.work);
  return problems;
}

function report(name: string, tally: Tally): void {
  console.info(
    `[pipe-link] exhaustive ${name}: ${tally.trees} trees, ${tally.distinctBoards.size} distinct type boards, ` +
      `kinds ${JSON.stringify(tally.byKind)}, max count nodes ${tally.maxNodes}, max solver work ${tally.maxWork}`,
  );
}

describe('every degree-≤3 spanning tree of 3×3, 4×3 and 3×4 (§13)', () => {
  it.each([
    [3, 3],
    [4, 3],
    [3, 4],
  ])('%i×%i: count, solver and brute force agree', (width, height) => {
    const tally = newTally();
    const problems: string[] = [];
    for (const masks of spanningTreesMaxDegree3(width, height)) {
      problems.push(...checkTree(width, height, masks, tally));
    }
    expect(problems).toEqual([]);
    report(`${width}×${height}`, tally);
    if (width === 3 && height === 3) {
      expect(tally.trees).toBe(176);
      expect(tally.byKind).toEqual({ 'unique / solved / L1': 176 });
    } else {
      expect(tally.trees).toBe(2071);
      expect(tally.byKind).toEqual({
        'unique / solved / L1': 2051,
        'unique / solved / L2': 18,
        '2 solutions / stuck / L1': 2,
      });
    }
    expect(tally.maxNodes).toBeLessThanOrEqual(3);
  });
});

describe('every degree-≤3 spanning tree of 4×4 (§13)', () => {
  const SLICES = 16;
  /**
   * Each slice's own kinds, pinned in that slice, so no test reads a tally
   * another test filled (each slice runs alone under `-t`). Their sum is the
   * §14 row, checked from these constants alone below.
   */
  const KINDS = [
    'unique / solved / L1',
    'unique / solved / L2',
    '2 solutions / stuck / L1',
    '2 solutions / stuck / L2',
    '2 solutions / stuck / L3',
  ] as const;
  const SLICE_COUNTS: readonly (readonly number[])[] = [
    [4_657, 103, 14, 5, 0],
    [4_655, 100, 19, 5, 0],
    [4_662, 100, 16, 1, 0],
    [4_663, 93, 18, 4, 1],
    [4_661, 100, 12, 4, 2],
    [4_643, 112, 19, 5, 0],
    [4_645, 110, 20, 4, 0],
    [4_658, 105, 14, 1, 1],
    [4_666, 102, 7, 3, 1],
    [4_668, 94, 16, 1, 0],
    [4_662, 96, 18, 2, 1],
    [4_645, 112, 17, 4, 1],
    [4_646, 118, 12, 3, 0],
    [4_635, 126, 17, 0, 1],
    [4_640, 121, 17, 1, 0],
    [4_662, 92, 20, 5, 0],
  ];
  const SLICE_KINDS = SLICE_COUNTS.map((counts) => {
    const kinds: Record<string, number> = {};
    KINDS.forEach((kind, i) => {
      if (counts[i]! > 0) kinds[kind] = counts[i]!;
    });
    return kinds;
  });
  let trees: number[][] = [];
  /** Per slice, its tally once it ran — for the printed line only, never asserted on. */
  const ran: (Tally | undefined)[] = [];

  beforeAll(() => {
    trees = spanningTreesMaxDegree3(4, 4);
  });

  it.each(Array.from({ length: SLICES }, (_, i) => i))(
    'slice %i of 16: count, solver and brute force agree',
    (slice) => {
      const tally = newTally();
      const problems: string[] = [];
      for (let i = slice; i < trees.length; i += SLICES) {
        problems.push(...checkTree(4, 4, trees[i]!, tally));
      }
      expect(problems).toEqual([]);
      expect(tally.byKind).toEqual(SLICE_KINDS[slice]);
      expect(tally.trees).toBe(Math.ceil((trees.length - slice) / SLICES));
      expect(tally.maxNodes).toBeLessThanOrEqual(3);
      ran[slice] = tally;
    },
  );

  afterAll(() => {
    // Printed only when every slice ran: a partial run (`-t`) prints nothing rather than a short count.
    if (ran.filter(Boolean).length !== SLICES) return;
    const all = newTally();
    for (const t of ran as Tally[]) {
      all.trees += t.trees;
      t.distinctBoards.forEach((b) => all.distinctBoards.add(b));
      for (const [k, v] of Object.entries(t.byKind)) all.byKind[k] = (all.byKind[k] ?? 0) + v;
      all.maxNodes = Math.max(all.maxNodes, t.maxNodes);
      all.maxWork = Math.max(all.maxWork, t.maxWork);
    }
    report('4×4', all);
  });

  it('pins the tallies (§14)', () => {
    expect(trees.length).toBe(76_464);
    const sum: Record<string, number> = {};
    for (const kinds of SLICE_KINDS) {
      for (const [k, v] of Object.entries(kinds)) sum[k] = (sum[k] ?? 0) + v;
    }
    expect(sum).toEqual({
      'unique / solved / L1': 74_468,
      'unique / solved / L2': 1_684,
      '2 solutions / stuck / L1': 256,
      '2 solutions / stuck / L2': 48,
      '2 solutions / stuck / L3': 8,
    });
    expect(Object.values(sum).reduce((a, b) => a + b, 0)).toBe(trees.length);
  });
});

describe('all lit ⇔ solved, over every rotation of every tree (§2)', () => {
  const check = (width: number, height: number, masks: readonly number[], source: number) => {
    const letters = masks.map((m) => letterOfMask(m).letter);
    const board = createBoard(
      width,
      height,
      letters.map((l) => T[l]!),
      source,
    );
    let solved = 0;
    let arrangements = 0;
    let disagreements = 0;
    for (const orientations of allOrientations(letters)) {
      arrangements++;
      if (arrangements === 1) expect(totalPipes(board, orientations)).toBe(2 * (masks.length - 1));
      const lit = isAllLit(board, orientations);
      if (isSolved(board, orientations) !== lit) disagreements++;
      if (lit) solved++;
    }
    expect(disagreements).toBe(0);
    // The full product agrees with the pruned brute force.
    expect(solved).toBe(bruteForceSolutions(width, height, letters).length);
    return arrangements;
  };

  it.each([
    [2, 2],
    [3, 2],
    [2, 3],
  ])('every tree of %i×%i, every source', (width, height) => {
    let arrangements = 0;
    let trees = 0;
    for (const masks of spanningTreesMaxDegree3(width, height)) {
      trees++;
      for (let source = 0; source < masks.length; source++) {
        arrangements += check(width, height, masks, source);
      }
    }
    console.info(
      `[pipe-link] all-lit ⇔ isSolved ${width}×${height}: ${trees} trees, ${arrangements} arrangements (every source)`,
    );
  });

  it.each([0, 20, 40, 60, 80, 100, 120, 140, 160, 175])(
    '3×3 tree #%i, source at the centre',
    (index) => {
      const masks = spanningTreesMaxDegree3(3, 3)[index]!;
      const arrangements = check(3, 3, masks, 4);
      console.info(
        `[pipe-link] all-lit ⇔ isSolved 3×3 tree #${index}: ${arrangements} arrangements`,
      );
    },
  );
});
