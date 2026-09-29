/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/BINARY_BALANCE_RULES.md §11).
 *
 * Boards are one character per cell, row-major: '0' the circle, '1' the
 * square, '.' nothing. Links are a comma-separated list of edges: `h<i>=` is
 * a `=` between cell i and its right neighbour, `v<i>x` a `×` between cell i
 * and the cell below.
 *
 * Decoding fails closed, and closed here means more than "the characters
 * parse". A record only survives if it is one play could have produced: the
 * links name real edges, once each, and there is at least one; the solution
 * keeps all three rules under them; every given matches the solution under
 * it; and no mark sits on a given. A save that fails any of those did not
 * come from this game, and the caller drops it for a fresh board.
 */
import { isSolved, isValidLinks } from './engine';
import {
  EMPTY,
  CIRCLE,
  SQUARE,
  cellCount,
  compareLinks,
  type Cell,
  type Link,
  type Mark,
  type Size,
} from './types';

const EMPTY_CHARACTER = '.';

/** Encodes a solution, a givens board or a marks board — all three are cells. */
export function encodeBoard(cells: readonly Mark[]): string {
  return cells.map((cell) => (cell === EMPTY ? EMPTY_CHARACTER : String(cell))).join('');
}

/** Encodes links as `h<i>=` / `v<i>x`, comma-separated, in the order given. */
export function encodeLinks(links: readonly Link[]): string {
  return links.map((link) => `${link.dir}${link.index}${link.same ? '=' : 'x'}`).join(',');
}

function decodeCells(text: unknown, size: Size): Mark[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(size)) return null;
  const cells: Mark[] = [];
  for (const character of text) {
    if (character === '0') cells.push(CIRCLE);
    else if (character === '1') cells.push(SQUARE);
    else if (character === EMPTY_CHARACTER) cells.push(EMPTY);
    else return null;
  }
  return cells;
}

const LINK_PATTERN = /^([hv])(\d{1,3})([=x])$/;

/**
 * Decodes persisted links. Null unless every entry names a real edge once, the
 * kind is `=` or `x`, and there is at least one (§6: a board without links is
 * never dealt). Returned in canonical order.
 */
export function decodeLinks(text: unknown, size: Size): Link[] | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  const links: Link[] = [];
  for (const part of text.split(',')) {
    const match = LINK_PATTERN.exec(part);
    if (match === null) return null;
    links.push({
      dir: match[1] === 'h' ? 'h' : 'v',
      index: Number(match[2]),
      same: match[3] === '=',
    });
  }
  if (!isValidLinks(links, size)) return null;
  return links.sort(compareLinks);
}

/**
 * Decodes a persisted solution. Null unless it is a finished board that keeps
 * all three rules under the links — the invariant everything else leans on.
 */
export function decodeSolution(text: unknown, links: readonly Link[], size: Size): Cell[] | null {
  const cells = decodeCells(text, size);
  if (cells === null || !isSolved(cells, links, size)) return null;
  return cells as Cell[];
}

/** Decodes persisted givens. Null when any of them disagrees with the solution. */
export function decodeGivens(text: unknown, size: Size, solution: readonly Cell[]): Mark[] | null {
  const cells = decodeCells(text, size);
  if (cells === null) return null;
  const consistent = cells.every((cell, index) => cell === EMPTY || cell === solution[index]);
  return consistent ? cells : null;
}

/** Decodes persisted marks. Null when one of them sits on a given (§11). */
export function decodeMarks(text: unknown, size: Size, givens: readonly Mark[]): Mark[] | null {
  const cells = decodeCells(text, size);
  if (cells === null) return null;
  const clear = cells.every((cell, index) => cell === EMPTY || givens[index] === EMPTY);
  return clear ? cells : null;
}

export interface DecodedBoards {
  readonly links: Link[];
  readonly solution: Cell[];
  readonly givens: Mark[];
  readonly marks: Mark[];
}

/**
 * The four parts of one saved game, checked against each other. Null when any
 * single part fails, so a caller has one call to make and one thing to check.
 */
export function decodeBoards(
  parts: { links: unknown; solution: unknown; givens: unknown; marks: unknown },
  size: Size,
): DecodedBoards | null {
  const links = decodeLinks(parts.links, size);
  if (links === null) return null;
  const solution = decodeSolution(parts.solution, links, size);
  if (solution === null) return null;
  const givens = decodeGivens(parts.givens, size, solution);
  if (givens === null) return null;
  const marks = decodeMarks(parts.marks, size, givens);
  return marks === null ? null : { links, solution, givens, marks };
}
