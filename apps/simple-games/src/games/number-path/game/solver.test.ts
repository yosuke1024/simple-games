/**
 * The search solver of docs/NUMBER_PATH_RULES.md §6: it counts the paths a
 * board admits, its pruning never cuts a real one, and its branch count reads
 * zero on a board that is one road.
 *
 * The proof that pruning is sound is a comparison, not an argument: every
 * board a naive search can enumerate, the pruned search must count the same.
 */
import { describe, expect, it } from 'vitest';
import { buildBoard, isSolution } from './engine';
import { createRng, shuffled } from './rng';
import { countSolutions, isUnique, solverWork } from './solver';
import type { Board } from './types';

const NUMBERS = [
  [0, 1],
  [4, 2],
  [8, 3],
] as const;
const WALLED = buildBoard({ width: 3, height: 3, numbers: NUMBERS, walls: ['h1', 'h4'] })!;
const OPEN = buildBoard({ width: 3, height: 3, numbers: NUMBERS, walls: [] })!;

/**
 * Every completion, found the slow way: depth first over open neighbours
 * with only the rules of §3 to stop it, no lookahead at all.
 */
function naiveCount(board: Board, limit: number): { count: number; first: number[] | null } {
  const total = board.width * board.height;
  const visited = new Uint8Array(total);
  const path: number[] = [];
  let count = 0;
  let first: number[] | null = null;
  const walk = (head: number, due: number): void => {
    if (count >= limit) return;
    if (path.length === total) {
      if (board.numbers[head] === board.last) {
        count++;
        if (first === null) first = [...path];
      }
      return;
    }
    if (board.numbers[head] === board.last) return;
    for (const nb of board.adjacent[head]!) {
      if (visited[nb]) continue;
      const number = board.numbers[nb]!;
      if (number !== 0 && number !== due) continue;
      visited[nb] = 1;
      path.push(nb);
      walk(nb, number === 0 ? due : due + 1);
      path.pop();
      visited[nb] = 0;
    }
  };
  const start = board.cellOf[1]!;
  visited[start] = 1;
  path.push(start);
  walk(start, 2);
  return { count, first };
}

describe('counting (§6)', () => {
  it('finds the one road on the walled 3×3, and both roads once the walls go', () => {
    const one = countSolutions(WALLED);
    expect(one.solutions).toBe(1);
    expect(one.solution).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
    expect(isUnique(WALLED)).toBe(true);

    const two = countSolutions(OPEN);
    expect(two.solutions).toBe(2);
    expect(two.solution).toBeNull();
    expect(isUnique(OPEN)).toBe(false);
  });

  it('finds no road where the numbers make one impossible', () => {
    // K in the middle of an edge: a 3×3 road of nine cells starts and ends
    // on the majority colour, and cell 1 is the other colour.
    const board = buildBoard({
      width: 3,
      height: 3,
      numbers: [
        [0, 1],
        [4, 2],
        [1, 3],
      ],
      walls: [],
    })!;
    expect(countSolutions(board).solutions).toBe(0);
  });

  it('counts the ways on from a prefix, and none from one that has strayed', () => {
    expect(countSolutions(WALLED, [0, 1, 2]).solutions).toBe(1);
    expect(countSolutions(WALLED, [0, 3]).solutions).toBe(0);
    expect(countSolutions(OPEN, [0, 3]).solutions).toBe(1);
    expect(countSolutions(OPEN, [0, 3]).solution).toEqual([0, 3, 6, 7, 4, 1, 2, 5, 8]);
  });

  it('stops at the limit it was given', () => {
    expect(countSolutions(OPEN, undefined, 1).solutions).toBe(1);
  });

  it('reads a fully numbered board as one road with no branching', () => {
    const cells = [0, 1, 2, 5, 4, 3, 6, 7, 8];
    const board = buildBoard({
      width: 3,
      height: 3,
      numbers: cells.map((cell, i) => [cell, i + 1] as const),
      walls: [],
    })!;
    const result = countSolutions(board);
    expect(result.solutions).toBe(1);
    expect(result.branches).toBe(0);
    expect(result.nodes).toBe(8);
  });

  it('counts its work', () => {
    solverWork.reset();
    const result = countSolutions(OPEN);
    expect(result.nodes).toBeGreaterThan(0);
    expect(solverWork.read()).toBe(result.nodes);
  });
});

/**
 * Soundness of the pruning (§6「一意性の探索ソルバー」). Random small boards,
 * some with walls and some with several numbers: the pruned count up to two
 * must equal the naive count up to two, and where there is one road it must
 * be the same road.
 */
describe('pruning never cuts a real road', () => {
  const rng = createRng('number-path-solver-soundness');
  const shapes = [
    [3, 3],
    [3, 4],
    [4, 4],
    [4, 5],
  ] as const;
  const boards: Board[] = [];
  while (boards.length < 60) {
    const [width, height] = shapes[Math.floor(rng() * shapes.length)]!;
    const count = width * height;
    const cells = shuffled(
      Array.from({ length: count }, (_, i) => i),
      rng,
    );
    const k = 2 + Math.floor(rng() * 3);
    const numbers = cells.slice(0, k).map((cell, i) => [cell, i + 1] as const);
    const walls: string[] = [];
    for (let cell = 0; cell < count; cell++) {
      if (cell % width < width - 1 && rng() < 0.15) walls.push(`v${cell}`);
      if (Math.floor(cell / width) < height - 1 && rng() < 0.15) walls.push(`h${cell}`);
    }
    const board = buildBoard({ width, height, numbers, walls });
    if (board !== null) boards.push(board);
  }

  it('agrees with a naive search on every random board', () => {
    let unique = 0;
    let none = 0;
    for (const board of boards) {
      const naive = naiveCount(board, 2);
      const pruned = countSolutions(board);
      expect(pruned.solutions, `${board.width}×${board.height} ${board.walls.join(' ')}`).toBe(
        naive.count,
      );
      if (naive.count === 1) {
        unique++;
        expect(pruned.solution).toEqual(naive.first);
        expect(isSolution(board, pruned.solution!)).toBe(true);
      }
      if (naive.count === 0) none++;
    }
    // The sample has to hold all three answers, or the comparison is hollow.
    expect(unique).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
    expect(boards.length - unique - none).toBeGreaterThan(0);
  });
});
