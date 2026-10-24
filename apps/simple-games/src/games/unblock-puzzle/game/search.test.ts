/**
 * The two searches of docs/UNBLOCK_PUZZLE_RULES.md §6–§8: the packed state,
 * the component listing with its backwards distances, the forward solver,
 * and the three ways a search ends — solved, unsolvable, capped — checked on
 * hand-built boards, against each other, and against the independent
 * brute-force oracle of test-helpers.ts.
 */
import { describe, expect, it } from 'vitest';
import { catalogueEntry } from './catalogue';
import { isSolved, legalSlides, slide } from './engine';
import {
  exploreComponent,
  exploredStates,
  packPositions,
  searchWork,
  solve,
  unpackPositions,
  type Component,
} from './search';
import { oracleSolve } from './test-helpers';
import { EXIT_POSITION, TARGET_BLOCK, type Block, type Board } from './types';

/** engine.test.ts's board: the target, a vertical pair in column 3, a triple in row 5. */
const B: Block = { orientation: 'v', length: 2, lane: 3 };
const C: Block = { orientation: 'h', length: 3, lane: 5 };
const BOARD: Board = { blocks: [TARGET_BLOCK, B, C], positions: [0, 2, 0] };

/** Column 5 walled by two vertical triples: the target can never reach the exit. */
const WALLED: Board = {
  blocks: [
    TARGET_BLOCK,
    { orientation: 'v', length: 3, lane: 5 },
    { orientation: 'v', length: 3, lane: 5 },
  ],
  positions: [0, 0, 3],
};

const complete = (board: Board, limit = 6000): Component => {
  const result = exploreComponent(board, limit);
  if (result.status !== 'complete') throw new Error('capped');
  return result.component;
};

/** Plays a solution and says where it ends. */
const playOut = (board: Board, solution: readonly { block: number; to: number }[]): Board => {
  let current = board;
  for (const move of solution) {
    const next = slide(current, move);
    if (next === null) throw new Error(`illegal ${JSON.stringify(move)}`);
    current = next;
  }
  return current;
};

describe('packed states', () => {
  it('round-trips sixteen blocks of offsets 0–4 through two 32-bit words', () => {
    const positions = [4, 0, 3, 1, 2, 4, 4, 0, 1, 3, 2, 4, 0, 1, 3, 2];
    const [lo, hi] = packPositions(positions);
    expect(unpackPositions(lo, hi, positions.length)).toEqual(positions);
    expect(Number.isInteger(lo) && Number.isInteger(hi)).toBe(true);
  });
});

