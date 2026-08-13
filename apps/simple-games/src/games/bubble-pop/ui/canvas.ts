/**
 * Canvas drawing helpers for the board.
 *
 * Nothing here uses shadowBlur or ctx.filter — both are expensive on the
 * low-end devices this collection targets (Brick Breaker's ui/canvas.ts sets
 * the same rule). Every bubble's inside mark is built from Canvas path calls
 * (arcs and lines), never a font glyph: a glyph can be missing or render as
 * tofu on a bare system font, the same reasoning that keeps Mahjong
 * Solitaire's tile pips off system CJK fonts and draws them as path data
 * instead. Color tells the paint; the mark's *shape* is what a player who
 * cannot tell the colors apart reads instead (docs/plans/
 * 2026-08-08-mahjong-bubble-ludo.md §Bubble Pop §12).
 */
import type { Point } from '../game/types';

export type BubbleMark = 'circle' | 'triangle' | 'square' | 'diamond' | 'star' | 'crescent';

/** Cubic ease-out: fast at the start, settling — how a real thing stops. */
export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/** Total length of a polyline, for placing a point a given distance along it. */
export function pathLength(path: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  }
  return total;
}

/** The point `distance` along `path`, clamped to the path's two ends. */
export function pointAtDistance(path: readonly Point[], distance: number): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0]!;
  let remaining = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segLen || i === path.length - 1) {
      const t = segLen === 0 ? 0 : Math.min(1, remaining / segLen);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= segLen;
  }
  return path[path.length - 1]!;
}

/** The inside mark's path, centered at the origin with the given half-size `r`. */
function traceMark(ctx: CanvasRenderingContext2D, mark: BubbleMark, r: number): void {
  ctx.beginPath();
  switch (mark) {
    case 'circle':
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      return;
    case 'triangle': {
      const h = r * 0.95;
      ctx.moveTo(0, -h);
      ctx.lineTo(h * 0.87, h * 0.55);
      ctx.lineTo(-h * 0.87, h * 0.55);
      ctx.closePath();
      return;
    }
    case 'square': {
      const s = r * 0.8;
      ctx.rect(-s, -s, s * 2, s * 2);
      return;
    }
    case 'diamond': {
      const s = r * 0.95;
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      return;
    }
    case 'star': {
      const spikes = 4;
      const outer = r;
      const inner = r * 0.42;
      let rot = -Math.PI / 2;
      const step = Math.PI / spikes;
      ctx.moveTo(Math.cos(rot) * outer, Math.sin(rot) * outer);
      for (let i = 0; i < spikes; i++) {
        rot += step;
        ctx.lineTo(Math.cos(rot) * inner, Math.sin(rot) * inner);
        rot += step;
        ctx.lineTo(Math.cos(rot) * outer, Math.sin(rot) * outer);
      }
      ctx.closePath();
      return;
    }
    case 'crescent': {
      // Two overlapping circular paths, filled even-odd: the lune between
      // them is the crescent. Built entirely from `arc`, still a path.
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(r * 0.95 + r * 0.8, 0);
      ctx.arc(r * 0.55, 0, r * 0.85, 0, Math.PI * 2, true);
      return;
    }
  }
}

/** One bubble: filled circle plus its color-independent inside mark. */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
  mark: BubbleMark,
  markFill: string,
  markStroke: string,
  alpha = 1,
): void {
  if (radius <= 0.3 || alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.translate(x, y);
  traceMark(ctx, mark, radius * 0.55);
  ctx.fillStyle = markFill;
  ctx.fill(mark === 'crescent' ? 'evenodd' : 'nonzero');
  if (mark !== 'crescent') {
    ctx.lineWidth = Math.max(0.75, radius * 0.1);
    ctx.strokeStyle = markStroke;
    ctx.stroke();
  }
  ctx.restore();
}
