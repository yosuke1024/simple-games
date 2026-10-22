/**
 * The board model, lighting and the win predicate (docs/PIPE_LINK_RULES.md §1, §2).
 *
 * A board is fixed after generation: its size, each cell's tile type and the
 * source cell. The player changes only orientations, which live outside the
 * board as a plain array (one number per cell, row-major).
 */
import {
  DIRECTIONS,
  hasPipe,
  isValidOrientation,
  opposite,
  pipeMask,
  type TileType,
} from './tiles';

export interface Board {
  readonly width: number;
  readonly height: number;
  /** Row-major, `width × height` entries. */
  readonly types: readonly TileType[];
  /** The source cell's index (`row × width + col`). */
  readonly source: number;
}

/** True when the shape is one the model can hold: at least two cells, matching type count, source inside. */
export function isValidBoard(board: Board): boolean {
  const { width, height, types, source } = board;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return false;
  if (width < 1 || height < 1 || width * height < 2) return false;
  if (types.length !== width * height) return false;
  if (!Number.isInteger(source) || source < 0 || source >= types.length) return false;
  return true;
}

/** Builds a board, throwing on a shape `isValidBoard` rejects. */
export function createBoard(
  width: number,
  height: number,
  types: readonly TileType[],
  source: number,
): Board {
  const board: Board = { width, height, types: [...types], source };
  if (!isValidBoard(board)) {
    throw new RangeError(`invalid board ${width}×${height} with ${types.length} tiles`);
  }
  return board;
}

/** The cell beside `index` in direction `dir`, or -1 past the (closed, non-wrapping) edge. */
export function neighborOf(board: Board, index: number, dir: number): number {
  const col = index % board.width;
  const row = (index - col) / board.width;
  switch (dir) {
    case 0:
      return row > 0 ? index - board.width : -1;
    case 1:
      return col < board.width - 1 ? index + 1 : -1;
    case 2:
      return row < board.height - 1 ? index + board.width : -1;
    default:
      return col > 0 ? index - 1 : -1;
  }
}

/** True when the orientations array fits the board: one per cell, each inside its type's period. */
export function isValidOrientations(board: Board, orientations: readonly number[]): boolean {
  if (orientations.length !== board.types.length) return false;
  for (let i = 0; i < orientations.length; i++) {
    if (!isValidOrientation(board.types[i]!, orientations[i]!)) return false;
  }
  return true;
}

/** Each cell's pipe mask under the given orientations. */
export function masksOf(board: Board, orientations: readonly number[]): number[] {
  if (orientations.length !== board.types.length) {
    throw new RangeError('one orientation per cell');
  }
  return board.types.map((type, i) => pipeMask(type, orientations[i]!));
}

/** The neighbour joined to `index` across `dir` (both point pipes at each other — §2 rule 2), or -1. */
function joined(board: Board, masks: readonly number[], index: number, dir: number): number {
  if (!hasPipe(masks[index]!, dir)) return -1;
  const other = neighborOf(board, index, dir);
  if (other < 0 || !hasPipe(masks[other]!, opposite(dir))) return -1;
  return other;
}

/** The lit set: every cell reached from the source through connections (§2 rule 3). */
export function litSet(board: Board, orientations: readonly number[]): boolean[] {
  const masks = masksOf(board, orientations);
  const lit = new Array<boolean>(masks.length).fill(false);
  const queue = [board.source];
  lit[board.source] = true;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const dir of DIRECTIONS) {
      const other = joined(board, masks, cell, dir);
      if (other >= 0 && !lit[other]) {
        lit[other] = true;
        queue.push(other);
      }
    }
  }
  return lit;
}

export function countLit(board: Board, orientations: readonly number[]): number {
  return litSet(board, orientations).filter(Boolean).length;
}

export function isAllLit(board: Board, orientations: readonly number[]): boolean {
  return countLit(board, orientations) === board.types.length;
}

/** Pipe mouths that meet nothing: into the edge, or into a neighbour that does not point back. */
export function openEnds(board: Board, orientations: readonly number[]): number {
  const masks = masksOf(board, orientations);
  let open = 0;
  for (let i = 0; i < masks.length; i++) {
    for (const dir of DIRECTIONS) {
      if (hasPipe(masks[i]!, dir) && joined(board, masks, i, dir) < 0) open++;
    }
  }
  return open;
}

/** The number of connections (each counted once). */
export function connectionCount(board: Board, orientations: readonly number[]): number {
  const masks = masksOf(board, orientations);
  let count = 0;
  for (let i = 0; i < masks.length; i++) {
    // Count each pair from its left / upper cell only.
    if (joined(board, masks, i, 1) >= 0) count++;
    if (joined(board, masks, i, 2) >= 0) count++;
  }
  return count;
}

/** All pipe mouths on the board — `2 × (cells − 1)` on every board built from a spanning tree (§2). */
export function totalPipes(board: Board, orientations: readonly number[]): number {
  let total = 0;
  for (const mask of masksOf(board, orientations)) {
    for (let m = mask; m !== 0; m &= m - 1) total++;
  }
  return total;
}

/**
 * The win (§2): every cell lit, no open end, and exactly `cells − 1`
 * connections — the connection graph is a spanning tree. On a board whose
 * mouths total `2 × (cells − 1)` (every generated board), "every cell lit"
 * alone implies the other two; the full check keeps this right on hand-made
 * boards too.
 */
export function isSolved(board: Board, orientations: readonly number[]): boolean {
  if (!isAllLit(board, orientations)) return false;
  if (openEnds(board, orientations) !== 0) return false;
  return connectionCount(board, orientations) === board.types.length - 1;
}
