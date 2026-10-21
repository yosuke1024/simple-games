/**
 * Snapping and turning about the pivot (docs/TANGRAM_RULES.md §5「吸着」
 * 「盤の上の回転と裏返し」, §13).
 */
import { describe, expect, it } from 'vitest';
import { figureById } from './catalog';
import { poseVertices } from './pieces';
import {
  isPlaceable,
  isValidPivot,
  rankCandidates,
  SNAP_CHECK_LIMIT,
  SNAP_EPS,
  snapPose,
  turnAbout,
  type BoardPieces,
  type Placement,
  type SnapQuery,
} from './snap';
import { atVertex0, ip } from './test-helpers';
import { ptKey, type Pt } from './z2';

const square = figureById('square')!;
const big: Pt[] = [ip(0, 0), ip(12, 0), ip(12, 12), ip(0, 12)];
const q = (query: Partial<SnapQuery> & Pick<SnapQuery, 'id' | 'at' | 'tolerance'>): SnapQuery => ({
  orientation: { r: 0, f: 0 },
  ...query,
});
const keyOf = (p: Placement | null) =>
  p ? `${p.r}/${p.f} at ${ptKey(p.at)} pv ${ptKey(p.pv)}` : 'none';

describe('vertex snap (§5)', () => {
  it('snaps a corner onto a silhouette corner within the tolerance, and not beyond it', () => {
    const near = snapPose(square.outline, {}, q({ id: 'S1', at: [0.3, 0.2], tolerance: 0.5 }));
    expect(keyOf(near.placement)).toBe('0/0 at 0,0,0,0 pv 0,0,0,0');
    expect(near.target).toBe('outline-vertex');
    expect(near.via).toBe('vertex');
    const far = snapPose(square.outline, {}, q({ id: 'S1', at: [0.3, 0.2], tolerance: 0.3 }));
    expect(far.placement).toBeNull();
    expect(far.exhausted).toBe(false);
  });

  it('includes a candidate exactly at the tolerance (the keyboard’s 1 unit)', () => {
    const exact = snapPose(square.outline, {}, q({ id: 'S1', at: [1, 0], tolerance: 1 }));
    expect(keyOf(exact.placement)).toBe('0/0 at 0,0,0,0 pv 0,0,0,0');
    // A distance that is 1 only after rounding: (√2 − 1)·(1 + √2) = 1.
    const rounded = snapPose(
      square.outline,
      {},
      q({ id: 'S1', at: [0, (Math.SQRT2 - 1) * (1 + Math.SQRT2)], tolerance: 1 }),
    );
    expect(rounded.via).toBe('vertex');
  });

  it('snaps to another placed piece’s corner, fixed pieces included', () => {
    const board: BoardPieces = { SQ: atVertex0({ r: 0, f: 0, at: ip(2, 2) }) };
    const out = snapPose(big, board, q({ id: 'S1', at: [4.2, 1.9], tolerance: 0.5 }));
    expect(keyOf(out.placement)).toBe('0/0 at 4,0,2,0 pv 4,0,2,0');
    expect(out.target).toBe('piece-vertex');
  });

  it('takes the nearest candidate that can be placed, skipping one that overlaps', () => {
    const board: BoardPieces = { SQ: atVertex0({ r: 0, f: 0, at: ip(0, 0) }) };
    const out = snapPose(big, board, q({ id: 'S1', at: [0.2, 0.3], tolerance: 2 }));
    // Nearest: S1 at (0, 0) — inside SQ. Next: corner 0 onto (0, 2) and corner 1 onto
    // (2, 2), the same pose at the same distance: the lower corner number wins the pivot.
    expect(keyOf(out.placement)).toBe('0/0 at 0,0,2,0 pv 0,0,2,0');
    expect(out.checks).toBe(2);
  });

  it('never snaps a piece onto its own board placement', () => {
    const board: BoardPieces = { S1: atVertex0({ r: 0, f: 0, at: ip(4, 4) }) };
    const out = snapPose(big, board, q({ id: 'S1', at: [4, 4], tolerance: 0.1 }));
    expect(out.placement).toBeNull();
  });
});

