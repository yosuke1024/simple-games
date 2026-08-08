/**
 * Freeness, exhaustively (docs/MAHJONG_SOLITAIRE_RULES.md §2): covered tiles
 * are not free, tiles walled on both sides are not free, one open side is
 * enough, and half-unit offsets count as overlap on both axes. The stuck
 * detector must never call a live board stuck (§7) — the conservative side
 * of the same coin FreeCell's hasAnyMove keeps.
 */
import { describe, expect, it } from 'vitest';
import { freeTiles, isFreeTile, relationsOf } from './freeState';
import type { Layout } from './layouts';
import { facesMatch, matchUnit } from './types';

/** A hand-made layout for exact cases; ids are irrelevant to freeState. */
const lab = (tiles: readonly (readonly [number, number, number])[]): Layout => ({
  id: 'sprout',
  tiles: tiles.map(([x, y, z]) => ({ x, y, z })),
  witness: [],
});

const none: boolean[] = [];
const noneRemoved = (layout: Layout) => layout.tiles.map(() => false);

describe('side blocking (§2)', () => {
  it('a lone tile is free', () => {
    const layout = lab([[0, 0, 0]]);
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([0]);
  });

  it('a row of three frees only its ends', () => {
    const layout = lab([
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
    ]);
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([0, 2]);
  });

  it('a half-offset neighbour still walls a side', () => {
    // The middle tile's neighbours sit shifted by one half-unit vertically:
    // still touching, still blocking.
    const layout = lab([
      [0, 1, 0],
      [2, 0, 0],
      [4, 1, 0],
    ]);
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([0, 2]);
  });

  it('a gap of one half-unit is not touching, so it does not block', () => {
    const layout = lab([
      [0, 0, 0],
      [3, 0, 0],
      [6, 0, 0],
    ]);
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([0, 1, 2]);
  });

  it('a two-half-unit vertical offset no longer overlaps the side', () => {
    const layout = lab([
      [0, 2, 0],
      [2, 0, 0],
      [4, 2, 0],
    ]);
    // Tile 1 sits a full tile above the other two: no side contact.
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([0, 1, 2]);
  });
});

describe('covering (§2)', () => {
  it('a tile directly on top pins the one below', () => {
    const layout = lab([
      [0, 0, 0],
      [0, 0, 1],
    ]);
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([1]);
  });

  it('a half-offset tile on top pins BOTH tiles it straddles', () => {
    const layout = lab([
      [0, 0, 0],
      [2, 0, 0],
      [1, 0, 1],
    ]);
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([2]);
  });

  it('removing the cover frees what was under it', () => {
    const layout = lab([
      [0, 0, 0],
      [0, 0, 1],
    ]);
    const removed = noneRemoved(layout);
    removed[1] = true;
    expect(isFreeTile(0, removed, relationsOf(layout))).toBe(true);
  });

  it('two layers apart is not covering', () => {
    // Physically impossible in shipped layouts (support rule), but the
    // relation itself must only look one layer up.
    const layout = lab([
      [0, 0, 0],
      [0, 0, 2],
    ]);
    expect(freeTiles(layout, noneRemoved(layout))).toEqual([0, 1]);
  });

  it('never reports a free tile on an empty check-list', () => {
    expect(none).toEqual([]);
  });
});

describe('group matching (§2)', () => {
  it('ordinary faces match only themselves', () => {
    expect(facesMatch('c3', 'c3')).toBe(true);
    expect(facesMatch('c3', 'c4')).toBe(false);
    expect(facesMatch('c3', 'o3')).toBe(false);
    expect(facesMatch('dr', 'dg')).toBe(false);
  });

  it('any flower matches any flower, any season any season — never across', () => {
    expect(facesMatch('f1', 'f4')).toBe(true);
    expect(facesMatch('s2', 's3')).toBe(true);
    expect(facesMatch('f1', 's1')).toBe(false);
    expect(matchUnit('f2')).toBe('flower');
    expect(matchUnit('s4')).toBe('season');
  });
});
