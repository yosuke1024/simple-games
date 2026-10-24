/**
 * The pieces of generation, docs/UNBLOCK_PUZZLE_RULES.md §7–§8, one at a
 * time: canonical block order, block placement, the changes, the choice of
 * a starting board, the tier table, the deal's limits — including the
 * fallback, reached here by shrinking the limits, since no walked seed
 * reaches it on its own often enough to test (guarantee.test.ts counts it)
 * — Hard dealt as bundled, and the daily's walk through the Medium list.
 */
import { describe, expect, it } from 'vitest';
import { catalogueEntry, catalogueSize } from './catalogue';
import { addDays } from './daily';
import { isSolved, isValidBoard } from './engine';
import {
  CHANGES_KEPT,
  COMPONENT_LIMIT,
  DAILY_STRIDE,
  DEAL_LIMITS,
  DEAL_WORK_LIMIT,
  TIERS,
  addRandomBlock,
  baseFor,
  canonicalBoard,
  changeBoard,
  chooseStart,
  componentKey,
  dailyEntry,
  dailyPuzzle,
  dealFromBase,
  generatePuzzle,
  meetsTier,
  randomArrangement,
  solvedBoard,
} from './generator';
import { createRng } from './rng';
import { exploreComponent, searchWork, solve, type Component } from './search';
import { encodeBoard } from './serialize';
import { DIFFICULTIES, TARGET_BLOCK, TARGET_ROW, blockCells, type Board } from './types';

const component = (board: Board): Component => {
  const result = exploreComponent(board, COMPONENT_LIMIT);
  if (result.status !== 'complete') throw new Error('capped');
  return result.component;
};

describe('the tier table (§7)', () => {
  it('keeps the bands apart: every Hard board needs more moves than any Medium one', () => {
    expect(TIERS.easy.maxMoves).toBeLessThan(TIERS.medium.minMoves);
    expect(TIERS.medium.maxMoves).toBeLessThan(TIERS.hard.minMoves);
    expect(TIERS.hard.minExplored).toBeGreaterThan(TIERS.medium.minExplored);
    expect(TIERS.easy.minMoves).toBeGreaterThan(1);
  });

  it('reads both bounds of both measures', () => {
    const { medium } = TIERS;
    expect(meetsTier(medium, 10, 250)).toBe(true);
    expect(meetsTier(medium, 16, 9999)).toBe(true);
    expect(meetsTier(medium, 9, 9999)).toBe(false);
    expect(meetsTier(medium, 17, 9999)).toBe(false);
    expect(meetsTier(medium, 12, 249)).toBe(false);
    expect(meetsTier(TIERS.easy, 6, 1001)).toBe(false);
    expect(meetsTier(TIERS.hard, 60, 800)).toBe(true);
  });
});

describe('canonical order (§8)', () => {
  it('puts the target first and the rest by their first cell, and is idempotent', () => {
    const scrambled: Board = {
      blocks: [
        TARGET_BLOCK,
        { orientation: 'h', length: 3, lane: 5 },
        { orientation: 'v', length: 2, lane: 3 },
        { orientation: 'v', length: 2, lane: 0 },
      ],
      positions: [0, 1, 2, 3],
    };
    const canonical = canonicalBoard(scrambled);
    const firsts = canonical.blocks
      .slice(1)
      .map((block, i) => blockCells(block, canonical.positions[i + 1]!)[0]!);
    expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
    expect(canonical.blocks[0]).toEqual(TARGET_BLOCK);
    expect(canonicalBoard(canonical)).toEqual(canonical);
    // The vertical pair in column 3 starts first (cell 15), then the one in
    // column 0 (cell 18), then the triple in row 5 (cell 31).
    expect(encodeBoard(scrambled)).toBe('............aa.c..d..c..d......bbb..');
    expect(encodeBoard(canonical)).toBe('............aa.b..c..b..c......ddd..');
  });
});

