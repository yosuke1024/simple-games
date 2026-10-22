/**
 * Generation of docs/PIPE_LINK_RULES.md §4 and the tiers of §5, piece by
 * piece: the tree, the grade, the tier gate, the scramble, the retry loop
 * and the bundled fallback under small budgets. The measured rates over many
 * seeds are guarantee.test.ts's.
 */
import { describe, expect, it } from 'vitest';
import { createBoard, isSolved, neighborOf } from './board';
import { BUNDLED_BOARDS } from './bundled';
import {
  ATTEMPT_LIMIT,
  GENERATION_WORK_LIMIT,
  HARD_MIN_L1_OPEN,
  MAX_SAME_TENTHS,
  SCRAMBLE_ATTEMPT_LIMIT,
  TIERS,
  attemptCandidate,
  bundledPuzzle,
  generatePuzzle,
  gradeTree,
  growTree,
  isAcceptableScramble,
  meetsTier,
  sameAsSolution,
  scramble,
  sourceCells,
  type Candidate,
} from './generator';
import { createRng } from './rng';
import { encodeOrientations, encodeTypes } from './serialize';
import { SEARCH_NODE_LIMIT, countSolutions, solve } from './solver';
import { hasPipe, pipeMask } from './tiles';
import { DIFFICULTIES, PRESETS } from './types';

describe('the source cells (§4 step 1)', () => {
  it('are the centre 3×3 on an odd board and the centre 2×2 on an even one', () => {
    expect(sourceCells(5, 5)).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]);
    expect(sourceCells(7, 7)).toEqual([16, 17, 18, 23, 24, 25, 30, 31, 32]);
    expect(sourceCells(8, 8)).toEqual([27, 28, 35, 36]);
  });
});

