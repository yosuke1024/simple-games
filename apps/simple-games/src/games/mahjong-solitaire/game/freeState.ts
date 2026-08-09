/**
 * Which tiles can be taken (docs/MAHJONG_SOLITAIRE_RULES.md §2): a tile is
 * free when nothing rests on it and at least one of its sides is open.
 *
 * The relations between positions never change during a game — only the
 * removed set does — so they are computed once per layout and reused by the
 * session, the generator and the save-replay validator alike. One shared
 * definition is what keeps "free" meaning the same thing in all three places.
 */
import type { Layout } from './layouts';

export interface LayoutRelations {
  /** covers[i]: indices of tiles resting on top of tile i. */
  readonly covers: ReadonlyArray<readonly number[]>;
  /** lefts[i] / rights[i]: indices touching tile i on that side, same layer. */
  readonly lefts: ReadonlyArray<readonly number[]>;
  readonly rights: ReadonlyArray<readonly number[]>;
}

const relationCache = new WeakMap<Layout, LayoutRelations>();

export function relationsOf(layout: Layout): LayoutRelations {
  const cached = relationCache.get(layout);
  if (cached) return cached;
  const tiles = layout.tiles;
  const covers = tiles.map(() => [] as number[]);
  const lefts = tiles.map(() => [] as number[]);
  const rights = tiles.map(() => [] as number[]);
  for (let i = 0; i < tiles.length; i++) {
    const a = tiles[i]!;
    for (let j = 0; j < tiles.length; j++) {
      if (i === j) continue;
      const b = tiles[j]!;
      if (b.z === a.z + 1 && Math.abs(b.x - a.x) < 2 && Math.abs(b.y - a.y) < 2) {
        covers[i]!.push(j);
      }
      if (b.z === a.z && Math.abs(b.y - a.y) < 2) {
        if (b.x === a.x - 2) lefts[i]!.push(j);
        if (b.x === a.x + 2) rights[i]!.push(j);
      }
    }
  }
  const relations: LayoutRelations = { covers, lefts, rights };
  relationCache.set(layout, relations);
  return relations;
}

/** Whether tile i can be taken right now (§2). */
export function isFreeTile(
  index: number,
  removed: readonly boolean[],
  relations: LayoutRelations,
): boolean {
  if (relations.covers[index]!.some((j) => !removed[j])) return false;
  const left = relations.lefts[index]!.some((j) => !removed[j]);
  const right = relations.rights[index]!.some((j) => !removed[j]);
  return !(left && right);
}

/** All currently free tile indices, ascending. */
export function freeTiles(layout: Layout, removed: readonly boolean[]): number[] {
  const relations = relationsOf(layout);
  const out: number[] = [];
  for (let i = 0; i < layout.tiles.length; i++) {
    if (!removed[i] && isFreeTile(i, removed, relations)) out.push(i);
  }
  return out;
}