describe('placing blocks and changing boards (§8)', () => {
  it('drops blocks only onto free cells, never across the target’s row', () => {
    const rng = createRng('placement');
    let board: Board = { blocks: [TARGET_BLOCK], positions: [4] };
    for (let n = 0; n < 200; n++) {
      const next = addRandomBlock(board, rng);
      if (next === null) {
        board = { blocks: [TARGET_BLOCK], positions: [4] };
        continue;
      }
      expect(isValidBoard(next)).toBe(true);
      const added = next.blocks[next.blocks.length - 1]!;
      expect(added.orientation === 'h' && added.lane === TARGET_ROW).toBe(false);
      board = next.blocks.length > 12 ? { blocks: [TARGET_BLOCK], positions: [4] } : next;
    }
  });

  it('starts from a solved arrangement inside the tier’s block bounds', () => {
    for (const difficulty of DIFFICULTIES) {
      const spec = TIERS[difficulty];
      const rng = createRng(`arrangement-${difficulty}`);
      for (let n = 0; n < 20; n++) {
        const board = randomArrangement(rng, spec);
        expect(isValidBoard(board)).toBe(true);
        expect(isSolved(board)).toBe(true);
        expect(board.blocks.length - 1).toBeLessThanOrEqual(spec.maxBlocks);
      }
    }
  });

  it('changes one block at a time, inside the bounds, keeping the target', () => {
    for (const difficulty of DIFFICULTIES) {
      const spec = TIERS[difficulty];
      const rng = createRng(`change-${difficulty}`);
      let board = catalogueEntry(difficulty, 0).board;
      for (let n = 0; n < 60; n++) {
        const next = changeBoard(board, rng, spec);
        if (next === null) continue;
        expect(isValidBoard(next)).toBe(true);
        expect(next.blocks[0]).toEqual(TARGET_BLOCK);
        expect(next.positions[0]).toBe(board.positions[0]);
        expect(Math.abs(next.blocks.length - board.blocks.length)).toBeLessThanOrEqual(1);
        // A change always changes the blocks — their shapes and lanes — so the
        // changed board is never in the component it came from: a swap never
        // puts back a block of the shape and lane it took.
        expect(componentKey(next)).not.toBe(componentKey(board));
        expect(next.blocks.length - 1).toBeGreaterThanOrEqual(
          Math.min(spec.minBlocks, board.blocks.length - 1),
        );
        expect(next.blocks.length - 1).toBeLessThanOrEqual(
          Math.max(spec.maxBlocks, board.blocks.length - 1),
        );
        board = next;
      }
    }
  });

  it('a swap never puts back the shape and lane it took, at any offset', () => {
    // A crowded solved board: the hole a block leaves is often the only
    // place a new block fits, and the same block anywhere along its own lane
    // is the same set of boards.
    const board = solvedBoard(component(catalogueEntry('hard', 0).board), createRng('x'));
    const rng = createRng('except');
    for (let index = 1; index < board.blocks.length; index++) {
      const taken = board.blocks[index]!;
      const rest = {
        blocks: board.blocks.filter((_, i) => i !== index),
        positions: board.positions.filter((_, i) => i !== index),
      };
      for (let n = 0; n < 30; n++) {
        const next = addRandomBlock(rest, rng, taken);
        if (next === null) continue;
        const added = next.blocks[next.blocks.length - 1]!;
        expect(
          added.orientation === taken.orientation &&
            added.length === taken.length &&
            added.lane === taken.lane,
        ).toBe(false);
      }
    }
  });

  it('a change to a solved board leaves it solved, so its component has a way out', () => {
    const base = catalogueEntry('hard', 3).board;
    const solved = solvedBoard(component(base), createRng('solved'));
    expect(isSolved(solved)).toBe(true);
    const rng = createRng('solved-change');
    for (let n = 0; n < 20; n++) {
      const next = changeBoard(solved, rng, TIERS.hard);
      if (next === null) continue;
      expect(isSolved(next)).toBe(true);
    }
  });
});