describe('edge snap (§5)', () => {
  it('runs only when no vertex candidate can be placed, and lands on a tick, not the nearest point', () => {
    // Corner 0 one unit along the top edge: no corner within 0.999 …
    const out = snapPose(square.outline, {}, q({ id: 'S1', at: [1, 0], tolerance: 0.999 }));
    expect(out.via).toBe('edge');
    expect(out.target).toBe('outline-edge');
    // … so it snaps to the tick 4√2 − 2√2 − … = 2√2 − 2 ≈ 0.83 from the corner, exactly.
    expect(keyOf(out.placement)).toBe('0/0 at -2,2,0,0 pv -2,2,0,0');
    // The same wish with room for the corner takes the corner, though the tick is nearer.
    const vertexFirst = snapPose(square.outline, {}, q({ id: 'S1', at: [1, 0], tolerance: 1.2 }));
    expect(vertexFirst.via).toBe('vertex');
    expect(keyOf(vertexFirst.placement)).toBe('0/0 at 0,0,0,0 pv 0,0,0,0');
  });

  it('puts a target corner onto a tick of the carried piece’s own edge (b)', () => {
    // SQ stands at (6, 0)–(8, 2). L1 (legs along +x and +y from corner 0) is wished just
    // under it, its top leg along y = 2: no corner of either is near a corner of the other,
    // but SQ's corner (6, 2) is near the tick 2√2 along L1's top leg.
    const board: BoardPieces = { SQ: atVertex0({ r: 0, f: 0, at: ip(6, 0) }) };
    const wish: [number, number] = [6 - 2 * Math.SQRT2 + 0.1, 2.2];
    const out = snapPose(big, board, q({ id: 'L1', at: wish, tolerance: 0.5 }));
    expect(out.via).toBe('edge');
    expect(out.target).toBe('piece-vertex');
    expect(keyOf(out.placement)).toBe('0/0 at 6,-2,2,0 pv 6,0,2,0');
    // The pivot is SQ's corner, which is a tick of L1's edge — a lawful pivot.
    expect(isValidPivot('L1', out.placement!)).toBe(true);
  });

  it('spends one budget across both phases (§5「仕事量の上限」)', () => {
    // Found by a seeded search and pinned: on `boat` with M, P and S1 at their solution
    // poses, the vertex phase has two candidates and both fail; the edge phase then
    // succeeds on the run's seventh check (the fifth of its own).
    const boat = figureById('boat')!;
    const board: BoardPieces = {
      M: atVertex0(boat.solution.M),
      P: atVertex0(boat.solution.P),
      S1: atVertex0(boat.solution.S1),
    };
    const query = q({
      id: 'S2',
      orientation: { r: 3, f: 0 },
      at: [5.098858833312988, 2.6638193130493164],
      tolerance: 0.978189942240715,
    });
    const full = snapPose(boat.outline, board, query);
    expect(full.via).toBe('edge');
    expect(full.target).toBe('outline-edge');
    expect(full.checks).toBe(7);
    expect(full.candidates).toBe(20);
    expect(full.exhausted).toBe(false);
    // Six checks: the vertex phase spends two, the edge phase gets only the remaining four
    // (not a fresh budget of six) and runs out one short of the answer.
    const six = snapPose(boat.outline, board, query, 6);
    expect(six.placement).toBeNull();
    expect(six.exhausted).toBe(true);
    expect(six.checks).toBe(6);
    // Two checks: the vertex phase spends both; the edge phase lists its candidates
    // (2 + 18 = 20) but has nothing left to check them with.
    const two = snapPose(boat.outline, board, query, 2);
    expect(two.placement).toBeNull();
    expect(two.exhausted).toBe(true);
    expect(two.checks).toBe(2);
    expect(two.candidates).toBe(20);
    // One check: the vertex phase runs out partway, and the edge phase is never entered —
    // its candidates are not even listed.
    const one = snapPose(boat.outline, board, query, 1);
    expect(one.placement).toBeNull();
    expect(one.exhausted).toBe(true);
    expect(one.checks).toBe(1);
    expect(one.candidates).toBe(2);
    expect(SNAP_CHECK_LIMIT).toBe(32);
  });
});

