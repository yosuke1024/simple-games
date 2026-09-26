/**
 * The persisted form of a board and its paths (docs/NUMBER_PATH_RULES.md §9),
 * and the fail-closed read back.
 *
 * A board travels as its size, a sparse list of [cell, number] pairs and a
 * list of wall ids (`h<i>` below cell i, `v<i>` right of it); the solution
 * and the player's path travel as lists of cells. Closed here means more than
 * "the fields parse": a record only survives if it is one play could have
 * produced — the board builds, the solution is a legal path that covers it
 * and ends on K, and the player's path is a legal prefix on that board. A
 * save that fails any of those did not come from this game, and the caller
 * drops it for a fresh board rather than handing the player a puzzle with no
 * answer.
 */
import { buildBoard, isLegalPrefix, isSolution } from './engine';
import type { Board, Path } from './types';

/** The numbered cells as [cell, number] pairs, in number order. */
export function encodeNumbers(board: Board): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  for (let n = 1; n <= board.last; n++) out.push([board.cellOf[n]!, n]);
  return out;
}

const isCellList = (value: unknown, max: number): value is number[] =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((cell) => typeof cell === 'number' && Number.isInteger(cell));

/**
 * Decodes a persisted board. Null unless every field is the shape the game
 * writes and `buildBoard` accepts it (§1, §9).
 */
export function decodeBoard(parts: {
  width: unknown;
  height: unknown;
  numbers: unknown;
  walls: unknown;
}): Board | null {
  const { width, height, numbers, walls } = parts;
  if (typeof width !== 'number' || typeof height !== 'number') return null;
  if (!Array.isArray(numbers) || numbers.length > 64) return null;
  const pairs: (readonly [number, number])[] = [];
  for (const entry of numbers) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [cell, n] = entry as unknown[];
    if (typeof cell !== 'number' || typeof n !== 'number') return null;
    pairs.push([cell, n]);
  }
  if (!Array.isArray(walls) || walls.length > 128) return null;
  if (!walls.every((id) => typeof id === 'string' && id.length <= 4)) return null;
  return buildBoard({ width, height, numbers: pairs, walls: walls as string[] });
}

/**
 * Decodes a persisted solution: a legal path that covers the board and ends
 * on K — the one invariant everything else in the save leans on.
 */
export function decodeSolution(value: unknown, board: Board): Path | null {
  if (!isCellList(value, board.width * board.height)) return null;
  return isSolution(board, value) ? value : null;
}

/**
 * Decodes the player's path: any legal prefix on the board (§3). It need not
 * follow the solution — a player who has gone astray is still mid-game.
 */
export function decodePath(value: unknown, board: Board): Path | null {
  if (!isCellList(value, board.width * board.height)) return null;
  return isLegalPrefix(board, value) ? value : null;
}

export interface DecodedGame {
  readonly board: Board;
  readonly solution: Path;
  readonly path: Path;
}

/**
 * The whole of one saved board, checked against itself. Null when any single
 * part fails, so a caller has one call to make and one thing to check.
 */
export function decodeGame(parts: {
  width: unknown;
  height: unknown;
  numbers: unknown;
  walls: unknown;
  solution: unknown;
  path: unknown;
}): DecodedGame | null {
  const board = decodeBoard(parts);
  if (board === null) return null;
  const solution = decodeSolution(parts.solution, board);
  if (solution === null) return null;
  const path = decodePath(parts.path, board);
  return path === null ? null : { board, solution, path };
}
