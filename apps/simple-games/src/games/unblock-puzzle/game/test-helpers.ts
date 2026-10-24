/**
 * Test helpers: an independent brute-force reading of the rules
 * (docs/UNBLOCK_PUZZLE_RULES.md §1–§4), for checking the fast searches
 * against.
 *
 * Nothing here imports the engine, the search or the serializer. A board is
 * turned into a 6×6 grid of letters with this file's own arithmetic; a move
 * is found by scanning the grid for a letter's cells and sliding them one
 * cell at a time while the next cell is empty; a board is a 36-character
 * string in a `Set`, and a slide is a new string spliced from the old one's
 * unchanged stretches. It is slow — strings and sets where search.ts packs bits
 * into typed arrays — and that is the point: two implementations that share
 * no code cannot share a bug, so when they agree on the fewest moves of a
 * board, the number is the rules' and not the implementation's.
 */
import type { Board } from './types';

const SIZE = 6;

/** The board as a 36-character grid: `.` empty, `a` the target, `b`… the rest. */
export function oracleGrid(board: Board): string {
  const grid = new Array<string>(SIZE * SIZE).fill('.');
  board.blocks.forEach((block, index) => {
    const letter = String.fromCharCode(97 + index);
    const offset = board.positions[index]!;
    for (let k = 0; k < block.length; k++) {
      const row = block.orientation === 'h' ? block.lane : offset + k;
      const col = block.orientation === 'h' ? offset + k : block.lane;
      if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || grid[row * SIZE + col] !== '.') {
        throw new Error('oracle: not a board');
      }
      grid[row * SIZE + col] = letter;
    }
  });
  return grid.join('');
}

/** Solved: the target's two cells are the last two of the third row. */
const solvedGrid = (grid: string): boolean =>
  grid[2 * SIZE + 4] === 'a' && grid[2 * SIZE + 5] === 'a';

/** Runs of empty cells, by length. */
const EMPTIES = ['', '.', '..', '...', '....', '.....', '......'];

/**
 * The grid with one vertical run of `length` cells of `letter`, starting at
 * `top`, moved `shift` rows (negative: up): the cells it leaves become empty
 * and the cells it reaches take the letter. Built by slicing the unchanged
 * stretches between the cells of its column.
 */
function shiftColumn(
  grid: string,
  top: number,
  length: number,
  shift: number,
  letter: string,
): string {
  const from = Math.min(top, top + shift * SIZE);
  const to = Math.max(top, top + shift * SIZE) + (length - 1) * SIZE;
  const newTop = top + shift * SIZE;
  const newBottom = newTop + (length - 1) * SIZE;
  let out = grid.slice(0, from);
  for (let cell = from; cell <= to; cell += SIZE) {
    out += cell >= newTop && cell <= newBottom ? letter : '.';
    if (cell < to) out += grid.slice(cell + 1, cell + SIZE);
  }
  return out + grid.slice(to + 1);
}

/**
 * Every grid one slide away — any distance, one block — in no particular
 * order. A block is a letter's cells, found by one scan of the grid: a run
 * along a row when its cells are consecutive, down a column otherwise. It
 * slides while the cell ahead of it is empty and on the board.
 */
export function oracleNeighbours(grid: string): string[] {
  const out: string[] = [];
  const first = new Map<string, number>();
  const last = new Map<string, number>();
  const count = new Map<string, number>();
  for (let cell = 0; cell < grid.length; cell++) {
    const letter = grid[cell]!;
    if (letter === '.') continue;
    if (!first.has(letter)) first.set(letter, cell);
    last.set(letter, cell);
    count.set(letter, (count.get(letter) ?? 0) + 1);
  }
  for (const [letter, head] of first) {
    const tail = last.get(letter)!;
    const length = count.get(letter)!;
    if (tail - head === length - 1) {
      // Along its row: slices of the row change, the rest is copied.
      const rowStart = head - (head % SIZE);
      const run = letter.repeat(length);
      for (let s = 1; head - s >= rowStart && grid[head - s] === '.'; s++) {
        out.push(grid.slice(0, head - s) + run + EMPTIES[s]! + grid.slice(tail + 1));
      }
      for (let s = 1; tail + s < rowStart + SIZE && grid[tail + s] === '.'; s++) {
        out.push(grid.slice(0, head) + EMPTIES[s]! + run + grid.slice(tail + 1 + s));
      }
    } else {
      for (let s = 1; head - s * SIZE >= 0 && grid[head - s * SIZE] === '.'; s++) {
        out.push(shiftColumn(grid, head, length, -s, letter));
      }
      for (let s = 1; tail + s * SIZE < SIZE * SIZE && grid[tail + s * SIZE] === '.'; s++) {
        out.push(shiftColumn(grid, head, length, s, letter));
      }
    }
  }
  return out;
}

export interface OracleResult {
  /** Fewest moves to the exit; null when no board reachable from here is solved. */
  readonly minMoves: number | null;
  /** Boards fewer than `minMoves` moves away (§7). */
  readonly explored: number;
}

/**
 * Breadth first from the board, layer by layer, until a layer holds a solved
 * board. Throws past `cap` boards — a test that needs more is a test to
 * rethink, not a reason to answer from a partial search.
 */
export function oracleSolve(board: Board, cap = 50_000): OracleResult {
  const start = oracleGrid(board);
  if (solvedGrid(start)) return { minMoves: 0, explored: 0 };
  const seen = new Set<string>([start]);
  let layer = [start];
  let explored = 0;
  for (let depth = 1; layer.length > 0; depth++) {
    explored += layer.length;
    const next: string[] = [];
    for (const grid of layer) {
      for (const neighbour of oracleNeighbours(grid)) {
        if (seen.has(neighbour)) continue;
        if (solvedGrid(neighbour)) return { minMoves: depth, explored };
        seen.add(neighbour);
        if (seen.size > cap) throw new Error(`oracle: more than ${cap} boards`);
        next.push(neighbour);
      }
    }
    layer = next;
  }
  return { minMoves: null, explored };
}
