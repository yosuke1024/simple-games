import { describe, expect, it } from 'vitest';
import { createBoard, isSolved } from './board';
import {
  SEARCH_NODE_LIMIT,
  countSolutions,
  isUnique,
  l1Fixpoint,
  l2Eliminations,
  solve,
} from './solver';
import type { TileType } from './tiles';
import { bruteForceSolutions } from './test-helpers';

const T: Record<string, TileType> = { e: 'end', s: 'straight', l: 'elbow', t: 'tee' };
const boardOf = (w: number, h: number, letters: string, source = 0) =>
  createBoard(
    w,
    h,
    [...letters].map((c) => T[c]!),
    source,
  );

/** Domains as orientation lists, for readable assertions. */
const options = (domain: number) => [0, 1, 2, 3].filter((k) => domain & (1 << k));

// Small boards, each read from a degree-≤3 spanning tree (found by the
// exhaustive sweep and a seeded search during development, then fixed here
// by hand as row-major type letters). Comments give the rows.
const L1_ONLY = { w: 4, h: 4, letters: 'lttlsssssssseeee' }; // lttl / ssss / ssss / eeee
const L2_LOOP = { w: 4, h: 4, letters: 'etsletleetteelll' }; // etsl / etle / ette / elll
const L2_CLOSED = { w: 4, h: 4, letters: 'ellletteltteelle' }; // elll / ette / ltte / elle
const L3_NEEDED = { w: 5, h: 4, letters: 'elleeltltlettteellse' }; // ellee / ltltl / ettte / ellse
const TWO_SOLUTIONS = { w: 4, h: 3, letters: 'ellelttlelle' }; // elle / lttl / elle
const TWO_AFTER_L3 = { w: 4, h: 4, letters: 'ellelttletteelle' }; // elle / lttl / ette / elle

const build = (b: { w: number; h: number; letters: string }) => boardOf(b.w, b.h, b.letters);

describe('L1 — interlock (§4)', () => {
  it('removes every pipe into the board’s edge', () => {
    // A straight on the top edge must lie across; a corner elbow has one way.
    const board = boardOf(3, 1, 'ese');
    const dom = l1Fixpoint(board)!;
    expect(dom.map(options)).toEqual([[1], [1], [3]]);
  });

  it('carries a decided edge across to the neighbour, both ways', () => {
    // 2×2: top-left elbow is forced right+down, which forces its neighbours’ facing sides.
    const board = boardOf(2, 2, 'llll');
    const dom = l1Fixpoint(board)!;
    // Each corner elbow has exactly one orientation that keeps off both edges.
    expect(dom.map(options)).toEqual([[1], [2], [0], [3]]);
  });

  it('carries a decided side across to the neighbour', () => {
    // 2×2 of ends: each corner end has two ways (L1 alone decides nothing)…
    const board = boardOf(2, 2, 'eeee');
    expect(l1Fixpoint(board)!.map(options)).toEqual([
      [1, 2],
      [2, 3],
      [0, 1],
      [0, 3],
    ]);
    // …until the top-left end is decided to point down: the end below must then point up.
    const start = board.types.map(() => 0b1111);
    start[0] = 1 << 2;
    const dom = l1Fixpoint(board, start)!;
    expect(options(dom[2]!)).toEqual([0]);
  });

  it('reports a contradiction as an empty domain (no solution)', () => {
    // end – end – end in a row: the middle end cannot meet both.
    expect(solve(boardOf(3, 1, 'eee')).status).toBe('contradiction');
  });

  it('solves a board on L1 alone and reports level 1', () => {
    const board = build(L1_ONLY);
    const result = solve(board);
    expect(result.status).toBe('solved');
    expect(result.level).toBe(1);
    expect(result.l2Rounds).toBe(0);
    expect(result.l3).toBe(0);
    expect(
      isSolved(
        board,
        result.domains.map((d) => options(d)[0]!),
      ),
    ).toBe(true);
    expect(result.stageOf.every((s) => s === 1)).toBe(true);
  });
});