describe('the forward solver (§6)', () => {
  it('finds the fewest moves and a solution that replays through the rules', () => {
    const result = solve(BOARD, 1000);
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    expect(result.minMoves).toBe(2);
    // b up out of the row, then the target all the way: one slide each.
    expect(result.solution).toEqual([
      { block: 1, to: 0 },
      { block: 0, to: EXIT_POSITION },
    ]);
    expect(isSolved(playOut(BOARD, result.solution))).toBe(true);
    // The start and its eight neighbours are what proving "2" costs.
    expect(result.exploredStates).toBe(9);
  });

  it('answers zero for a board already solved', () => {
    const solved = playOut(BOARD, [
      { block: 1, to: 0 },
      { block: 0, to: 4 },
    ]);
    expect(solve(solved, 10)).toMatchObject({ status: 'solved', minMoves: 0, solution: [] });
  });

  it('says unsolvable only after every reachable board was searched', () => {
    const result = solve(WALLED, 1000);
    // Only the target moves: offsets 0–3.
    expect(result).toEqual({ status: 'unsolvable', states: 4 });
  });

  it('says capped, never unsolvable or a move, when the limit stops it first', () => {
    expect(solve(BOARD, 3)).toEqual({ status: 'capped', states: 3 });
    expect(solve(WALLED, 3).status).toBe('capped');
    // A limit that admits no board at all, or NaN (which would switch the
    // cap off), is a search cut short — never "no way out", never a move.
    for (const limit of [0, -1, 0.5, Number.NaN]) {
      expect(solve(BOARD, limit), `limit ${limit}`).toEqual({ status: 'capped', states: 0 });
      expect(exploreComponent(BOARD, limit).status, `limit ${limit}`).toBe('capped');
    }
  });

  it('says capped past a work limit, one board’s moves past it at most (§8)', () => {
    const board = catalogueEntry('hard', 0).board;
    const before = searchWork.read();
    const full = solve(board, 6000);
    const cost = searchWork.read() - before;
    expect(full.status).toBe('solved');
    expect(solve(board, 6000, undefined, cost)).toEqual(full);
    for (const limit of [0, 1, 500, cost - 100]) {
      const start = searchWork.read();
      expect(solve(board, 6000, undefined, limit).status, `limit ${limit}`).toBe('capped');
      expect(searchWork.read() - start, `limit ${limit}`).toBeLessThanOrEqual(limit + 73);
    }
  });

  it('refuses a block list longer than a packed state holds', () => {
    const blocks: Block[] = [TARGET_BLOCK];
    for (let n = 0; n < 16; n++) blocks.push({ orientation: 'v', length: 2, lane: n % 6 });
    const tooMany: Board = { blocks, positions: blocks.map(() => 0) };
    expect(() => solve(tooMany, 100)).toThrow(RangeError);
    expect(() => exploreComponent(tooMany, 100)).toThrow(RangeError);
  });

  it('puts a preferred first move, then its block, ahead in the tie-break', () => {
    // b up to the top, b down one and b to the bottom are all shortest first
    // moves (below); the target right one is not.
    const first = (prefer: { block: number; to: number }) => {
      const result = solve(BOARD, 1000, prefer);
      return result.status === 'solved' ? result.solution[0] : null;
    };
    expect(first({ block: 1, to: 4 })).toEqual({ block: 1, to: 4 });
    expect(first({ block: 1, to: 3 })).toEqual({ block: 1, to: 3 });
    // b up one cell still blocks the row; the next of b's own moves wins.
    expect(first({ block: 1, to: 1 })).toEqual({ block: 1, to: 0 });
    // The target's moves begin no shortest solution: the plain order decides.
    expect(first({ block: 0, to: 1 })).toEqual({ block: 1, to: 0 });
    const plain = solve(BOARD, 1000);
    const preferred = solve(BOARD, 1000, { block: 1, to: 4 });
    expect(preferred.status === 'solved' && preferred.minMoves).toBe(
      plain.status === 'solved' && plain.minMoves,
    );
  });

  it('breaks ties between equally short first moves the same way every time', () => {
    // Three first moves are optimal here — b up to the top, b down one, b to
    // the bottom — and the solver takes the one legalSlides lists first.
    const component = complete(BOARD);
    const optimal = legalSlides(BOARD).filter((move) => {
      const index = component.indexOf(slide(BOARD, move)!.positions);
      return component.goalDistance[index] === 1;
    });
    expect(optimal).toEqual([
      { block: 1, to: 0 },
      { block: 1, to: 3 },
      { block: 1, to: 4 },
    ]);
    const result = solve(BOARD, 1000);
    expect(result.status === 'solved' && result.solution[0]).toEqual(optimal[0]);
    expect(solve(BOARD, 1000)).toEqual(solve(BOARD, 1000));
  });
});

