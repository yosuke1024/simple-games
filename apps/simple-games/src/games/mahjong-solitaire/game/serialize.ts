/**
 * Persistence encoding — implements docs/MAHJONG_SOLITAIRE_RULES.md §10.
 *
 * A save holds identity and the ORDER of removals, nothing else. Faces are
 * rebuilt from (layout, seed), both derived from the identity, so a stored
 * record cannot even express a swapped face, an over-stock board, or a board
 * that disagrees with its level — those mistakes have no encoding.
 *
 * The one thing left to verify is the removal order itself, and that is done
 * by REPLAY, not by local inspection: apply the pairs to the full board and
 * demand that each pair was free and matching at its own moment. A set of
 * removed positions could satisfy every count and parity while encoding a
 * removal that was impossible at the time (a buried tile out from under its
 * cover); an order makes the check an O(n) replay instead of a search, and
 * makes fail-closed exact rather than approximate.
 *
 * Pairs are stored as coordinate sextuples [x1,y1,z1,x2,y2,z2] — coordinates
 * are the stable identity of a position, where a bare index would silently
 * re-target if the layout data were ever reordered.
 */
import { isFreeTile, relationsOf } from './freeState';
import type { Layout } from './layouts';
import { facesMatch, type TileFace } from './types';

/** One persisted removal: the coordinates of both tiles of the pair. */
export type PersistedPair = readonly [number, number, number, number, number, number];

export function encodeRemovals(
  layout: Layout,
  pairs: ReadonlyArray<readonly [number, number]>,
): PersistedPair[] {
  return pairs.map(([a, b]) => {
    const ta = layout.tiles[a]!;
    const tb = layout.tiles[b]!;
    return [ta.x, ta.y, ta.z, tb.x, tb.y, tb.z] as const;
  });
}

const coordKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

function indexByCoord(layout: Layout): Map<string, number> {
  const map = new Map<string, number>();
  layout.tiles.forEach((tile, index) => map.set(coordKey(tile.x, tile.y, tile.z), index));
  return map;
}

/**
 * Replays a persisted removal order against the freshly generated board.
 * Returns the same order as index pairs, or null when any step could not
 * have happened — a coordinate outside the layout, a tile removed twice,
 * a tile that was not free at its moment, or a pair that does not match.
 * One bad step discards the whole record (fail-closed, §10).
 */
export function replayRemovals(
  layout: Layout,
  faces: readonly TileFace[],
  pairs: readonly PersistedPair[],
): [number, number][] | null {
  if (pairs.length * 2 > layout.tiles.length) return null;
  const byCoord = indexByCoord(layout);
  const relations = relationsOf(layout);
  const removed: boolean[] = new Array<boolean>(layout.tiles.length).fill(false);
  const order: [number, number][] = [];
  for (const pair of pairs) {
    const a = byCoord.get(coordKey(pair[0], pair[1], pair[2]));
    const b = byCoord.get(coordKey(pair[3], pair[4], pair[5]));
    if (a === undefined || b === undefined || a === b) return null;
    if (removed[a] || removed[b]) return null;
    if (!isFreeTile(a, removed, relations) || !isFreeTile(b, removed, relations)) return null;
    if (!facesMatch(faces[a]!, faces[b]!)) return null;
    removed[a] = true;
    removed[b] = true;
    order.push([a, b]);
  }
  return order;
}