describe('L2 — loops and isolation (§4)', () => {
  it('rejects orientations that would close a loop, where L1 is stuck', () => {
    const board = build(L2_LOOP);
    const stuck = solve(board, { maxLevel: 1 });
    expect(stuck.status).toBe('stuck');
    const elim = l2Eliminations(board, stuck.domains)!;
    expect(elim.length).toBeGreaterThan(0);
    expect(new Set(elim.map((e) => e.reason))).toEqual(new Set(['loop']));
    // Each rejected orientation was still possible after L1.
    for (const e of elim) expect(stuck.domains[e.cell]! & (1 << e.orientation)).not.toBe(0);
  });

  it('rejects orientations that would leave a closed group short of the whole board', () => {
    const board = build(L2_CLOSED);
    const stuck = solve(board, { maxLevel: 1 });
    expect(stuck.status).toBe('stuck');
    const elim = l2Eliminations(board, stuck.domains)!;
    expect(elim.length).toBeGreaterThan(0);
    expect(new Set(elim.map((e) => e.reason))).toEqual(new Set(['closed-group']));
  });

  it('catches two ends facing each other through the neighbour’s remaining orientations (one hop)', () => {
    // 2×2 of ends (no solution: 4 mouths on 4 cells). After L1 each end still
    // has two ways; pointing the top-left end right leaves its partner only
    // "left", and the pair is closed. Without the one hop, the partner's
    // other edge would still look open and nothing would be rejected.
    const board = boardOf(2, 2, 'eeee');
    const elim = l2Eliminations(board, l1Fixpoint(board)!)!;
    expect(elim).toContainEqual({ cell: 0, orientation: 1, reason: 'closed-group' });
    expect(elim).toContainEqual({ cell: 0, orientation: 2, reason: 'closed-group' });
    expect(elim).toHaveLength(8);
    expect(solve(board).status).toBe('contradiction');
  });

  it('never rejects an orientation a solution uses (sound) on the example boards', () => {
    for (const b of [L2_LOOP, L2_CLOSED, L3_NEEDED, TWO_SOLUTIONS, TWO_AFTER_L3]) {
      const board = build(b);
      const solutions = bruteForceSolutions(b.w, b.h, [...b.letters]);
      const stuck = solve(board, { maxLevel: 1 });
      for (const e of l2Eliminations(board, stuck.domains) ?? []) {
        for (const s of solutions) expect(s[e.cell]).not.toBe(e.orientation);
      }
    }
  });

  it('a board that needs L2 is stuck on L1 and solved at level 2', () => {
    for (const b of [L2_LOOP, L2_CLOSED]) {
      const board = build(b);
      expect(solve(board, { maxLevel: 1 }).status).toBe('stuck');
      const result = solve(board);
      expect(result.status).toBe('solved');
      expect(result.level).toBe(2);
      expect(result.l2Rounds).toBeGreaterThan(0);
      expect(result.l3).toBe(0);
    }
  });
});

describe('L3 — one hypothesis (§4)', () => {
  const board = build(L3_NEEDED);

  it('is stuck on L1 + L2 and solved once a hypothesis is refuted', () => {
    expect(solve(board, { maxLevel: 2 }).status).toBe('stuck');
    const result = solve(board);
    expect(result.status).toBe('solved');
    expect(result.level).toBe(3);
    expect(result.l3).toBeGreaterThan(0);
    const orientations = result.domains.map((d) => options(d)[0]!);
    expect(isSolved(board, orientations)).toBe(true);
    // The technique answer is the brute force's only solution.
    expect(bruteForceSolutions(L3_NEEDED.w, L3_NEEDED.h, [...L3_NEEDED.letters])).toEqual([
      orientations,
    ]);
  });

  it('records the order cells became fixed and the stage of each', () => {
    const result = solve(board);
    expect([...result.order].sort((a, b) => a - b)).toEqual(board.types.map((_, i) => i));
    // Stages never go down along the order; the first cells come from L1 and the last need L3.
    const stages = result.order.map((cell) => result.stageOf[cell]!);
    for (let i = 1; i < stages.length; i++)
      expect(stages[i]!).toBeGreaterThanOrEqual(stages[i - 1]!);
    expect(stages[0]).toBe(1);
    expect(stages[stages.length - 1]).toBe(3);
  });
});