describe('the tree (§4 step 1)', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: a spanning tree of degree 1–3 rooted on a central cell, for 100 seeds`, () => {
      const preset = PRESETS[difficulty];
      const n = preset.width * preset.height;
      const centre = sourceCells(preset.width, preset.height);
      for (let s = 0; s < 100; s++) {
        const tree = growTree(preset, createRng(`tree-${difficulty}-${s}`));
        expect('masks' in tree).toBe(true);
        if (!('masks' in tree)) continue;
        expect(centre).toContain(tree.source);
        // Degrees 1–3, every pipe matched by the neighbour, none into the edge.
        const board = createBoard(preset.width, preset.height, new Array(n).fill('end'), 0);
        let links = 0;
        for (let i = 0; i < n; i++) {
          const mask = tree.masks[i]!;
          const degree = [0, 1, 2, 3].filter((d) => hasPipe(mask, d)).length;
          expect(degree).toBeGreaterThanOrEqual(1);
          expect(degree).toBeLessThanOrEqual(3);
          for (let dir = 0; dir < 4; dir++) {
            if (!hasPipe(mask, dir)) continue;
            const j = neighborOf(board, i, dir);
            expect(j).toBeGreaterThanOrEqual(0);
            expect(hasPipe(tree.masks[j]!, (dir + 2) & 3)).toBe(true);
            links++;
          }
        }
        // n − 1 links and every pipe matched: with the grade's isSolved below, a spanning tree.
        expect(links / 2).toBe(n - 1);
        const candidate = gradeTree(preset, tree, Number.POSITIVE_INFINITY);
        expect(isSolved(candidate.board, candidate.solution)).toBe(true);
        expect(candidate.board.source).toBe(tree.source);
        candidate.board.types.forEach((type, i) => {
          expect(pipeMask(type, candidate.solution[i]!)).toBe(tree.masks[i]);
        });
      }
    });
  }

  it('is deterministic per rng seed', () => {
    const a = growTree(PRESETS.hard, createRng('same'));
    const b = growTree(PRESETS.hard, createRng('same'));
    expect(a).toEqual(b);
  });
});

describe('the grade and the tier gate (§5)', () => {
  const base: Candidate = {
    board: createBoard(2, 1, ['end', 'end'], 0),
    solution: [1, 3],
    level: 1,
    l1Open: 0,
    status: 'solved',
    solveWork: 0,
  };

  it('Easy takes L1 only; Medium L2 only; Hard L2 or L3 with at least 16 tiles L1 leaves open', () => {
    expect(meetsTier(base, TIERS.easy)).toBe(true);
    expect(meetsTier({ ...base, level: 2, l1Open: 4 }, TIERS.easy)).toBe(false);
    expect(meetsTier({ ...base, level: 1 }, TIERS.medium)).toBe(false);
    expect(meetsTier({ ...base, level: 2, l1Open: 4 }, TIERS.medium)).toBe(true);
    expect(meetsTier({ ...base, level: 3, l1Open: 30 }, TIERS.medium)).toBe(false);
    expect(meetsTier({ ...base, level: 2, l1Open: HARD_MIN_L1_OPEN - 1 }, TIERS.hard)).toBe(false);
    expect(meetsTier({ ...base, level: 2, l1Open: HARD_MIN_L1_OPEN }, TIERS.hard)).toBe(true);
    expect(meetsTier({ ...base, level: 3, l1Open: HARD_MIN_L1_OPEN }, TIERS.hard)).toBe(true);
    expect(meetsTier({ ...base, level: 3, l1Open: HARD_MIN_L1_OPEN - 1 }, TIERS.hard)).toBe(false);
    expect(meetsTier({ ...base, level: 1 }, TIERS.hard)).toBe(false);
  });

  it('never takes a board the techniques did not decide, whatever its level', () => {
    for (const status of ['stuck', 'contradiction', 'aborted'] as const) {
      for (const difficulty of DIFFICULTIES) {
        expect(meetsTier({ ...base, status, level: 2, l1Open: 40 }, TIERS[difficulty])).toBe(false);
      }
    }
  });

  it('reads L1-open as the tiles still undecided at the first L1 fixpoint', () => {
    for (let s = 0; s < 40; s++) {
      const tree = growTree(PRESETS.medium, createRng(`open-${s}`));
      if (!('masks' in tree)) continue;
      const candidate = gradeTree(PRESETS.medium, tree, Number.POSITIVE_INFINITY);
      if (candidate.status !== 'solved') {
        expect(candidate.l1Open).toBe(-1);
        continue;
      }
      const l1 = solve(candidate.board, { maxLevel: 1 });
      const undecided = l1.domains.filter((d) => (d & (d - 1)) !== 0).length;
      expect(candidate.l1Open).toBe(undecided);
      expect(candidate.level === 1).toBe(undecided === 0);
    }
  });
});

describe('the scramble (§4 step 5)', () => {
  it('refuses a solved scramble and one with more than 60 % of tiles in place', () => {
    const tree = growTree(PRESETS.easy, createRng('scramble-unit'));
    if (!('masks' in tree)) throw new Error('no tree');
    const { board, solution } = gradeTree(PRESETS.easy, tree, Number.POSITIVE_INFINITY);
    const n = solution.length; // 25: 15 in place is 60 %, 16 is over
    expect(isAcceptableScramble(board, solution, solution)).toBe(false);
    const moved = (keep: number) =>
      solution.map((o, i) => (i < keep ? o : (o + 1) % (board.types[i] === 'straight' ? 2 : 4)));
    expect(sameAsSolution(solution, moved(15))).toBe(15);
    expect(isAcceptableScramble(board, solution, moved(15))).toBe(true);
    expect(isAcceptableScramble(board, solution, moved(16))).toBe(false);
    expect(MAX_SAME_TENTHS * n).toBe(150);
  });

  it('draws inside each type’s period, deterministically, and only acceptable scrambles', () => {
    const tree = growTree(PRESETS.hard, createRng('scramble-draw'));
    if (!('masks' in tree)) throw new Error('no tree');
    const { board, solution } = gradeTree(PRESETS.hard, tree, Number.POSITIVE_INFINITY);
    const a = scramble(board, solution, 'seed-x');
    const b = scramble(board, solution, 'seed-x');
    expect(a).toEqual(b);
    expect(a.initial).not.toBeNull();
    expect(a.draws).toBeGreaterThanOrEqual(1);
    expect(a.draws).toBeLessThanOrEqual(SCRAMBLE_ATTEMPT_LIMIT);
    a.initial!.forEach((o, i) => {
      expect(o).toBeLessThan(board.types[i] === 'straight' ? 2 : 4);
    });
    expect(isAcceptableScramble(board, solution, a.initial!)).toBe(true);
  });
});

describe('one attempt (§4 steps 1–5)', () => {
  it('ships only a unique board of its tier with an acceptable scramble', () => {
    for (const difficulty of DIFFICULTIES) {
      let shipped = 0;
      for (let s = 0; s < 30; s++) {
        const result = attemptCandidate(`attempt-${difficulty}-${s}`, difficulty);
        if (result.outcome !== 'shipped') {
          expect(result.initial).toBeNull();
          continue;
        }
        shipped++;
        const c = result.candidate!;
        expect(meetsTier(c, TIERS[difficulty])).toBe(true);
        expect(countSolutions(c.board)).toMatchObject({ count: 1, complete: true });
        expect(isAcceptableScramble(c.board, c.solution, result.initial!)).toBe(true);
        expect(result.countNodes).toBeGreaterThanOrEqual(1);
      }
      expect(shipped).toBeGreaterThan(0);
    }
  });

  it('reads a budget that runs out as a miss, never a pass', () => {
    for (const budget of [1, 100, 1_000, 3_000]) {
      const result = attemptCandidate('budget-hard', 'hard', budget);
      expect(['budget', 'stuck', 'tier', 'grow']).toContain(result.outcome);
      expect(result.outcome).not.toBe('shipped');
    }
  });

  // One shipping seed per tier, cut at every budget from just below its growth
  // to its full work: each step of the attempt (grade, count, scramble) is
  // reached with too little left, and every one of them reads as 'budget'.
  // The full work is pinned so the number of budgets swept (full work − growth
  // + 1: 112, 418 and 640 — §13) is this test's.
  const SHIPPING: Readonly<
    Record<(typeof DIFFICULTIES)[number], { readonly seed: string; readonly work: number }>
  > = {
    easy: { seed: 'pipe-link-easy-g1', work: 711 },
    medium: { seed: 'budget-medium-6', work: 2_769 },
    hard: { seed: 'budget-hard-17', work: 4_671 },
  };
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: a cut grade, count or scramble is a miss; only the full work ships`, () => {
      const { seed, work } = SHIPPING[difficulty];
      const n = PRESETS[difficulty].width * PRESETS[difficulty].height;
      const full = attemptCandidate(seed, difficulty);
      expect(full.outcome).toBe('shipped');
      expect(full.work).toBe(work);
      const { board, solveWork } = full.candidate!;
      const growth = n * (n - 1);
      const countWork = countSolutions(board, { nodeLimit: SEARCH_NODE_LIMIT }).work;
      expect(full.work).toBe(growth + solveWork + countWork + full.scrambles * n);

      const seen = { none: 0, aborted: 0, count: 0, scramble: 0 };
      for (let budget = growth - 1; budget < full.work; budget++) {
        const result = attemptCandidate(seed, difficulty, budget);
        expect(result.outcome).toBe('budget');
        expect(result.initial).toBeNull();
        // Over the budget only by one engine step (at most n), never by a scramble.
        expect(result.work).toBeLessThanOrEqual(Math.max(budget, growth) + n);
        if (budget <= growth) {
          // Nothing left after the growth: no grade at all.
          expect(result.candidate).toBeNull();
          seen.none++;
        } else if (budget < growth + solveWork) {
          // (a) the technique solver cut short.
          expect(result.candidate!.status).toBe('aborted');
          seen.aborted++;
        } else if (budget < growth + solveWork + countWork) {
          // (b) graded, then the count cut short: it says neither unique nor not.
          expect(result.candidate!.status).toBe('solved');
          expect(result.scrambles).toBe(0);
          const cut = countSolutions(board, {
            nodeLimit: SEARCH_NODE_LIMIT,
            workLimit: budget - growth - solveWork,
          });
          expect(cut.complete).toBe(false);
          seen.count++;
        } else {
          // Counted unique, then too little left for the scramble's draws.
          expect(result.candidate!.status).toBe('solved');
          expect(result.countNodes).toBeGreaterThanOrEqual(1);
          expect(result.work).toBeLessThanOrEqual(budget);
          seen.scramble++;
        }
      }
      expect(seen.none).toBe(2);
      expect(seen.aborted).toBe(solveWork - 1);
      expect(seen.count).toBe(countWork);
      expect(seen.scramble).toBe(full.scrambles * n);

      // (c) the full work ships the same attempt.
      expect(attemptCandidate(seed, difficulty, full.work)).toEqual(full);
    });
  }
});

