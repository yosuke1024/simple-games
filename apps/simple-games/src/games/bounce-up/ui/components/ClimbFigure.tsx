/**
 * The Quick Rules figures (docs/BOUNCE_UP_RULES.md §6): small still scenes
 * drawn with the board's own pieces (../draw.ts) — the same body, clouds and
 * best line the run draws, so a figure cannot drift from the game. No text,
 * nothing moves, and nothing is scheduled: one drawing on mount, again when
 * the theme changes — the shell's attributes or the OS's dark mode, as the
 * board.
 */
import { useEffect, useRef } from 'react';
import { BOARD_WIDTH_PX, PLATFORM_WIDTH_PX } from '../../game';
import {
  drawBackground,
  drawBestLine,
  drawBody,
  drawPlatform,
  readPalette,
  wrappedCentres,
  type Palette,
} from '../draw';

/** The figure's window onto the board, logical px. */
export const FIGURE_HEIGHT = 220;

export type FigureKind = 'move' | 'wrap' | 'fall';

const PW = PLATFORM_WIDTH_PX.normal;

type Point = readonly [number, number];

/** One still scene, in the figure's logical px (y downward, as drawn). */
export interface Scene {
  /** The best line's y, or null for none. */
  readonly bestLine: number | null;
  /** Static clouds of the Normal width: left, top. */
  readonly clouds: readonly Point[];
  /** Bodies: centre x, foot y. One near an edge is drawn on both sides (`wrappedCentres`). */
  readonly bodies: readonly Point[];
  /** Dotted routes, each ending in an arrowhead. No arrow touches a body or a cloud. */
  readonly arrows: readonly (readonly Point[])[];
}

export const SCENES: Readonly<Record<FigureKind, Scene>> = {
  // Slide sideways; the bounce happens by itself on every cloud.
  move: {
    bestLine: null,
    clouds: [
      [148, 196],
      [236, 92],
      [40, 40],
    ],
    bodies: [[180, 150]],
    arrows: [
      [
        [196, 164],
        [252, 164],
      ],
      [
        [164, 164],
        [108, 164],
      ],
    ],
  },
  // Out of the right edge, in at the left: the body straddles the right edge
  // and shows on both sides; one route heads into that edge, the other rises
  // from the left edge to above the cloud there.
  wrap: {
    bestLine: null,
    clouds: [
      [270, 196],
      [34, 104],
    ],
    bodies: [[354, 150]],
    arrows: [
      [
        [282, 146],
        [326, 135],
      ],
      [
        [16, 120],
        [38, 84],
      ],
    ],
  },
  // Missed every cloud: down past the bottom edge, and the best line above.
  fall: {
    bestLine: 40,
    clouds: [
      [60, 100],
      [220, 150],
    ],
    bodies: [[170, 190]],
    arrows: [
      [
        [196, 150],
        [196, 210],
      ],
    ],
  },
};

/** The arrowhead at a route's last point: tip, then the two back corners. */
export function arrowHead(points: readonly Point[]): readonly [Point, Point, Point] {
  const [x1, y1] = points[points.length - 2]!;
  const [x2, y2] = points[points.length - 1]!;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return [
    [x2 + Math.cos(angle) * 6, y2 + Math.sin(angle) * 6],
    [x2 + Math.cos(angle + 2.4) * 9, y2 + Math.sin(angle + 2.4) * 9],
    [x2 + Math.cos(angle - 2.4) * 9, y2 + Math.sin(angle - 2.4) * 9],
  ];
}

/** The route's dotted line width, px. */
export const ROUTE_WIDTH = 3;

/** A dotted route with an arrowhead at its last point. */
function arrow(ctx: CanvasRenderingContext2D, palette: Palette, points: readonly Point[]): void {
  ctx.strokeStyle = palette.inkSoft;
  ctx.lineWidth = ROUTE_WIDTH;
  ctx.setLineDash([2, 7]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);
  const [tip, left, right] = arrowHead(points);
  ctx.fillStyle = palette.inkSoft;
  ctx.beginPath();
  ctx.moveTo(tip[0], tip[1]);
  ctx.lineTo(left[0], left[1]);
  ctx.lineTo(right[0], right[1]);
  ctx.closePath();
  ctx.fill();
}

/** One figure, drawn into a 360 × FIGURE_HEIGHT logical window. */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  kind: FigureKind,
): void {
  const scene = SCENES[kind];
  drawBackground(ctx, palette);
  if (scene.bestLine !== null) drawBestLine(ctx, palette, scene.bestLine);
  for (const [left, top] of scene.clouds) drawPlatform(ctx, palette, 'static', left, top, PW);
  for (const [x, foot] of scene.bodies) {
    for (const cx of wrappedCentres(x)) drawBody(ctx, palette, cx, foot, false);
  }
  for (const points of scene.arrows) arrow(ctx, palette, points);
}

export function ClimbFigure({ kind }: { kind: FigureKind }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') ?? null;
    if (!canvas || !ctx) return undefined;
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round((canvas.clientWidth || BOARD_WIDTH_PX) * dpr));
      const h = Math.max(1, Math.round(w * (FIGURE_HEIGHT / BOARD_WIDTH_PX)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const scale = w / BOARD_WIDTH_PX;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawFigure(ctx, readPalette(), kind);
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-game'],
    });
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    media?.addEventListener('change', paint);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', paint);
    };
  }, [kind]);

  return <canvas ref={canvasRef} className="bo-figure" aria-hidden="true" />;
}
