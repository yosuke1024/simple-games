/**
 * Every bundled figure against every invariant of docs/TANGRAM_RULES.md §2,
 * checked from the outline and the solution independently of how either was
 * made (§2「v1 のカタログ」), and every solution played through the session's
 * own rules to completion. Also the daily's walk through Medium (§6), the
 * tiers' authoring rules (Easy convex; no outline edge shorter than a small
 * leg; each tier's vertex range — gated), and the per-tier shape numbers §13
 * reports (printed, not gated: no test measures difficulty).
 */
import { describe, expect, it } from 'vitest';
import {
  dailyFigure,
  DAILY_STRIDE,
  FIGURES,
  figureById,
  figureNumber,
  figuresOf,
  nextFigure,
  TIERS,
} from './catalog';
import { createSession, isCompleteBoard, placePiece } from './session';
import { boardOf } from './test-helpers';
import { addDays } from './test-dates';
import {
  convexInside,
  convexOverlap,
  directionOf,
  doubledArea,
  edgeLength,
  isReflexVertex,
  isSimplePolygon,
  isStraightVertex,
} from './geometry';
import { dayNumber } from './daily';
import { canFlip, orient, PIECE_IDS, poseVertices } from './pieces';
import { snapPose, type BoardPieces, type Placement } from './snap';
import {
  cmp,
  hasEvenRationalParts,
  isBoundedPoint,
  le,
  min,
  ptKey,
  ptSub,
  ptToFloat,
  ptX,
  ptY,
  type Pt,
} from './z2';

const xs = (outline: readonly Pt[]) => outline.map(ptX);
const ys = (outline: readonly Pt[]) => outline.map(ptY);
const minOf = (values: readonly (readonly [number, number])[]) =>
  values.reduce((a, b) => min(a, b));
const maxOf = (values: readonly (readonly [number, number])[]) =>
  values.reduce((a, b) => (cmp(a, b) < 0 ? b : a));

/** §2's vertex ranges by tier: the authoring rule the tiers were split by (gated). */
const TIER_VERTICES = { easy: [3, 6], medium: [6, 9], hard: [10, 13] } as const;

/** The outline moved so its box's top left is the origin, starting at its top-left-most vertex. */
function normalized(outline: readonly Pt[]): Pt[] {
  const shift: Pt = [...minOf(xs(outline)), ...minOf(ys(outline))] as unknown as Pt;
  let moved = outline.map((v) => ptSub(v, shift));
  if (cmp(doubledArea(moved), [0, 0]) < 0) moved = [...moved].reverse();
  let start = 0;
  moved.forEach((v, i) => {
    const s = moved[start]!;
    const dy = cmp(ptY(v), ptY(s));
    if (dy < 0 || (dy === 0 && cmp(ptX(v), ptX(s)) < 0)) start = i;
  });
  return [...moved.slice(start), ...moved.slice(0, start)];
}

/** One key for all sixteen images of an outline under 45° turns and the mirror (§2「重複なし」). */
function congruenceKey(outline: readonly Pt[]): string {
  const keys: string[] = [];
  for (const f of [0, 1] as const) {
    for (let r = 0; r < 8; r++) {
      keys.push(
        normalized(outline.map((v) => orient(v, { r, f })))
          .map(ptKey)
          .join(' '),
      );
    }
  }
  return keys.sort()[0]!;
}