describe('the component listing (§8)', () => {
  it('lists every reachable board with its fewest moves to the exit', () => {
    const component = complete(BOARD);
    const start = component.indexOf(BOARD.positions);
    expect(start).toBe(0);
    expect(component.goalDistance[start]).toBe(2);
    expect(component.positionsAt(start)).toEqual([...BOARD.positions]);
    // Every board in it agrees with a fresh forward search from that board.
    for (let index = 0; index < component.size; index++) {
      const board = { blocks: BOARD.blocks, positions: component.positionsAt(index) };
      const forward = solve(board, 10_000);
      expect(forward.status).toBe('solved');
      if (forward.status === 'solved') {
        expect(forward.minMoves, `board ${index}`).toBe(component.goalDistance[index]);
      }
    }
    // The target on top of b is no board at all, so it is in no component.
    expect(component.indexOf([3, 2, 0])).toBe(-1);
    expect(component.indexOf([0, 2])).toBe(-1);
  });

  it('is the same component from any board in it (every move reverses)', () => {
    const fromStart = complete(BOARD);
    const elsewhere = {
      blocks: BOARD.blocks,
      positions: fromStart.positionsAt(fromStart.size - 1),
    };
    const fromElsewhere = complete(elsewhere);
    expect(fromElsewhere.size).toBe(fromStart.size);
    expect(fromElsewhere.maxDistance).toBe(fromStart.maxDistance);
    for (let index = 0; index < fromStart.size; index++) {
      const there = fromElsewhere.indexOf(fromStart.positionsAt(index));
      expect(there).toBeGreaterThanOrEqual(0);
      expect(fromElsewhere.goalDistance[there]).toBe(fromStart.goalDistance[index]);
    }
  });

  it('reports a component with no way out as such', () => {
    const component = complete(WALLED);
    expect(component.size).toBe(4);
    expect(component.maxDistance).toBe(-1);
    expect([...component.goalDistance]).toEqual([-1, -1, -1, -1]);
  });

  it('gives up honestly past its state limit', () => {
    const result = exploreComponent(BOARD, 5);
    expect(result.status).toBe('capped');
    if (result.status === 'capped') expect(result.states).toBe(5);
  });

  it('gives up honestly past its work limit, and never spends much past it', () => {
    const board = catalogueEntry('hard', 0).board;
    const full = complete(board);
    // The walk back from the solved boards reads as much as the listing, so
    // a limit just under the whole cost stops the listing.
    for (const limit of [0, 1_000, full.work - 1]) {
      const before = searchWork.read();
      const result = exploreComponent(board, 6000, limit);
      expect(result.status, `limit ${limit}`).toBe('capped');
      expect(searchWork.read() - before).toBeLessThanOrEqual(limit + 2 * 73);
    }
    expect(exploreComponent(board, 6000, full.work).status).toBe('complete');
  });

  it('counts the search size by a walk that stops at its depth, its cap or its work limit', () => {
    const board = catalogueEntry('easy', 0).board;
    const component = complete(board);
    for (let index = 0; index < component.size; index += 53) {
      const distance = component.distancesFrom(index);
      for (const minMoves of [1, 2, 4, 7, 9]) {
        let within = 0;
        for (let k = 0; k < component.size; k++) {
          if (distance[k]! >= 0 && distance[k]! < minMoves) within++;
        }
        expect(exploredStates(component, index, minMoves)).toBe(within);
        // Past the cap, cap + 1 — a lower bound, enough to fail a tier.
        expect(exploredStates(component, index, minMoves, 50)).toBe(within <= 50 ? within : 51);
      }
    }
    expect(exploredStates(component, 0, 9, undefined, -1)).toBeNull();
    const before = searchWork.read();
    expect(exploredStates(component, 0, 9, undefined, 100)).toBeNull();
    expect(searchWork.read() - before).toBeLessThanOrEqual(100 + 73);
  });

  it('counts the search size the same way the forward solver does (§7)', () => {
    const component = complete(BOARD);
    expect(exploredStates(component, 0, 2)).toBe(9);
    const board = catalogueEntry('medium', 0).board;
    const medium = complete(board);
    const index = medium.indexOf(board.positions);
    const forward = solve(board, 6000);
    expect(forward.status).toBe('solved');
    if (forward.status !== 'solved') return;
    expect(exploredStates(medium, index, forward.minMoves)).toBe(forward.exploredStates);
  });

  it('costs the same work for the same board on every run', () => {
    const board = catalogueEntry('hard', 0).board;
    const first = complete(board).work;
    const before = searchWork.read();
    const second = complete(board).work;
    expect(second).toBe(first);
    expect(searchWork.read() - before).toBe(second);
    expect(first).toBeGreaterThan(0);
  });
});

describe('agreement with the brute-force oracle', () => {
  it('agrees on the hand-built boards, the unsolvable one included', () => {
    expect(oracleSolve(BOARD)).toEqual({ minMoves: 2, explored: 9 });
    expect(oracleSolve(WALLED).minMoves).toBeNull();
  });

  /*
   * Every 40th board of three bases' components, the start included, in
   * slices of 10 boards per case: the oracle builds strings and sets, and
   * all of them in one `it()` would sit near the 5 s per-test timeout beside
   * the rest of the suite (docs/ARCHITECTURE.md「CI / リリース」).
   */
  const sampled = (['easy', 'medium', 'hard'] as const).flatMap((difficulty) => {
    const board = catalogueEntry(difficulty, 1).board;
    const component = complete(board);
    const indices: number[] = [];
    for (let index = 0; index < component.size; index += 40) indices.push(index);
    return Array.from({ length: Math.ceil(indices.length / 10) }, (_, slice) => ({
      difficulty,
      board,
      component,
      indices: indices.slice(slice * 10, (slice + 1) * 10),
    }));
  });

  it.each(sampled.map((entry) => ({ ...entry, label: `${entry.difficulty} ${entry.indices[0]}` })))(
    'agrees on the fewest moves and the search size from boards of a real component: $label',
    ({ difficulty, board, component, indices }) => {
      for (const index of indices) {
        const at = { blocks: board.blocks, positions: component.positionsAt(index) };
        const oracle = oracleSolve(at);
        expect(oracle.minMoves, `${difficulty} board ${index}`).toBe(component.goalDistance[index]);
        const forward = solve(at, 6000);
        if (forward.status === 'solved') expect(forward.exploredStates).toBe(oracle.explored);
      }
    },
  );
});
