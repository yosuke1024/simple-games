/**
 * Compact, fail-closed board serialization for saves and the bundled boards
 * (docs/PIPE_LINK_RULES.md §7).
 *
 * Types are one letter per cell, row-major (`e` end, `s` straight, `l`
 * elbow, `t` tee — §1); orientations are one digit per cell, inside the
 * cell's type's period (`0`–`3`, a straight only `0`–`1`).
 *
 * Decoding fails closed, and closed means more than "the characters parse":
 * an answer survives only if it is a solved arrangement of the board — a
 * spanning tree with every pipe matched (§2) — and the player's
 * orientations only if every digit fits its tile. All of it is linear in the
 * board's size: no search runs here (§4「仕事量と上限」).
 */
import { createBoard, isSolved, isValidBoard, type Board } from './board';
import { TYPE_CODE, TILE_TYPES, isValidOrientation, type TileType } from './tiles';

const TYPE_OF_CODE: Readonly<Record<string, TileType>> = (() => {
  const out: Record<string, TileType> = {};
  for (const type of TILE_TYPES) out[TYPE_CODE[type]] = type;
  return out;
})();

/** Types as one letter per cell. */
export function encodeTypes(types: readonly TileType[]): string {
  return types.map((type) => TYPE_CODE[type]).join('');
}

/** Decodes types: exactly `cells` letters, each `e` / `s` / `l` / `t`. Null otherwise. */
export function decodeTypes(text: unknown, cells: number): TileType[] | null {
  if (typeof text !== 'string' || text.length !== cells) return null;
  const out: TileType[] = [];
  for (let i = 0; i < text.length; i++) {
    const type = TYPE_OF_CODE[text[i]!];
    if (type === undefined) return null;
    out.push(type);
  }
  return out;
}

/** Orientations as one digit per cell. */
export function encodeOrientations(orientations: readonly number[]): string {
  return orientations.join('');
}

/** Decodes orientations: one digit per cell, each inside its type's period. Null otherwise. */
export function decodeOrientations(text: unknown, types: readonly TileType[]): number[] | null {
  if (typeof text !== 'string' || text.length !== types.length) return null;
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const digit = text.charCodeAt(i) - 48;
    if (!isValidOrientation(types[i]!, digit)) return null;
    out.push(digit);
  }
  return out;
}

export interface DecodedParts {
  readonly board: Board;
  readonly solution: number[];
  readonly initial: number[];
  readonly current: number[];
}

/**
 * The board parts of one record, read together (§7). Null when any part
 * fails: the size is not a board, the types do not decode, the source is
 * off the board, any orientation is outside its tile's period, or the
 * answer is not a solved arrangement — which is also what proves the types
 * are the answer's own (a spanning tree of degree ≤ 3, no pipe into the
 * edge, no cross). Whether the current orientations are already solved is
 * the caller's to decide.
 */
export function decodeParts(
  parts: {
    readonly types: unknown;
    readonly source: unknown;
    readonly solution: unknown;
    readonly initial: unknown;
    readonly current: unknown;
  },
  width: number,
  height: number,
): DecodedParts | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null;
  const types = decodeTypes(parts.types, width * height);
  if (types === null) return null;
  const source = parts.source;
  if (typeof source !== 'number') return null;
  const shape = { width, height, types, source };
  if (!isValidBoard(shape)) return null;
  const board = createBoard(width, height, types, source);
  const solution = decodeOrientations(parts.solution, types);
  if (solution === null || !isSolved(board, solution)) return null;
  const initial = decodeOrientations(parts.initial, types);
  if (initial === null) return null;
  const current = decodeOrientations(parts.current, types);
  if (current === null) return null;
  return { board, solution, initial, current };
}