describe('the catalog (§2)', () => {
  it('ships at least the minimum of the logic stage: 3 per tier', () => {
    for (const tier of TIERS) expect(figuresOf(tier).length, tier).toBeGreaterThanOrEqual(3);
    console.info(
      `catalog: easy ${figuresOf('easy').length}, medium ${figuresOf('medium').length}, ` +
        `hard ${figuresOf('hard').length} (${FIGURES.length} figures)`,
    );
  });

  it('starts Easy with the three Phase 0 silhouettes', () => {
    expect(
      figuresOf('easy')
        .slice(0, 3)
        .map((f) => f.id),
    ).toEqual(['square', 'triangle', 'parallelogram']);
  });

  it('gives every figure a unique, well-formed id, its own origin, and a tier', () => {
    const ids = FIGURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const figure of FIGURES) {
      expect(figure.id).toMatch(/^[a-z][a-z0-9-]{1,31}$/);
      expect(figure.origin).toBe('original');
      expect(TIERS).toContain(figure.tier);
      expect(figureById(figure.id)).toBe(figure);
    }
    expect(figureById('toString')).toBeNull();
    expect(figureById('__proto__')).toBeNull();
    expect(figureById(7)).toBeNull();
  });

  describe.each(FIGURES.map((figure) => [figure.id, figure] as const))('%s', (_, figure) => {
    const { outline } = figure;

    it('has a simple 8-direction outline of 3–32 vertices, no straight vertex, clockwise', () => {
      expect(outline.length).toBeGreaterThanOrEqual(3);
      expect(outline.length).toBeLessThanOrEqual(32);
      expect(isSimplePolygon(outline)).toBe(true);
      outline.forEach((v, i) => {
        expect(directionOf(v, outline[(i + 1) % outline.length]!), `edge ${i}`).not.toBeNull();
        expect(isStraightVertex(outline, i), `vertex ${i}`).toBe(false);
      });
      expect(cmp(doubledArea(outline), [0, 0])).toBe(1);
    });

    it('sits with its box at the origin and starts at its top-left-most vertex', () => {
      expect(minOf(xs(outline))).toEqual([0, 0]);
      expect(minOf(ys(outline))).toEqual([0, 0]);
      expect(normalized(outline)).toEqual(outline);
    });

    it('fits 13 × 13 units and has area exactly 32', () => {
      expect(le(maxOf(xs(outline)), [13, 0])).toBe(true);
      expect(le(maxOf(ys(outline)), [13, 0])).toBe(true);
      expect(doubledArea(outline)).toEqual([64, 0]);
    });

    it('keeps coordinates within 64 and rational parts even', () => {
      for (const v of outline) {
        expect(isBoundedPoint(v, 64)).toBe(true);
        expect(hasEvenRationalParts(v), ptKey(v)).toBe(true);
      }
      for (const id of PIECE_IDS) {
        expect(isBoundedPoint(figure.solution[id].at, 64)).toBe(true);
        expect(hasEvenRationalParts(figure.solution[id].at), id).toBe(true);
      }
    });

    it('holds a solution of the seven pieces, inside and not overlapping: the outline is their union', () => {
      expect(Object.keys(figure.solution).sort()).toEqual([...PIECE_IDS].sort());
      const polygons = PIECE_IDS.map((id) => {
        const pose = figure.solution[id];
        expect(Number.isInteger(pose.r) && pose.r >= 0 && pose.r < 8, id).toBe(true);
        expect(pose.f === 0 || (pose.f === 1 && canFlip(id)), id).toBe(true);
        return poseVertices(id, pose);
      });
      polygons.forEach((p, i) => expect(convexInside(p, outline), PIECE_IDS[i]).toBe(true));
      for (let i = 0; i < 7; i++) {
        for (let j = i + 1; j < 7; j++) {
          expect(convexOverlap(polygons[i]!, polygons[j]!), `${PIECE_IDS[i]} ${PIECE_IDS[j]}`).toBe(
            false,
          );
        }
      }
      // The union follows from this and the outline-area check above: seven pieces
      // inside and not overlapping cover 32 units², and the outline's area is exactly
      // 32, so nothing is left uncovered (§2, §5「完成」). The pieces' own areas do not
      // depend on the solution, so the sum below is only a sanity line. (A flipped
      // parallelogram runs counter-clockwise, hence the absolute value.)
      const total = polygons.reduce((sum, p) => sum + Math.abs(doubledArea(p)[0]), 0);
      expect(total).toBe(64);
    });

    it('is completed by its solution through the session’s rules (§1, §5「完成」)', () => {
      let session = createSession(figure);
      for (const id of PIECE_IDS) {
        if (figure.fixed.includes(id)) continue;
        const pose = figure.solution[id];
        const next = placePiece(session, id, { ...pose, pv: pose.at });
        expect(next, id).not.toBeNull();
        session = next!;
      }
      expect(session.status).toBe('complete');
      expect(isCompleteBoard(figure, boardOf(figure.solution))).toBe(true);
    });

    it('keeps its tier’s authoring rules (§2): vertex range, no edge shorter than a small leg, Easy convex', () => {
      const [lo, hi] = TIER_VERTICES[figure.tier];
      expect(outline.length).toBeGreaterThanOrEqual(lo);
      expect(outline.length).toBeLessThanOrEqual(hi);
      outline.forEach((v, i) => {
        const length = edgeLength(v, outline[(i + 1) % outline.length]!);
        expect(length !== null && le([2, 0], length), `edge ${i}`).toBe(true);
      });
      if (figure.tier === 'easy') {
        expect(outline.filter((_, i) => isReflexVertex(outline, i))).toEqual([]);
      }
    });

    it('fixes two different solution pieces on Medium and none elsewhere', () => {
      if (figure.tier === 'medium') {
        expect(figure.fixed).toHaveLength(2);
        expect(new Set(figure.fixed).size).toBe(2);
        expect(figure.fixed).toEqual(['L1', 'P']);
      } else {
        expect(figure.fixed).toEqual([]);
      }
    });

    it('can be built by vertex snaps alone, from the fixed pieces (§2「吸着だけで組めること」)', () => {
      const board: Partial<Record<(typeof PIECE_IDS)[number], Placement>> = {};
      for (const id of figure.fixed)
        board[id] = { ...figure.solution[id], pv: figure.solution[id].at };
      const order: string[] = [];
      let left = PIECE_IDS.filter((id) => !figure.fixed.includes(id));
      while (left.length > 0) {
        const next = left.find((id) => {
          const pose = figure.solution[id];
          const outcome = snapPose(outline, board as BoardPieces, {
            id,
            orientation: pose,
            at: ptToFloat(pose.at),
            tolerance: 0,
          });
          if (outcome.via !== 'vertex' || !outcome.placement) return false;
          return ptKey(outcome.placement.at) === ptKey(pose.at);
        });
        expect(next, `stuck after ${order.join(' ')}`).toBeDefined();
        const pose = figure.solution[next!];
        board[next!] = { ...pose, pv: pose.at };
        order.push(next!);
        left = left.filter((id) => id !== next);
      }
      expect(order.length + figure.fixed.length).toBe(7);
    });
  });

  it('has no two figures congruent under 45° turns and the mirror (§2「重複なし」)', () => {
    const keys = FIGURES.map((f) => congruenceKey(f.outline));
    const seen = new Map<string, string>();
    FIGURES.forEach((f, i) => {
      expect(seen.get(keys[i]!), f.id).toBeUndefined();
      seen.set(keys[i]!, f.id);
    });
    // The key itself is congruence-invariant.
    const square = figureById('square')!;
    expect(congruenceKey(square.outline.map((v) => orient(v, { r: 3, f: 1 })))).toBe(
      congruenceKey(square.outline),
    );
  });

  it('reports each tier’s shape numbers (not gated — §13)', () => {
    for (const tier of TIERS) {
      const rows = figuresOf(tier).map((figure) => {
        const { outline } = figure;
        const reflex = outline.filter((_, i) => isReflexVertex(outline, i)).length;
        const [w, h] = [maxOf(xs(outline)), maxOf(ys(outline))].map(
          (z) => z[0] + z[1] * Math.SQRT2,
        );
        return { vertices: outline.length, reflex, w: w!, h: h! };
      });
      const range = (values: number[], digits = 0) =>
        `${Math.min(...values).toFixed(digits)}–${Math.max(...values).toFixed(digits)}`;
      console.info(
        `${tier}: vertices ${range(rows.map((r) => r.vertices))}, reflex ${range(rows.map((r) => r.reflex))}, ` +
          `width ${range(
            rows.map((r) => r.w),
            2,
          )}, height ${range(
            rows.map((r) => r.h),
            2,
          )}`,
      );
      expect(rows.length).toBeGreaterThan(0);
    }
  });
});

