/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/BRIDGES_RULES.md §10).
 *
 * The board is one character per cell, row-major: `.` is water and `1`–`8`
 * an island with that number — a 10×10 board is 100 characters. Bridges are
 * one digit per edge, `0`–`2`, in the graph's edge order (engine.ts): the
 * edges are a function of the board alone, so the board is what gives the
 * digits their meaning.
 *
 * Decoding fails closed, and closed means more than "the characters parse".
 * A board survives only if it is one the rules can be read against (§1); an
 * answer only if it keeps every rule of §3 on that board; the player's
 * bridges only if the board could hold them (§2 — no crossing). A save that
 * fails any of these did not come from this game, and the caller drops it.
 */
import { buildGraph, isSolved, isValidBridges, isValidLayout, type Graph } from './engine';
import { MAX_ISLAND_VALUE, type Bridges, type Island, type Layout } from './types';

const WATER = '.';

/** Encodes a layout as one character per cell. */
export function encodeBoard(layout: Layout): string {
  const cells = new Array<string>(layout.width * layout.height).fill(WATER);
  for (const island of layout.islands) cells[island.index] = String(island.value);
  return cells.join('');
}

/**
 * Decodes a board. Null unless it has exactly width × height characters,
 * each water or a number 1–8, and the islands make a legal layout (§1): no
 * two side by side, at least two of them, and none asking for more than its
 * edges can carry.
 */
export function decodeBoard(text: unknown, width: number, height: number): Layout | null {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (typeof text !== 'string' || text.length !== width * height) return null;
  const islands: Island[] = [];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === WATER) continue;
    const value = text.charCodeAt(index) - 48;
    if (value < 1 || value > MAX_ISLAND_VALUE) return null;
    islands.push({ index, value });
  }
  const layout: Layout = { width, height, islands };
  return isValidLayout(layout) ? layout : null;
}

/** Encodes bridges per edge — an answer or a player's board — as one digit each. */
export function encodeBridges(bridges: Bridges): string {
  return bridges.join('');
}

function decodeDigits(text: unknown, graph: Graph): number[] | null {
  if (typeof text !== 'string' || text.length !== graph.edges.length) return null;
  const out: number[] = [];
  for (let at = 0; at < text.length; at++) {
    const count = text.charCodeAt(at) - 48;
    if (count < 0 || count > 2) return null;
    out.push(count);
  }
  return out;
}

/** Decodes a persisted answer. Null unless it is a win on the board (§3). */
export function decodeSolution(text: unknown, graph: Graph): number[] | null {
  const bridges = decodeDigits(text, graph);
  return bridges !== null && isSolved(graph, bridges) ? bridges : null;
}

/**
 * Decodes the player's bridges. Null unless the board could hold them (§2):
 * 0–2 per edge, and no two crossing edges both built. An island over its
 * number is a board play produces (§4) and survives.
 */
export function decodeBridges(text: unknown, graph: Graph): number[] | null {
  const bridges = decodeDigits(text, graph);
  return bridges !== null && isValidBridges(graph, bridges) ? bridges : null;
}

export interface DecodedBoards {
  readonly layout: Layout;
  readonly graph: Graph;
  readonly solution: number[];
  readonly bridges: number[];
}

/**
 * The three parts of one saved game, read together. Null when any part
 * fails, so a caller has one call to make and one thing to check.
 */
export function decodeBoards(
  parts: { board: unknown; solution: unknown; bridges: unknown },
  width: number,
  height: number,
): DecodedBoards | null {
  const layout = decodeBoard(parts.board, width, height);
  if (layout === null) return null;
  const graph = buildGraph(layout);
  const solution = decodeSolution(parts.solution, graph);
  if (solution === null) return null;
  const bridges = decodeBridges(parts.bridges, graph);
  return bridges === null ? null : { layout, graph, solution, bridges };
}
