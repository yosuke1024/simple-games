/**
 * The Quick Rules figures' geometry (docs/BOUNCE_UP_RULES.md §6): every
 * arrow — its dotted route and its head — stays clear of every body and
 * every cloud, and inside the figure's window. The boxes are the pieces'
 * drawn extents as ui/draw.ts draws them: the body 28 × 28 px with its
 * sprout up to 10 px above the head, a cloud its width by its 10 px
 * thickness plus the puffs' 5 px under it and the paper foot's 3 px
 * (`PLATFORM_LIFT`).
 */
import { describe, expect, it } from 'vitest';
import { BOARD_WIDTH_PX, PLATFORM_WIDTH_PX } from '../../game';
import { PLATFORM_LIFT, wrappedCentres } from '../draw';
import {
  FIGURE_HEIGHT,
  ROUTE_WIDTH,
  SCENES,
  arrowHead,
  type FigureKind,
  type Scene,
} from './ClimbFigure';

type Point = readonly [number, number];

interface Box {
  readonly what: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The gap, px, every arrow keeps from every body and cloud. */
const CLEARANCE = 2;

function boxesOf(scene: Scene): Box[] {
  const boxes: Box[] = [];
  for (const [x, foot] of scene.bodies) {
    for (const cx of wrappedCentres(x)) {
      boxes.push({ what: `body at ${cx}`, x0: cx - 14, y0: foot - 28 - 10, x1: cx + 14, y1: foot });
    }
  }
  for (const [left, top] of scene.clouds) {
    const w = PLATFORM_WIDTH_PX.normal;
    boxes.push({
      what: `cloud at ${left},${top}`,
      x0: left,
      y0: top,
      x1: left + w,
      y1: top + 15 + PLATFORM_LIFT,
    });
  }
  return boxes;
}

function distance([x, y]: Point, b: Box): number {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dy = Math.max(b.y0 - y, 0, y - b.y1);
  return Math.hypot(dx, dy);
}

/** Points every 0.25 px along a polyline. */
function along(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.25));
    for (let k = 0; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/** Whether p is inside the triangle (any orientation). */
function inside(p: Point, [a, b, c]: readonly [Point, Point, Point]): boolean {
  const side = (u: Point, v: Point) =>
    (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]);
  const s1 = side(a, b);
  const s2 = side(b, c);
  const s3 = side(c, a);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

const KINDS: readonly FigureKind[] = ['move', 'wrap', 'fall'];

describe('the Quick Rules figures (§6)', () => {
  for (const kind of KINDS) {
    it(`${kind}: no arrow touches a body or a cloud, and every arrow is inside the window`, () => {
      const scene = SCENES[kind];
      const boxes = boxesOf(scene);
      expect(scene.arrows.length).toBeGreaterThan(0);
      for (const route of scene.arrows) {
        const head = arrowHead(route);
        const routePoints = along(route);
        const headPoints = along([...head, head[0]]);
        for (const box of boxes) {
          const routeGap = Math.min(...routePoints.map((p) => distance(p, box))) - ROUTE_WIDTH / 2;
          const headGap = Math.min(...headPoints.map((p) => distance(p, box)));
          expect(routeGap, `route ${JSON.stringify(route)} vs ${box.what}`).toBeGreaterThanOrEqual(
            CLEARANCE,
          );
          expect(headGap, `head of ${JSON.stringify(route)} vs ${box.what}`).toBeGreaterThanOrEqual(
            CLEARANCE,
          );
          // A box corner inside the head would not show in the edge distances.
          const corners: Point[] = [
            [box.x0, box.y0],
            [box.x1, box.y0],
            [box.x0, box.y1],
            [box.x1, box.y1],
          ];
          for (const corner of corners) expect(inside(corner, head)).toBe(false);
        }
        for (const [x, y] of [...routePoints, ...head]) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(BOARD_WIDTH_PX);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(FIGURE_HEIGHT);
        }
      }
    });
  }

  it('wrap: the body straddles the right edge, one route heads into it, the other rises from the left edge to above the cloud there', () => {
    const { bodies, arrows, clouds } = SCENES.wrap;
    const [x] = bodies[0]!;
    expect(wrappedCentres(x)).toHaveLength(2);
    expect(x).toBeGreaterThan(BOARD_WIDTH_PX - 14);

    const [out, back] = arrows;
    const outEnd = out![out!.length - 1]!;
    expect(outEnd[0]).toBeGreaterThan(out![0]![0]);
    expect(arrowHead(out!)[0][0]).toBeLessThan(x - 14);

    const [left, top] = clouds.find(([l]) => l < BOARD_WIDTH_PX / 2)!;
    const [tip, ...corners] = arrowHead(back!);
    expect(back![0]![0]).toBeLessThan(left);
    expect(back![back!.length - 1]![1]).toBeLessThan(back![0]![1]);
    expect(tip[0]).toBeGreaterThanOrEqual(left);
    expect(tip[0]).toBeLessThanOrEqual(left + PLATFORM_WIDTH_PX.normal);
    for (const [, y] of [tip, ...corners]) expect(y).toBeLessThan(top);
  });
});