describe('figure numbers and the next figure (§2, §6)', () => {
  const easy = figuresOf('easy');
  const none = () => false;
  it('numbers a figure by its place in its tier, from 1', () => {
    expect(figureNumber(easy[0]!)).toBe(1);
    expect(figureNumber(easy[2]!)).toBe(3);
    expect(figureNumber(figuresOf('hard')[0]!)).toBe(1);
  });

  it('starts at the first unsolved figure, or the head when all are solved', () => {
    expect(nextFigure('easy', undefined, none)).toBe(easy[0]);
    expect(nextFigure('easy', 'gone-figure', (id) => id === easy[0]!.id)).toBe(easy[1]);
    expect(nextFigure('easy', null, () => true)).toBe(easy[0]);
  });

  it('goes on after `last` to the first unsolved, wrapping, never `last` itself', () => {
    const solved = new Set([easy[1]!.id, easy[2]!.id]);
    expect(nextFigure('easy', easy[0]!.id, (id) => solved.has(id))).toBe(easy[3]);
    const lastIndex = easy.length - 1;
    expect(nextFigure('easy', easy[lastIndex]!.id, none)).toBe(easy[0]);
    // Only `last` itself unsolved: it is skipped, and with everything else solved
    // the figure after `last` comes next.
    expect(nextFigure('easy', easy[0]!.id, (id) => id !== easy[0]!.id)).toBe(easy[1]);
  });

  it('with everything solved, moves on to the one after `last` rather than the head (§6)', () => {
    expect(nextFigure('easy', easy[4]!.id, () => true)).toBe(easy[5]);
    expect(nextFigure('easy', easy[easy.length - 1]!.id, () => true)).toBe(easy[0]);
  });
});

describe('the daily (§6)', () => {
  const medium = figuresOf('medium');
  it('steps by a prime the Medium count shares no factor with', () => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    expect(gcd(DAILY_STRIDE, medium.length)).toBe(1);
    expect(medium.length).toBeLessThan(DAILY_STRIDE);
  });

  it('deals N different Medium figures on any N days in a row', () => {
    for (const start of ['2026-10-21', '1970-01-01', '2031-02-27', '2026-12-25']) {
      const seen = new Set<string>();
      for (let k = 0; k < medium.length; k++) {
        const figure = dailyFigure(addDays(start, k))!;
        expect(figure.tier).toBe('medium');
        seen.add(figure.id);
      }
      expect(seen.size, start).toBe(medium.length);
    }
  });

  it('is the same figure for the same date', () => {
    expect(dailyFigure('2026-10-21')).not.toBeNull();
    expect(dailyFigure('2026-10-21')).toBe(dailyFigure('2026-10-21'));
  });

  it('deals nothing for a string that is not a calendar date (fail closed)', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2026-10-21')).toBe(20_747);
    for (const bad of ['garbage', '', '2026-02-30', '2026-13-01', '2026-1-01', '0050-01-01']) {
      expect(dayNumber(bad), bad).toBeNull();
      expect(dailyFigure(bad), bad).toBeNull();
    }
  });
});
