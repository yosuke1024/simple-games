/**
 * The layout guarantee (docs/MAHJONG_SOLITAIRE_RULES.md §1, §5): every
 * shipped layout is geometrically sound AND completely peelable, and its
 * bundled witness order actually peels it. This is the proof the generator's
 * no-retry design leans on — a layout that fails here is a defect of the
 * layout data and must be fixed or dropped, never worked around at runtime.
 */
import { describe, expect, it } from 'vitest';
import { isFreeTile, relationsOf } from './freeState';
import { DAILY_PARAMS, LAYOUTS, LAYOUT_IDS, MAX_LEVEL, levelParams, type Layout } from './layouts';
import { createRng } from './rng';

/** Replays a flattened pair order; true when it removes every tile legally. */
function peelsCompletely(layout: Layout, order: readonly number[]): boolean {
  if (order.length !== layout.tiles.length) return false;
  const relations = relationsOf(layout);
  const removed: boolean[] = new Array<boolean>(layout.tiles.length).fill(false);
  for (let k = 0; k + 1 < order.length; k += 2) {
    const a = order[k]!;
    const b = order[k + 1]!;
    if (a === b || removed[a] || removed[b]) return false;
    if (!isFreeTile(a, removed, relations)) return false;
    if (!isFreeTile(b, removed, relations)) return false;
    removed[a] = true;
    removed[b] = true;
  }
  return removed.every(Boolean);
}

/** A fresh backtracking peel — the independent proof, not the bundled data. */
function provePeelable(layout: Layout): boolean {
  const relations = relationsOf(layout);
  const count = layout.tiles.length;
  const rng = createRng(`${layout.id}:proof`);
  const removed: boolean[] = new Array<boolean>(count).fill(false);
  let nodes = 0;
  const step = (remaining: number): boolean => {
    if (remaining === 0) return true;
    if (nodes > 5_000_000) return false;
    const free: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!removed[i] && isFreeTile(i, removed, relations)) free.push(i);
    }
    if (free.length < 2) return false;
    const picks = [...free];
    for (let i = picks.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [picks[i], picks[j]] = [picks[j]!, picks[i]!];
    }
    for (let a = 0; a < picks.length; a++) {
      for (let b = a + 1; b < picks.length; b++) {
        nodes++;
        removed[picks[a]!] = removed[picks[b]!] = true;
        if (step(remaining - 2)) return true;
        removed[picks[a]!] = removed[picks[b]!] = false;
      }
    }
    return false;
  };
  return step(count);
}

describe.each(LAYOUT_IDS)('layout %s', (id) => {
  const layout = LAYOUTS[id];

  it('has an even tile count and stays inside the portrait window', () => {
    expect(layout.tiles.length % 2).toBe(0);
    const xs = layout.tiles.map((t) => t.x);
    const ys = layout.tiles.map((t) => t.y);
    // 8 columns measured readable at 320px; 9 was the plan's ceiling (§12).
    expect((Math.max(...xs) - Math.min(...xs) + 2) / 2).toBeLessThanOrEqual(9);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0);
  });

  it('never overlaps two tiles on one layer', () => {
    for (let i = 0; i < layout.tiles.length; i++) {
      for (let j = i + 1; j < layout.tiles.length; j++) {
        const a = layout.tiles[i]!;
        const b = layout.tiles[j]!;
        const collides = a.z === b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
        expect(collides, `tiles ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  it('rests every raised tile on at least one tile below', () => {
    for (const tile of layout.tiles) {
      if (tile.z === 0) continue;
      const supported = layout.tiles.some(
        (under) =>
          under.z === tile.z - 1 &&
          Math.abs(under.x - tile.x) < 2 &&
          Math.abs(under.y - tile.y) < 2,
      );
      expect(supported, `tile at ${tile.x},${tile.y},${tile.z} floats`).toBe(true);
    }
  });

  it('is peelable — proven by a fresh search, not assumed', () => {
    expect(provePeelable(layout)).toBe(true);
  });

  it('ships a witness order that actually peels it', () => {
    expect(peelsCompletely(layout, layout.witness)).toBe(true);
  });
});

describe('the level table (§6)', () => {
  it('covers levels 1..100 without gaps and deals even, in-stock mixes', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const params = levelParams(level);
      const layout = LAYOUTS[params.layoutId];
      expect(params.quads * 4 + params.twins * 2 + params.flowers + params.seasons).toBe(
        layout.tiles.length,
      );
      expect(params.quads + params.twins).toBeLessThanOrEqual(34);
      expect([0, 2, 4]).toContain(params.flowers);
      expect([0, 2, 4]).toContain(params.seasons);
    }
  });

  it('tightens monotonically: tile counts never shrink as levels rise', () => {
    let last = 0;
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const count = LAYOUTS[levelParams(level).layoutId].tiles.length;
      expect(count).toBeGreaterThanOrEqual(last);
      last = count;
    }
  });

  it('ends on the flagship, which is also the daily: the 144-tile turtle', () => {
    expect(levelParams(MAX_LEVEL).layoutId).toBe('turtle');
    expect(DAILY_PARAMS.layoutId).toBe('turtle');
    expect(LAYOUTS.turtle.tiles).toHaveLength(144);
    // The standard set, exactly: 34 ordinary faces × 4 + 4 flowers + 4 seasons.
    expect(DAILY_PARAMS.quads).toBe(34);
    expect(DAILY_PARAMS.twins).toBe(0);
    expect(DAILY_PARAMS.flowers).toBe(4);
    expect(DAILY_PARAMS.seasons).toBe(4);
  });
});
