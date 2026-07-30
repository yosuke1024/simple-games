/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/SLIDING_PUZZLE_RULES.md §10).
 *
 * One base-36 character per cell, row-major: '0' is the blank and the largest
 * tile a 5x5 holds is 24, which is still a single character ('o'). A whole 5x5
 * board is therefore 25 characters.
 *
 * Decoding fails closed. Beyond the obvious length check it insists the values
 * are a permutation of 0..N²-1 and that the board is solvable — neither can be
 * produced by playing, so a record holding one is corrupt rather than merely
 * odd, and loading it would hand the player a puzzle with no ending.
 */
import { isSolvable, isValidTiles } from './engine';
import { cellCount, type Size, type Tiles } from './types';

export function encodeTiles(tiles: Tiles): string {
  return tiles.map((value) => value.toString(36)).join('');
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeTiles(text: string, size: Size): Tiles | null {
  const total = cellCount(size);
  if (typeof text !== 'string' || text.length !== total) return null;

  const tiles: number[] = [];
  for (const character of text) {
    const value = parseInt(character, 36);
    if (!Number.isInteger(value)) return null;
    tiles.push(value);
  }
  if (!isValidTiles(tiles, size)) return null;
  if (!isSolvable(tiles, size)) return null;
  return tiles;
}
