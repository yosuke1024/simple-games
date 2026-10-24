/**
 * Test-only helpers shared by this folder's *.test.ts files: seeded random
 * games, and a judge of the rules written without the engine.
 *
 * The judge works on the 9×9 screen grid (rows and columns, §1) rather than
 * the engine's small-board-first index, and recomputes everything from the
 * marks each time — no incremental state, no make / unmake — so a mistake in
 * the engine's bookkeeping cannot be repeated here by construction.
 * Not imported by any shipped module.
 */
import { createRng } from './rng';

/** Screen row / column of a cell, from §1's formula — written out again on purpose. */
const rowColOf = (cell: number): [number, number] => {
  const b = Math.floor(cell / 9);
  const c = cell % 9;
  return [3 * Math.floor(b / 3) + Math.floor(c / 3), 3 * (b % 3) + (c % 3)];
};

const cellAt = (row: number, col: number): number => {
  const b = 3 * Math.floor(row / 3) + Math.floor(col / 3);
  const c = 3 * (row % 3) + (col % 3);
  return 9 * b + c;
};

export interface Judgement {
  /** 0 open, 1 cross, 2 circle, 3 drawn — per small board, row-major on the big board. */
  readonly smalls: number[];
  /** 0 ongoing, 1 cross won, 2 circle won, 3 drawn. */
  readonly result: number;
  /** Legal cells, ascending. */
  readonly legal: number[];
}

/** Who has three in a row in a 3×3 grid read by `at(r, c)`, or 0. */
function lineOwner(at: (r: number, c: number) => number): number {
  const triples: [number, number][][] = [];
  for (let i = 0; i < 3; i++) {
    triples.push([
      [i, 0],
      [i, 1],
      [i, 2],
    ]);
    triples.push([
      [0, i],
      [1, i],
      [2, i],
    ]);
  }
  triples.push([
    [0, 0],
    [1, 1],
    [2, 2],
  ]);
  triples.push([
    [0, 2],
    [1, 1],
    [2, 0],
  ]);
  for (const triple of triples) {
    const marks = triple.map(([r, c]) => at(r, c));
    if (marks[0] !== 0 && marks[0] !== 3 && marks.every((m) => m === marks[0])) return marks[0]!;
  }
  return 0;
}

/**
 * Judges a legal move list from scratch. Assumes the list was legal (the
 * fuzz only plays moves this judge allowed), so a small board holds at most
 * one owner's line: it closed when the first line appeared.
 */
export function judge(moves: readonly number[]): Judgement {
  const grid: number[][] = Array.from({ length: 9 }, () => new Array<number>(9).fill(0));
  moves.forEach((cell, index) => {
    const [row, col] = rowColOf(cell);
    grid[row]![col] = index % 2 === 0 ? 1 : 2;
  });
  const smalls: number[] = [];
  for (let R = 0; R < 3; R++) {
    for (let C = 0; C < 3; C++) {
      const owner = lineOwner((r, c) => grid[3 * R + r]![3 * C + c]!);
      let full = true;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) if (grid[3 * R + r]![3 * C + c] === 0) full = false;
      smalls.push(owner !== 0 ? owner : full ? 3 : 0);
    }
  }
  const winner = lineOwner((r, c) => smalls[3 * r + c]!);
  const result = winner !== 0 ? winner : smalls.every((s) => s !== 0) ? 3 : 0;

  const legal: number[] = [];
  if (result === 0) {
    let boards: number[];
    if (moves.length === 0) boards = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    else {
      const [row, col] = rowColOf(moves[moves.length - 1]!);
      const target = 3 * (row % 3) + (col % 3);
      boards =
        smalls[target] === 0
          ? [target]
          : [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((b) => smalls[b] === 0);
    }
    for (const board of boards) {
      const R = Math.floor(board / 3);
      const C = board % 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (grid[3 * R + r]![3 * C + c] === 0) legal.push(cellAt(3 * R + r, 3 * C + c));
        }
      }
    }
    legal.sort((a, b) => a - b);
  }
  return { smalls, result, legal };
}

/**
 * A whole game of uniformly random legal moves for `seed` — §13's fuzz and
 * §4.3's measuring positions play this way. Moves come from the judge, not
 * the engine, so the engine is checked against something it did not choose.
 */
export function randomGame(seed: string): number[] {
  const rng = createRng(seed);
  const moves: number[] = [];
  for (;;) {
    const { legal } = judge(moves);
    if (legal.length === 0) return moves;
    moves.push(legal[Math.floor(rng() * legal.length)]!);
  }
}