describe('generatePuzzle (§4)', () => {
  it('is deterministic: the same seed is the same board, scramble, work and all', () => {
    for (const difficulty of DIFFICULTIES) {
      const a = generatePuzzle(`det-${difficulty}`, difficulty);
      const b = generatePuzzle(`det-${difficulty}`, difficulty);
      expect(a).toEqual(b);
    }
  });

  it('ships the first derived seed that lands, and says how many it drew', () => {
    const puzzle = generatePuzzle('pipe-link-hard-retry', 'hard');
    expect(puzzle.fallback).toBe(false);
    let first = 0;
    for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
      const derived = attempt === 1 ? 'pipe-link-hard-retry' : `pipe-link-hard-retry#${attempt}`;
      if (attemptCandidate(derived, 'hard').outcome === 'shipped') {
        first = attempt;
        break;
      }
    }
    expect(puzzle.attempts).toBe(first);
    const total = Object.values(puzzle.outcomes).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(puzzle.attempts);
    expect(puzzle.outcomes.shipped).toBe(1);
  });

  it('falls back to a bundled board of the tier when no attempt is allowed, picked by the seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generatePuzzle('fallback-seed', difficulty, 0);
      expect(puzzle.fallback).toBe(true);
      const again = bundledPuzzle('fallback-seed', difficulty);
      expect(encodeTypes(puzzle.board.types)).toBe(encodeTypes(again.board.types));
      const entry = BUNDLED_BOARDS[difficulty].find(
        (b) => b.types === encodeTypes(puzzle.board.types),
      );
      expect(entry).toBeDefined();
      expect(encodeOrientations(puzzle.initial)).toBe(entry!.initial);
      expect(puzzle.board.width).toBe(PRESETS[difficulty].width);
    }
  });

  it('falls back when the work budget is too small, and never ships a board the budget cut short', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const budget of [1, 500, 2_000]) {
        const puzzle = generatePuzzle(`tight-${difficulty}`, difficulty, ATTEMPT_LIMIT, budget);
        const n = PRESETS[difficulty].width * PRESETS[difficulty].height;
        // A budget below one growth (n × (n − 1)) cannot fit a single attempt.
        if (budget < n * (n - 1)) expect(puzzle.fallback).toBe(true);
        if (!puzzle.fallback) {
          // Landed inside the budget: the same board as with the full budget.
          const full = generatePuzzle(`tight-${difficulty}`, difficulty);
          expect(encodeTypes(puzzle.board.types)).toBe(encodeTypes(full.board.types));
          expect(puzzle.work).toBeLessThanOrEqual(budget);
        }
        // Over by at most the last attempt's growth, which runs whole (§4).
        expect(puzzle.work).toBeLessThanOrEqual(budget + n * (n - 1));
      }
    }
  });

  it('changes nothing for a board that lands inside the budget', () => {
    const full = generatePuzzle('inside-budget', 'medium');
    const tight = generatePuzzle('inside-budget', 'medium', ATTEMPT_LIMIT, full.work);
    expect(tight).toEqual(full);
    expect(full.work).toBeLessThan(GENERATION_WORK_LIMIT);
  });
});