describe('choosing the starting board (§7, §8)', () => {
  it('deals inside the band, at an exact distance, within the search-size bounds', () => {
    for (const difficulty of DIFFICULTIES) {
      const spec = TIERS[difficulty];
      const listed = component(catalogueEntry(difficulty, 2).board);
      const rng = createRng(`choose-${difficulty}`);
      for (let n = 0; n < 10; n++) {
        const chosen = chooseStart(listed, rng, spec);
        if (chosen === null) continue;
        expect(meetsTier(spec, chosen.minMoves, chosen.exploredStates)).toBe(true);
        const proof = solve(chosen.board, COMPONENT_LIMIT);
        expect(proof.status === 'solved' && proof.minMoves).toBe(chosen.minMoves);
        expect(proof.status === 'solved' && proof.exploredStates).toBe(chosen.exploredStates);
        if (spec.farthest) expect(chosen.minMoves).toBe(listed.maxDistance);
      }
    }
  });

  it('chooses nothing when the search-size walk has no work left', () => {
    const listed = component(catalogueEntry('medium', 2).board);
    const before = searchWork.read();
    expect(chooseStart(listed, createRng('broke'), TIERS.medium, 0)).toBeNull();
    // The scan of the component is all it spent.
    expect(searchWork.read() - before).toBe(listed.size);
  });

  it('chooses nothing from a component that cannot reach the band', () => {
    // A board two moves deep (search.test.ts) has nothing for Medium.
    const shallow: Board = {
      blocks: [TARGET_BLOCK, { orientation: 'v', length: 2, lane: 3 }],
      positions: [0, 2],
    };
    expect(chooseStart(component(shallow), createRng('x'), TIERS.medium)).toBeNull();
  });
});

describe('the tier table’s dealing (§8)', () => {
  it('deals Hard as bundled and changes Easy and Medium, within the component limit', () => {
    expect(TIERS.hard.changes).toBe(false);
    expect(TIERS.easy.changes && TIERS.medium.changes).toBe(true);
    for (const difficulty of DIFFICULTIES) {
      expect(TIERS[difficulty].changeComponentLimit).toBeLessThanOrEqual(COMPONENT_LIMIT);
    }
  });
});

