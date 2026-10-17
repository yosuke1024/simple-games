/**
 * What one tap on an island means, and where an arrow key moves the focus —
 * the two input rules of docs/BRIDGES_RULES.md §4, kept out of React so they
 * can be read and tested on their own.
 *
 * The board only reports "this island was tapped"; the meaning depends on
 * what is selected, so it is decided here:
 *
 * - nothing selected → the island becomes the selection;
 * - the selected island again → the selection is cleared;
 * - a partner of the selected island (in sight, the way not blocked by a
 *   crossing bridge — `candidatesFor`) → one step of 0 → 1 → 2 → 0 on that
 *   pair, and the selection stays where it was;
 * - any other island — out of sight, or behind a crossing bridge → the
 *   selection moves to it. Nothing is built and nothing complains.
 */
import {
  candidatesFor,
  colOf,
  edgeInDirection,
  otherEnd,
  rowOf,
  type BridgesSession,
  type Direction,
} from '../game';

export type TapOutcome =
  | { readonly kind: 'select'; readonly island: number }
  | { readonly kind: 'deselect' }
  | { readonly kind: 'connect'; readonly from: number; readonly to: number };

/** Whether `to` is one of the islands `from` can be joined to right now (§4). */
export const isPartner = (session: BridgesSession, from: number, to: number): boolean =>
  from !== to && candidatesFor(session, from).some((candidate) => candidate.island === to);

export function tapOutcome(
  session: BridgesSession,
  selected: number | null,
  island: number,
): TapOutcome {
  if (selected === null) return { kind: 'select', island };
  if (selected === island) return { kind: 'deselect' };
  if (isPartner(session, selected, island)) return { kind: 'connect', from: selected, to: island };
  return { kind: 'select', island };
}

/** The arrow keys, by the direction each one moves the focus. */
export const ARROW_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * The island an arrow key moves the focus to (§4), or null when nothing lies
 * that way.
 *
 * First the island in sight in that direction — the partner a bridge that way
 * would join, even when a crossing bridge blocks it — so "select, arrow,
 * Enter" builds the bridge in the direction pressed. When nothing is in sight
 * that way, the nearest island anywhere on that side of the board, so every
 * island can be reached from every other: distance along the arrow plus twice
 * the distance across it, ties to the smaller sideways step and then the
 * island earlier on the board.
 */
export function islandToward(
  session: BridgesSession,
  from: number,
  direction: Direction,
): number | null {
  const { graph, islands, width } = session;
  const edge = edgeInDirection(graph, from, direction);
  if (edge !== -1) return otherEnd(graph.edges[edge]!, from);

  const origin = islands[from];
  if (origin === undefined) return null;
  const row = rowOf(origin.index, width);
  const col = colOf(origin.index, width);
  let best: number | null = null;
  let bestScore = Infinity;
  let bestSide = Infinity;
  islands.forEach((island, ordinal) => {
    if (ordinal === from) return;
    const dRow = rowOf(island.index, width) - row;
    const dCol = colOf(island.index, width) - col;
    const along =
      direction === 'up'
        ? -dRow
        : direction === 'down'
          ? dRow
          : direction === 'left'
            ? -dCol
            : dCol;
    if (along <= 0) return;
    const side = Math.abs(direction === 'up' || direction === 'down' ? dCol : dRow);
    const score = along + 2 * side;
    if (score < bestScore || (score === bestScore && side < bestSide)) {
      best = ordinal;
      bestScore = score;
      bestSide = side;
    }
  });
  return best;
}
