/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/CROWN_GRID_RULES.md §11).
 *
 * Three strings. Regions are one letter per cell, 'a' for region 0 up to 'i'
 * for region 8. The solution is one digit per row, the crown's column. Marks
 * are one character per cell: '.' empty, 'x' a cross, 'q' a crown. A 9×9 game
 * is therefore 81 + 9 + 81 characters.
 *
 * Decoding fails closed, and closed here means more than "the characters
 * parse". A record only survives if it is a record play could have produced:
 * the regions are N connected regions covering the board, the solution keeps
 * both rules under them, and the marks hold nothing but the three characters.
 * A save that fails any of those did not come from this game, and the caller
 * drops it for a fresh board rather than handing the player a puzzle with no
 * answer.
 */
import { isValidRegions, isValidSolution } from './engine';
import {
  CROSS,
  CROWN,
  EMPTY,
  cellCount,
  type Mark,
  type Regions,
  type Size,
  type Solution,
} from './types';

const REGION_BASE = 'a'.charCodeAt(0);
const MARK_CHARACTERS: Record<Mark, string> = { 0: '.', 1: 'x', 2: 'q' };

/** Regions as letters, 'a' upward, one per cell. */
export function encodeRegions(regions: Regions): string {
  return regions.map((region) => String.fromCharCode(REGION_BASE + region)).join('');
}

/** The solution as digits, one per row. */
export function encodeSolution(solution: Solution): string {
  return solution.map((col) => String(col)).join('');
}

/** Marks as '.', 'x' and 'q', one per cell. */
export function encodeMarks(marks: readonly Mark[]): string {
  return marks.map((mark) => MARK_CHARACTERS[mark]).join('');
}

/**
 * Decodes a persisted partition. Null unless it is N connected regions that
 * cover the board — the one invariant everything else in the save leans on.
 */
export function decodeRegions(text: unknown, size: Size): number[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(size)) return null;
  const regions: number[] = [];
  for (const character of text) {
    const region = character.charCodeAt(0) - REGION_BASE;
    if (character.length !== 1 || region < 0 || region >= size) return null;
    regions.push(region);
  }
  return isValidRegions(regions, size) ? regions : null;
}

/** Decodes a persisted solution. Null unless it keeps both rules under the regions. */
export function decodeSolution(text: unknown, regions: Regions, size: Size): number[] | null {
  if (typeof text !== 'string' || text.length !== size) return null;
  const solution: number[] = [];
  for (const character of text) {
    if (character < '0' || character > '9') return null;
    solution.push(Number(character));
  }
  return isValidSolution(solution, regions, size) ? solution : null;
}

/** Decodes persisted marks. Null on a wrong length or a character play never writes. */
export function decodeMarks(text: unknown, size: Size): Mark[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(size)) return null;
  const marks: Mark[] = [];
  for (const character of text) {
    if (character === '.') marks.push(EMPTY);
    else if (character === 'x') marks.push(CROSS);
    else if (character === 'q') marks.push(CROWN);
    else return null;
  }
  return marks;
}

export interface DecodedBoards {
  readonly regions: number[];
  readonly solution: number[];
  readonly marks: Mark[];
}

/**
 * The three parts of one saved game, checked against each other. Null when
 * any single part fails, so a caller has one call to make and one thing to
 * check rather than an order of operations to get right.
 */
export function decodeBoards(
  parts: { regions: unknown; solution: unknown; marks: unknown },
  size: Size,
): DecodedBoards | null {
  const regions = decodeRegions(parts.regions, size);
  if (regions === null) return null;
  const solution = decodeSolution(parts.solution, regions, size);
  if (solution === null) return null;
  const marks = decodeMarks(parts.marks, size);
  return marks === null ? null : { regions, solution, marks };
}
