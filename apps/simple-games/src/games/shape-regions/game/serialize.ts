/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/SHAPE_REGIONS_RULES.md §11).
 *
 * One character per cell, row-major: a lowercase letter names the region
 * (`a` is clue 0) and `.` is a cell with nothing in it. A 7×7 board is 49
 * characters, and a saved game is two of them — solution and assignment.
 *
 * Decoding fails closed, and closed here means more than "the characters
 * parse". A solution only survives if it keeps every rule of §3 against the
 * clues it came with; an assignment only survives if play could have produced
 * it — every region connected through its clue, no clue cell anywhere but in
 * its own region. A save that fails either did not come from this game, and
 * the caller drops it for a fresh board rather than handing the player a
 * puzzle with no answer.
 */
import { isSolved, reachableFromClue, regionCells } from './engine';
import { MAX_REGIONS, UNASSIGNED, isValidClueList, type Layout } from './types';

const EMPTY_CHARACTER = '.';
const FIRST_LETTER = 'a'.charCodeAt(0);

export const regionLetter = (region: number): string => String.fromCharCode(FIRST_LETTER + region);

/** Encodes a solution or an assignment — both are regions per cell. */
export function encodeRegions(cells: readonly number[]): string {
  return cells
    .map((region) => (region === UNASSIGNED ? EMPTY_CHARACTER : regionLetter(region)))
    .join('');
}

function decodeCells(text: unknown, layout: Layout): number[] | null {
  const count = layout.width * layout.height;
  if (typeof text !== 'string' || text.length !== count) return null;
  const cells: number[] = [];
  for (const character of text) {
    if (character === EMPTY_CHARACTER) {
      cells.push(UNASSIGNED);
      continue;
    }
    const region = character.charCodeAt(0) - FIRST_LETTER;
    if (region < 0 || region >= layout.clues.length || region >= MAX_REGIONS) return null;
    cells.push(region);
  }
  return cells;
}

/**
 * Decodes a persisted solution. Null unless it is a full partition that keeps
 * the four rules of §3 against the layout's clues — the one invariant
 * everything else in the save leans on.
 */
export function decodeSolution(text: unknown, layout: Layout): number[] | null {
  if (!isValidClueList(layout.clues, layout.width, layout.height)) return null;
  const cells = decodeCells(text, layout);
  if (cells === null || !isSolved(layout, cells)) return null;
  return cells;
}

/**
 * Decodes a persisted assignment. Null when it is not a board play could have
 * produced (§11): a clue cell outside its own region, a region holding another
 * region's clue, or a cell the region's clue cannot reach through the region.
 */
export function decodeAssignment(text: unknown, layout: Layout): number[] | null {
  if (!isValidClueList(layout.clues, layout.width, layout.height)) return null;
  const cells = decodeCells(text, layout);
  if (cells === null) return null;
  for (let region = 0; region < layout.clues.length; region++) {
    const clue = layout.clues[region]!;
    if (cells[clue.index] !== region) return null;
    const held = regionCells(cells, region);
    if (held.some((index) => index !== clue.index && layout.clues.some((c) => c.index === index))) {
      return null;
    }
    if (reachableFromClue(cells, layout, region).size !== held.length) return null;
  }
  return cells;
}

export interface DecodedBoards {
  readonly solution: number[];
  readonly assignment: number[];
}

/**
 * The two boards of one saved game, checked against the clues. Null when
 * either part fails, so a caller has one call to make and one thing to check.
 */
export function decodeBoards(
  parts: { solution: unknown; assignment: unknown },
  layout: Layout,
): DecodedBoards | null {
  const solution = decodeSolution(parts.solution, layout);
  if (solution === null) return null;
  const assignment = decodeAssignment(parts.assignment, layout);
  return assignment === null ? null : { solution, assignment };
}
