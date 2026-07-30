/**
 * Board state transitions (docs/SLIDING_PUZZLE_RULES.md §2, §3).
 *
 * Pure and immutable: a move returns a new board, or null when the tap does
 * nothing. There is no game over and nothing to lose — a legal board can
 * always be finished (§4, §5), so the only outcomes are "playing" and "solved".
 *
 * The one rule with any depth is the multi-tile slide (§3): tapping a tile that
 * shares the blank's row or column moves every tile between the two, and the
 * move costs as many moves as tiles that travelled. That is why `applyMove`
 * reports a count instead of returning a bare board.
 */
import { cellCount, colOf, indexOf, rowOf, type Size, type Tiles } from './types';

/** Where the blank sits, or -1 for a board with no blank (never from play). */
export function blankIndex(tiles: Tiles): number {
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === 0) return i;
  return -1;
}

/** Solved: 1..N²-1 in reading order with the blank last (§2). */
export function isSolved(tiles: Tiles, size: Size): boolean {
  const total = cellCount(size);
  if (tiles.length !== total) return false;
  for (let i = 0; i < total - 1; i++) if (tiles[i] !== i + 1) return false;
  return tiles[total - 1] === 0;
}

/** A board that could have come from play: a permutation of 0..N²-1. */
export function isValidTiles(tiles: Tiles, size: Size): boolean {
  const total = cellCount(size);
  if (tiles.length !== total) return false;
  const seen = new Array<boolean>(total).fill(false);
  for (const value of tiles) {
    if (!Number.isInteger(value) || value < 0 || value >= total) return false;
    if (seen[value]) return false;
    seen[value] = true;
  }
  return true;
}

/**
 * The tiles a tap would move, nearest to the blank first — or null when the tap
 * does nothing: the blank itself, an out-of-range index, or a tile that shares
 * neither the blank's row nor its column (§3).
 */
export function tilesToMove(tiles: Tiles, size: Size, index: number): readonly number[] | null {
  const total = cellCount(size);
  if (!Number.isInteger(index) || index < 0 || index >= total) return null;
  const blank = blankIndex(tiles);
  if (blank < 0 || index === blank) return null;

  const blankRow = rowOf(blank, size);
  const blankCol = colOf(blank, size);
  const row = rowOf(index, size);
  const col = colOf(index, size);
  const moving: number[] = [];

  if (row === blankRow) {
    // Walk from the cell beside the blank out to the tapped tile, so applying
    // the list in order always steps a tile into a cell that is already empty.
    const step = col < blankCol ? 1 : -1;
    for (let x = blankCol - step; ; x -= step) {
      moving.push(indexOf(row, x, size));
      if (x === col) break;
    }
    return moving;
  }
  if (col === blankCol) {
    const step = row < blankRow ? 1 : -1;
    for (let y = blankRow - step; ; y -= step) {
      moving.push(indexOf(y, col, size));
      if (y === row) break;
    }
    return moving;
  }
  return null;
}

export interface MoveResult {
  readonly tiles: Tiles;
  /** How many tiles travelled — the move cost (§3). */
  readonly moved: number;
}

/** Applies a tap. Returns null for an illegal tap, which must change nothing. */
export function applyMove(tiles: Tiles, size: Size, index: number): MoveResult | null {
  const moving = tilesToMove(tiles, size, index);
  if (moving === null || moving.length === 0) return null;

  const next = [...tiles];
  let hole = blankIndex(tiles);
  for (const from of moving) {
    next[hole] = next[from]!;
    next[from] = 0;
    hole = from;
  }
  return { tiles: next, moved: moving.length };
}

/**
 * The cells holding a tile that can slide into the blank on its own — the
 * single-tile legal moves. Fixed order (up, down, left, right) so a seeded
 * shuffle is reproducible.
 */
export function neighborsOfBlank(tiles: Tiles, size: Size): readonly number[] {
  const blank = blankIndex(tiles);
  if (blank < 0) return [];
  const row = rowOf(blank, size);
  const col = colOf(blank, size);
  const out: number[] = [];
  if (row > 0) out.push(indexOf(row - 1, col, size));
  if (row < size - 1) out.push(indexOf(row + 1, col, size));
  if (col > 0) out.push(indexOf(row, col - 1, size));
  if (col < size - 1) out.push(indexOf(row, col + 1, size));
  return out;
}

/** Pairs of tiles (blank excluded) that read out of order — the parity input. */
export function inversionCount(tiles: Tiles): number {
  const values = tiles.filter((value) => value !== 0);
  let inversions = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i]! > values[j]!) inversions++;
    }
  }
  return inversions;
}

/**
 * Whether a board can be finished. Sliding preserves one invariant, so this is
 * decidable without searching: with the blank's row counted from the bottom
 * (bottom row = 1),
 *
 * - odd N:  solvable iff the inversion count is even;
 * - even N: solvable iff inversions + that row number is odd.
 *
 * Generation never needs this — it only ever plays legal moves from the solved
 * board, so its output is solvable by construction (§5). It exists so the tests
 * can check that claim independently, and so a corrupt save can be recognised
 * as impossible rather than merely odd.
 */
export function isSolvable(tiles: Tiles, size: Size): boolean {
  if (!isValidTiles(tiles, size)) return false;
  const inversions = inversionCount(tiles);
  if (size % 2 === 1) return inversions % 2 === 0;
  const rowFromBottom = size - rowOf(blankIndex(tiles), size);
  return (inversions + rowFromBottom) % 2 === 1;
}
