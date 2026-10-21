/**
 * The pieces and the 45° group (docs/TANGRAM_RULES.md §5「駒」「姿」, §13).
 */
import { describe, expect, it } from 'vitest';
import { doubledArea } from './geometry';
import {
  canFlip,
  LOCAL_SHAPES,
  mirror,
  orient,
  PIECE_AREA,
  PIECE_IDS,
  poseVertices,
  turn,
  turnChecked,
  unorientChecked,
  type PieceId,
} from './pieces';
import { isTurnLattice, ptKey, ptSub, ptToFloat, type Pt } from './z2';

const shapeKey = (vertices: readonly Pt[]): string => {
  // Translate so the lexicographically smallest float point is at the origin, then sort.
  const sorted = [...vertices].sort((a, b) => {
    const [ax, ay] = ptToFloat(a);
    const [bx, by] = ptToFloat(b);
    return ax - bx || ay - by;
  });
  const base = sorted[0]!;
  return sorted
    .map((v) => ptKey(ptSub(v, base)))
    .sort()
    .join(' ');
};

describe('the seven pieces (§5 の表)', () => {
  it('are the traditional set, with areas 8 8 4 4 4 2 2 summing to 32', () => {
    expect(PIECE_IDS).toEqual(['L1', 'L2', 'M', 'P', 'SQ', 'S1', 'S2']);
    for (const id of PIECE_IDS) {
      expect(doubledArea(LOCAL_SHAPES[id]), id).toEqual([2 * PIECE_AREA[id], 0]);
    }
    expect(PIECE_IDS.reduce((sum, id) => sum + PIECE_AREA[id], 0)).toBe(32);
  });

  it('lists every local shape clockwise on screen from vertex 0 at the origin', () => {
    for (const id of PIECE_IDS) {
      expect(LOCAL_SHAPES[id][0], id).toEqual([0, 0, 0, 0]);
      expect(doubledArea(LOCAL_SHAPES[id])[0], id).toBeGreaterThan(0);
    }
  });

  it('puts every local vertex on the lattice the turn keeps exact', () => {
    for (const id of PIECE_IDS) {
      for (const v of LOCAL_SHAPES[id]) expect(isTurnLattice(v), `${id} ${ptKey(v)}`).toBe(true);
    }
  });

  it('lets only the parallelogram flip (§1)', () => {
    expect(PIECE_IDS.filter(canFlip)).toEqual(['P']);
  });
});

describe('the 45° turn and the mirror (§5「姿」)', () => {
  it('turns 45° clockwise on screen, and R² is (x, y) → (−y, x)', () => {
    expect(turn([2, 0, 0, 0], 1)).toEqual([0, 1, 0, 1]); // (2, 0) → (√2, √2)
    expect(turn([2, 0, 0, 0], 2)).toEqual([0, 0, 2, 0]); // (2, 0) → (0, 2): down the screen
    expect(turn([0, 1, 0, 1], 1)).toEqual([0, 0, 2, 0]);
  });

  it('comes back after eight turns and after two mirrors, for every vertex of every piece', () => {
    for (const id of PIECE_IDS) {
      for (const v of LOCAL_SHAPES[id]) {
        let q = v;
        for (let k = 0; k < 8; k++) {
          const next = turnChecked(q, 1);
          expect(next, `${id} turn ${k}`).not.toBeNull();
          q = next!;
          expect(isTurnLattice(q)).toBe(true);
        }
        expect(ptKey(q)).toBe(ptKey(v));
        expect(ptKey(mirror(mirror(v)))).toBe(ptKey(v));
      }
    }
  });

  it('keeps every vertex in Z[√2] in all sixteen orientations', () => {
    for (const id of PIECE_IDS) {
      for (const f of [0, 1] as const) {
        for (let r = 0; r < 8; r++) {
          for (const v of poseVertices(id, { r, f, at: [0, 0, 0, 0] })) {
            expect(v.every(Number.isInteger)).toBe(true);
          }
        }
      }
    }
  });

  it('undoes an orientation exactly', () => {
    for (const id of PIECE_IDS) {
      for (const f of [0, 1] as const) {
        for (let r = 0; r < 8; r++) {
          for (const v of LOCAL_SHAPES[id]) {
            expect(unorientChecked(orient(v, { r, f }), { r, f })).toEqual(v);
          }
        }
      }
    }
  });

  it('refuses an odd turn of a point whose rational parts differ in parity', () => {
    expect(turnChecked([1, 0, 0, 0], 1)).toBeNull();
    expect(turnChecked([1, 0, 0, 0], 2)).toEqual([0, 0, 1, 0]);
  });

  it('makes the mirror image of every piece but the parallelogram a turn of it', () => {
    const shapesOf = (id: PieceId, f: 0 | 1) =>
      new Set(
        Array.from({ length: 8 }, (_, r) => shapeKey(poseVertices(id, { r, f, at: [0, 0, 0, 0] }))),
      );
    for (const id of PIECE_IDS) {
      const unflipped = shapesOf(id, 0);
      const flipped = shapesOf(id, 1);
      const sameSet = [...flipped].every((key) => unflipped.has(key));
      expect(sameSet, id).toBe(id !== 'P');
    }
    // The parallelogram has eight distinct shapes in all: four turns × two sides
    // (a half turn maps it onto itself); the square has two.
    const all = new Set([...shapesOf('P', 0), ...shapesOf('P', 1)]);
    expect(all.size).toBe(8);
    expect(shapesOf('SQ', 0).size).toBe(2);
    expect(shapesOf('L1', 0).size).toBe(8);
  });
});
