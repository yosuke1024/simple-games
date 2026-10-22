/**
 * Everything the board draws, in logical px on the 360×640 board
 * (docs/BOUNCE_UP_RULES.md §7「画面と寸法」). The board
 * (components/BounceStage.tsx) and the Quick Rules figures
 * (components/ClimbFigure.tsx) draw with these same pieces, so a figure can
 * never show a platform or a body the run does not (§6).
 *
 * Told apart by shape, never by colour alone (§7「足場の見分け」): every
 * platform is a cloud — a flat top, the one line a landing is judged on, over
 * a scalloped underside — and the kinds differ in silhouette and fill:
 * - static: a filled cloud;
 * - moving: a lighter cloud with a solid edge and an outward triangle beyond
 *   each end (the sign of its back and forth);
 * - vanishing: a dashed outline with nothing filled in.
 * The personal-best line is a dashed rule across the board with an inward
 * notch at each edge. The body is this game's own shape: a rounded drop with
 * two eyes and a sprout (§7, §9.4). There is no text on the board at all, and
 * no ruled-grid background (§9.4).
 *
 * Every colour is a token read from computed style — none is written here but
 * the jsdom fallbacks (the light theme's values). Chromium 88 is the floor:
 * corners are built with quadratic curves (`roundRect` is Chromium 99), and
 * nothing uses shadowBlur or ctx.filter.
 */
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  BOARD_HEIGHT_PX,
  BOARD_WIDTH_PX,
  PLATFORM_THICKNESS,
  SUB,
} from '../game/constants';
import { leftAt } from '../game/physics';
import { bestLineHeight } from '../game/score';
import type { PlatformKind, RunState } from '../game/types';

export interface Palette {
  surface: string;
  line: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentSoft: string;
}

/** Fallbacks are the light theme's tokens; only jsdom ever needs them. */
export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    surface: pick('--surface', '#fffdf8'),
    line: pick('--line', '#ddd7ca'),
    ink: pick('--ink', '#232a33'),
    inkSoft: pick('--ink-soft', '#5c6772'),
    accent: pick('--accent', '#9e4892'),
    accentSoft: pick('--accent-soft', '#efdcec'),
  };
}

const BODY_W = BODY_WIDTH / SUB;
const BODY_H = BODY_HEIGHT / SUB;
const THICK = PLATFORM_THICKNESS / SUB;

/** A height in units (camera at `cameraBottom`) as a y on the board, px from the top. */
export function screenY(height: number, cameraBottom: number): number {
  return BOARD_HEIGHT_PX - (height - cameraBottom) / SUB;
}

/**
 * A cloud: flat top from (x, y) to (x + w, y), rounded top corners, and a
 * scalloped underside about `h` below. The top edge is exactly the landing
 * line (§2), so nothing of the cloud rises above it.
 */