describe('ranking (§5「選び方」)', () => {
  it('treats squared distances within SNAP_EPS of a run’s first as one tie, in enumeration order', () => {
    const ranked = rankCandidates([
      { d2: 1 + SNAP_EPS / 2, seq: 0 },
      { d2: 1, seq: 1 },
      { d2: 1 + SNAP_EPS * 0.9, seq: 2 },
      { d2: 0.5, seq: 3 },
      { d2: 1 + 3 * SNAP_EPS, seq: 4 },
    ]);
    expect(ranked.map((c) => c.seq)).toEqual([3, 0, 1, 2, 4]);
  });

  it('chooses between mathematically equal distances by the fixed order, whatever the rounding', () => {
    // M (legs 2√2) wished at x = 6 − √2 on the top edge of `big`: corner 0 is 6 − √2
    // from (0, 0) and corner 1 is 6 − √2 from (12, 0) — equal in exact arithmetic, but
    // the float of the second squared distance comes out 7 × 10⁻¹⁵ smaller. Within
    // SNAP_EPS they tie, and corner 0 comes first in the order.
    const w = 6 - Math.SQRT2;
    const d0 = w * w;
    const d1 = (12 - (w + 2 * Math.SQRT2)) ** 2;
    expect(d0).not.toBe(d1);
    expect(Math.abs(d0 - d1)).toBeLessThan(SNAP_EPS);
    const out = snapPose(big, {}, q({ id: 'M', at: [w, 0], tolerance: 5 }));
    expect(keyOf(out.placement)).toBe('0/0 at 0,0,0,0 pv 0,0,0,0');
  });
});

describe('the pivot and turning about it (§5)', () => {
  // The pivot is a tick: 2 units along the top leg from corner 0.
  const placed: Placement = { r: 0, f: 0, at: ip(4, 4), pv: ip(6, 4) };

  it('turns eight times back to the same pose, the pivot never moving', () => {
    let p: Placement = placed;
    const seen = new Set<string>();
    for (let k = 0; k < 8; k++) {
      p = turnAbout(p, { r: (p.r + 1) % 8, f: 0 })!;
      expect(p.pv).toEqual(placed.pv);
      expect(isValidPivot('L1', p)).toBe(true);
      expect(poseVertices('L1', p).every((v) => v.every(Number.isInteger))).toBe(true);
      seen.add(keyOf(p));
    }
    expect(keyOf(p)).toBe(keyOf(placed));
    expect(seen.size).toBe(8);
  });

  it('flips the parallelogram about its pivot and back', () => {
    const p: Placement = { r: 2, f: 0, at: ip(6, 6), pv: [6, 0, 6, 0] };
    const flipped = turnAbout(p, { r: 2, f: 1 })!;
    expect(flipped.pv).toEqual(p.pv);
    expect(keyOf(turnAbout(flipped, { r: 2, f: 0 }))).toBe(keyOf(p));
  });

  it('accepts a corner or a tick as the pivot, and nothing else on the boundary', () => {
    expect(isValidPivot('L1', placed)).toBe(true);
    expect(isValidPivot('L1', { ...placed, pv: ip(4, 4) })).toBe(true); // corner 0
    expect(isValidPivot('L1', { ...placed, pv: ip(6, 6) })).toBe(true); // the hypotenuse's midpoint: 2√2 from both ends
    expect(isValidPivot('L1', { ...placed, pv: ip(5, 4) })).toBe(false); // 1 unit along a leg
    expect(isValidPivot('L1', { ...placed, pv: ip(9, 4) })).toBe(false); // off the piece
    // A pivot 1 unit along an axis edge cannot be turned exactly (the turn leaves Z[√2]).
    expect(turnAbout({ ...placed, pv: ip(5, 4) }, { r: 1, f: 0 })).toBeNull();
  });

  it('tells a placeable pose from one that leaves the silhouette or overlaps', () => {
    expect(isPlaceable(square.outline, {}, 'S1', { r: 0, f: 0, at: ip(0, 0) })).toBe(true);
    expect(isPlaceable(square.outline, {}, 'S1', { r: 4, f: 0, at: ip(0, 0) })).toBe(false);
    const board: BoardPieces = { S2: atVertex0({ r: 0, f: 0, at: ip(0, 0) }) };
    expect(isPlaceable(square.outline, board, 'S1', { r: 0, f: 0, at: ip(0, 0) })).toBe(false);
    expect(isPlaceable(square.outline, board, 'S2', { r: 0, f: 0, at: ip(0, 0) })).toBe(true);
    expect(isPlaceable(square.outline, {}, 'S1', { r: 0, f: 0, at: ip(258, 0) })).toBe(false);
  });
});