describe('the deal and its limits (§8)', () => {
  it('is a pure function of the seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const a = generatePuzzle(`unblock-puzzle-${difficulty}-repeat`, difficulty);
      const b = generatePuzzle(`unblock-puzzle-${difficulty}-repeat`, difficulty);
      expect(a).toEqual(b);
    }
    expect(baseFor('unblock-puzzle-repeat', 'hard')).toEqual(
      baseFor('unblock-puzzle-repeat', 'hard'),
    );
  });

  it('deals a Hard seed’s bundled board as it is, with no search', () => {
    for (let n = 1; n <= 20; n++) {
      const seed = `unblock-puzzle-hard-as-is-${n}`;
      const before = searchWork.read();
      const deal = generatePuzzle(seed, 'hard');
      expect(searchWork.read() - before).toBe(0);
      const base = baseFor(seed, 'hard');
      expect(encodeBoard(deal.board)).toBe(encodeBoard(base.board));
      expect(deal.minMoves).toBe(base.minMoves);
      expect([deal.base, deal.work, deal.attempts, deal.changes, deal.fallback]).toEqual([
        base.index,
        0,
        0,
        0,
        false,
      ]);
    }
  });

  it('keeps CHANGES_KEPT changes when it can, each one a board of its own', () => {
    const deal = generatePuzzle('unblock-puzzle-medium-limits', 'medium');
    expect(deal.changes).toBeLessThanOrEqual(CHANGES_KEPT);
    expect(deal.attempts).toBeLessThanOrEqual(DEAL_LIMITS.changeLimit);
    expect(deal.fallback).toBe(deal.changes === 0);
  });

  it('never deals a board from the base’s own component unless it says fallback', () => {
    // Every board of a component has the same blocks, so a board with other
    // blocks than the base's is in another component; a fallback is the
    // base itself.
    for (const difficulty of ['easy', 'medium'] as const) {
      for (let n = 1; n <= 12; n++) {
        const seed = `unblock-puzzle-${difficulty}-own-${n}`;
        const base = baseFor(seed, difficulty);
        const deal = generatePuzzle(seed, difficulty);
        if (deal.fallback) {
          expect(encodeBoard(deal.board), seed).toBe(encodeBoard(base.board));
        } else {
          expect(componentKey(deal.board), seed).not.toBe(componentKey(base.board));
          expect(encodeBoard(deal.board), seed).not.toBe(encodeBoard(base.board));
          // A kept change's board is in its tier, by a fresh search.
          const proof = solve(deal.board, COMPONENT_LIMIT);
          expect(proof.status === 'solved' && proof.minMoves, seed).toBe(deal.minMoves);
          expect(
            proof.status === 'solved' &&
              meetsTier(TIERS[difficulty], proof.minMoves, proof.exploredStates),
            seed,
          ).toBe(true);
        }
      }
    }
  });

  it('stops at its work limit, a board’s moves and two scans past it at most', () => {
    // The scans of a component (choosing a start, picking a solved board)
    // are counted too, at most COMPONENT_LIMIT boards each.
    const slack = 2 * COMPONENT_LIMIT + 3 * 73;
    for (const workLimit of [1, 5_000, 50_000, 200_000, 400_000]) {
      for (const difficulty of DIFFICULTIES) {
        for (let n = 1; n <= 3; n++) {
          const seed = `unblock-puzzle-${difficulty}-budget-${n}`;
          const deal = dealFromBase(baseFor(seed, difficulty), seed, difficulty, {
            ...DEAL_LIMITS,
            changesKept: 2,
            workLimit,
          });
          expect(deal.work, `${seed} ${workLimit}`).toBeLessThanOrEqual(workLimit + slack);
        }
      }
    }
    expect(DEAL_LIMITS.workLimit).toBe(DEAL_WORK_LIMIT);
  });

  it('deals the base when no work is left for a change', () => {
    const base = catalogueEntry('medium', 7);
    const deal = dealFromBase(base, 'unblock-puzzle-no-work', 'medium', {
      ...DEAL_LIMITS,
      workLimit: 0,
    });
    expect(deal.fallback).toBe(true);
    expect(deal.attempts).toBe(0);
    expect(deal.work).toBe(0);
    expect(encodeBoard(deal.board)).toBe(encodeBoard(base.board));
  });

  it('deals the base as it is, flagged, when no change is allowed', () => {
    const base = catalogueEntry('easy', 5);
    const deal = dealFromBase(base, 'unblock-puzzle-fallback', 'easy', {
      ...DEAL_LIMITS,
      changeLimit: 0,
    });
    expect(deal.fallback).toBe(true);
    expect(deal.changes).toBe(0);
    expect(encodeBoard(deal.board)).toBe(encodeBoard(base.board));
    expect(deal.minMoves).toBe(base.minMoves);
  });

  it('deals the base when its way out costs more work than is left', () => {
    // A limit below the base's own forward search: the search stops,
    // `capped`, so there is no solved board to change and no change is tried.
    const base = catalogueEntry('medium', 4);
    const deal = dealFromBase(base, 'unblock-puzzle-short', 'medium', {
      ...DEAL_LIMITS,
      workLimit: 20,
    });
    expect(deal.fallback).toBe(true);
    expect(deal.attempts).toBe(0);
    expect(deal.work).toBeLessThanOrEqual(20 + 73);
    expect(encodeBoard(deal.board)).toBe(encodeBoard(base.board));
  });

  it('deals the base when every changed component is past the state limit', () => {
    const base = catalogueEntry('medium', 0);
    const deal = dealFromBase(base, 'unblock-puzzle-capped', 'medium', {
      ...DEAL_LIMITS,
      componentLimit: 20,
      workLimit: Number.POSITIVE_INFINITY,
    });
    expect(deal.fallback).toBe(true);
    expect(deal.attempts).toBe(DEAL_LIMITS.changeLimit);
    expect(encodeBoard(deal.board)).toBe(encodeBoard(base.board));
  });
});

describe('the daily (§9)', () => {
  it('is a bundled Medium board as it is, by its date', () => {
    const entry = dailyEntry('2026-10-17');
    const puzzle = dailyPuzzle('2026-10-17');
    expect(encodeBoard(puzzle.board)).toBe(encodeBoard(entry.board));
    expect([puzzle.minMoves, puzzle.base, puzzle.work, puzzle.fallback]).toEqual([
      entry.minMoves,
      entry.index,
      0,
      false,
    ]);
    expect(dailyEntry('2026-10-17')).toEqual(entry);
  });

  it('deals as many different boards as the Medium list holds before it repeats one', () => {
    const size = catalogueSize('medium');
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    expect(gcd(DAILY_STRIDE, size)).toBe(1);
    const seen = new Set<number>();
    let date = '2026-01-01';
    for (let day = 0; day < Math.min(size, 1_200); day++) {
      seen.add(dailyEntry(date).index);
      date = addDays(date, 1);
    }
    expect(seen.size).toBe(Math.min(size, 1_200));
  });
});