export function cloudPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const r = Math.min(5, h / 2, w / 4);
  const puffs = Math.max(2, Math.round(w / 16));
  const pw = w / puffs;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - 3);
  for (let i = puffs - 1; i >= 0; i--) {
    const from = x + (i + 1) * pw;
    const to = x + i * pw;
    ctx.quadraticCurveTo((from + to) / 2, y + h + 5, to, y + h - 3);
  }
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** One platform of `kind`, its top edge at board y `top`, left edge `left`, `width` wide (px). */
export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  kind: PlatformKind,
  left: number,
  top: number,
  width: number,
): void {
  cloudPath(ctx, left, top, width, THICK);
  if (kind === 'static') {
    ctx.fillStyle = palette.accent;
    ctx.fill();
    return;
  }
  if (kind === 'moving') {
    ctx.fillStyle = palette.accentSoft;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = palette.accent;
    ctx.stroke();
    // An outward triangle beyond each end: the sign of the back and forth.
    const mid = top + THICK / 2;
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.moveTo(left - 2, mid - 5);
    ctx.lineTo(left - 9, mid);
    ctx.lineTo(left - 2, mid + 5);
    ctx.closePath();
    ctx.moveTo(left + width + 2, mid - 5);
    ctx.lineTo(left + width + 9, mid);
    ctx.lineTo(left + width + 2, mid + 5);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // Vanishing: the outline only, dashed — a cloud that will not hold twice.
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.inkSoft;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * The body (§7): a rounded drop, its foot at (cx, foot), with two eyes and a
 * sprout. `squash` flattens it for the few steps after a bounce — the one
 * motion here that is decoration, and off under Reduced Motion (§7).
 */
export function drawBody(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  cx: number,
  foot: number,
  squash: boolean,
): void {
  const w = squash ? BODY_W * 1.14 : BODY_W;
  const h = squash ? BODY_H * 0.82 : BODY_H;
  const x = cx - w / 2;
  const y = foot - h;
  const r = w / 2.4;
  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, foot - 4);
  ctx.quadraticCurveTo(x + w, foot, x + w - 4, foot);
  ctx.lineTo(x + 4, foot);
  ctx.quadraticCurveTo(x, foot, x, foot - 4);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  // The sprout: a short stem and a leaf, ink on the surface above the head.
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx + 2, y - 5);
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.moveTo(cx + 2, y - 5);
  ctx.quadraticCurveTo(cx + 9, y - 10, cx + 10, y - 4);
  ctx.quadraticCurveTo(cx + 6, y - 2, cx + 2, y - 5);
  ctx.closePath();
  ctx.fill();
  // The eyes: the surface showing through.
  ctx.fillStyle = palette.surface;
  const eyeY = y + h * 0.4;
  ctx.fillRect(cx - 7, eyeY - 2.5, 4, 5);
  ctx.fillRect(cx + 3, eyeY - 2.5, 4, 5);
}

/** The personal-best line (§4「スコアと高さ」): a dashed rule with an inward notch at each edge. */
export function drawBestLine(ctx: CanvasRenderingContext2D, palette: Palette, y: number): void {
  ctx.strokeStyle = palette.inkSoft;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(BOARD_WIDTH_PX, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = palette.inkSoft;
  ctx.beginPath();
  ctx.moveTo(0, y - 6);
  ctx.lineTo(8, y);
  ctx.lineTo(0, y + 6);
  ctx.closePath();
  ctx.moveTo(BOARD_WIDTH_PX, y - 6);
  ctx.lineTo(BOARD_WIDTH_PX - 8, y);
  ctx.lineTo(BOARD_WIDTH_PX, y + 6);
  ctx.closePath();
  ctx.fill();
}

export function drawBackground(ctx: CanvasRenderingContext2D, palette: Palette): void {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, BOARD_WIDTH_PX, BOARD_HEIGHT_PX);
}

/**
 * The x positions (px) a body centred at `x` is drawn at: itself, and its
 * other half across an edge when it straddles one (§1 — the edges join).
 */
export function wrappedCentres(x: number): number[] {
  const out = [x];
  const half = BODY_W / 2 + 12;
  if (x < half) out.push(x + BOARD_WIDTH_PX);
  if (x > BOARD_WIDTH_PX - half) out.push(x - BOARD_WIDTH_PX);
  return out;
}

export interface DrawOptions {
  /** This width's best when the run began, in points; 0 draws no line (§4). */
  readonly bestScore: number;
  /** The few steps after a bounce, when not under Reduced Motion. */
  readonly squash: boolean;
}

/** The whole board for one state. */
export function drawRun(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  run: RunState,
  options: DrawOptions,
): void {
  drawBackground(ctx, palette);
  const camera = run.cameraBottom;
  if (options.bestScore > 0) {
    const y = screenY(bestLineHeight(options.bestScore), camera);
    if (y > -4 && y < BOARD_HEIGHT_PX + 4) drawBestLine(ctx, palette, y);
  }
  for (const p of run.platforms) {
    const top = screenY(p.top, camera);
    if (top > BOARD_HEIGHT_PX + 4 || top < -THICK - 8) continue;
    drawPlatform(ctx, palette, p.kind, leftAt(run, p) / SUB, top, p.width / SUB);
  }
  const foot = screenY(run.y, camera);
  for (const cx of wrappedCentres(run.x / SUB)) {
    drawBody(ctx, palette, cx, foot, options.squash);
  }
}