describe('ladder reporting', () => {
  it('a 2-solution board ends stuck with both solutions still inside the domains', () => {
    for (const b of [TWO_SOLUTIONS, TWO_AFTER_L3]) {
      const board = build(b);
      const result = solve(board);
      expect(result.status).toBe('stuck');
      const solutions = bruteForceSolutions(b.w, b.h, [...b.letters]);
      expect(solutions).toHaveLength(2);
      for (const s of solutions) {
        s.forEach((k, cell) => expect(result.domains[cell]! & (1 << k)).not.toBe(0));
      }
    }
    // The second one used a hypothesis before getting stuck.
    expect(solve(build(TWO_AFTER_L3)).level).toBe(3);
  });

  it('stops honestly at the work limit', () => {
    const result = solve(build(L3_NEEDED), { workLimit: 50 });
    expect(result.status).toBe('aborted');
    expect(result.work).toBeGreaterThan(50);
    expect(result.work).toBeLessThan(50 + 50); // one engine step past the limit at most
  });

  it('is deterministic', () => {
    for (const b of [L1_ONLY, L2_LOOP, L3_NEEDED, TWO_AFTER_L3]) {
      expect(solve(build(b))).toEqual(solve(build(b)));
      expect(countSolutions(build(b))).toEqual(countSolutions(build(b)));
    }
  });
});

describe('countSolutions (§4)', () => {
  it('finds exactly one solution on a unique board, matching the brute force', () => {
    const board = build(L3_NEEDED);
    const result = countSolutions(board);
    expect(result).toMatchObject({ count: 1, complete: true });
    expect(isUnique(result)).toBe(true);
    expect(result.solutions).toEqual(
      bruteForceSolutions(L3_NEEDED.w, L3_NEEDED.h, [...L3_NEEDED.letters]),
    );
  });

  it('finds both solutions of a 2-solution board and does not call it unique', () => {
    for (const b of [TWO_SOLUTIONS, TWO_AFTER_L3]) {
      const result = countSolutions(build(b));
      expect(result).toMatchObject({ count: 2, complete: true });
      expect(isUnique(result)).toBe(false);
      expect([...result.solutions].sort()).toEqual(
        [...bruteForceSolutions(b.w, b.h, [...b.letters])].sort(),
      );
    }
  });

  it('with a higher limit still finds exactly 2 there', () => {
    const result = countSolutions(build(TWO_SOLUTIONS), { limit: 10 });
    expect(result).toMatchObject({ count: 2, complete: true });
  });

  it('reports none on a board with no solution', () => {
    // Four elbows on 2×2 can only form a ring.
    expect(countSolutions(boardOf(2, 2, 'llll'))).toMatchObject({ count: 0, complete: true });
  });

  it('is honest at the node limit: incomplete, a lower bound, never unique', () => {
    const board = build(TWO_AFTER_L3);
    const full = countSolutions(board);
    expect(full.nodes).toBeGreaterThan(1);
    const exact = countSolutions(board, { nodeLimit: full.nodes });
    expect(exact).toMatchObject({ count: 2, complete: true, nodes: full.nodes });
    // One node short, the count has found exactly one of the two solutions:
    // the case that matters — one found before the bound is not a proof of uniqueness.
    const short = countSolutions(board, { nodeLimit: full.nodes - 1 });
    expect(short.complete).toBe(false);
    expect(short.count).toBe(1);
    expect(short.nodes).toBe(full.nodes - 1);
    expect(isUnique(short)).toBe(false);
    // Cut at its first node it has found none yet, and that is not "no solution" either.
    const none = countSolutions(board, { nodeLimit: 1 });
    expect(none).toMatchObject({ count: 0, complete: false });
    expect(isUnique(none)).toBe(false);
  });

  it('is honest at the work budget', () => {
    const result = countSolutions(build(L3_NEEDED), { workLimit: 10 });
    expect(result.complete).toBe(false);
    expect(isUnique(result)).toBe(false);
  });

  it('uses the shared node limit by default', () => {
    expect(SEARCH_NODE_LIMIT).toBe(5_000);
    expect(countSolutions(build(L1_ONLY)).nodes).toBe(1);
  });
});
