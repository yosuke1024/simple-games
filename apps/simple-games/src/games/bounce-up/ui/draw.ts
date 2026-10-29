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
 * Static and moving clouds also stand on a paper foot — the same outline in
 * the line colour, a few px lower, so they read as cut paper lifted off the
 * board like every other raised thing in the collection. The foot sits under
 * the cloud and below its top edge, so the landing line does not move; a
 * vanishing cloud has none (nothing to carry weight). The foot is depth only:
 * it is a light line on paper, below the 3:1 a mark that carries meaning
 * needs, so the kinds stay told apart by the shapes above and never by
 * whether a foot is there (§7).
 * The personal-best line is a dashed rule across the board with an inward
 * notch at each edge. The body is this game's own shape: a rounded drop with
 * two eyes and a sprout (§7, §9.4). It has weight: it flattens on a landing
 * and settles back over `SETTLE_STEPS`, and stretches a little with its speed
 * (`bodyScale`) — drawing only; the foot stays put and nothing here decides a
 * landing (§2). There is no text on the board at all, and no ruled-grid
 * background (§9.4).
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
  JUMP_SPEED,
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
/**
 * How far below its cloud a paper foot shows, logical px (§7). About 2 CSS px
 * at the web board's 0.66 scale — the height of a shared key's `0 2px 0` lift.
 */
export const PLATFORM_LIFT = 3;

/** Steps a landing's flattening takes to settle: 100 ms at 120 Hz (§7). */
export const SETTLE_STEPS = 12;
/** The body's height at the instant of a landing, as a fraction of its height (§7). */
const SQUASH_DEPTH = 0.8;
/** How much taller than at rest it is drawn at JUMP_SPEED or faster, up or down (§7). */
const STRETCH = 0.08;

/** The factors the body is drawn at, about its foot (§7). */
export interface BodyScale {
  readonly sx: number;
  readonly sy: number;
}

/** The body at rest — and the only body under Reduced Motion and in the Quick Rules figures. */
export const REST: BodyScale = { sx: 1, sy: 1 };

/**
 * The body's shape `since` steps after its last bounce, flying at `vy` (§7).
 * It starts flat at the landing and eases back out, ending at the stretch the
 * speed asks for: +8% tall at JUMP_SPEED or more (up or down), none at the top
 * of the arc. The width follows as 1/√height, so the body keeps its volume as
 * it would were it as deep as it is wide — 1.12 wide at the deepest, 0.96 at
 * the fullest stretch. Pure and exact at its ends: since 0 at JUMP_SPEED is
 * 0.8 tall; since ≥ SETTLE_STEPS at the top of the arc is REST.
 */
export function bodyScale(since: number, vy: number): BodyScale {
  const flight = 1 + STRETCH * Math.min(1, Math.abs(vy) / JUMP_SPEED);
  const u = Math.min(1, Math.max(0, since) / SETTLE_STEPS);
  const ease = 1 - (1 - u) * (1 - u);
  const sy = SQUASH_DEPTH + (flight - SQUASH_DEPTH) * ease;
  return { sx: 1 / Math.sqrt(sy), sy };
}

/**
 * The weight the board draws the body at: `REST` under Reduced Motion, else
 * `bodyScale`. One place, so the flattening and the stretch — the two motions
 * this view adds — are switched off together (§7).
 */
export function weightOf(reduced: boolean, since: number, vy: number): BodyScale {
  return reduced ? REST : bodyScale(since, vy);
}

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
  if (kind !== 'vanishing') {
    // The paper foot: the same outline, lower, drawn first. Only its rim
    // below the cloud shows; the top edge (the landing line) is untouched.
    cloudPath(ctx, left, top + PLATFORM_LIFT, width, THICK);
    ctx.fillStyle = palette.line;
    ctx.fill();
  }
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
 * sprout. `scale` is its weight (`bodyScale`) — the flattening after a bounce
 * and the stretch in flight, the one motion here that is decoration, and
 * `REST` under Reduced Motion (§7). The foot stays at `foot`, so the shape
 * changes above it and never moves where the body stands.
 */
export function drawBody(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  cx: number,
  foot: number,
  scale: BodyScale,
): void {
  const w = BODY_W * scale.sx;
  const h = BODY_H * scale.sy;
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
  ctx.fillRect(cx - 7 * scale.sx, eyeY - 2.5, 4, 5);
  ctx.fillRect(cx + 3 * scale.sx, eyeY - 2.5, 4, 5);
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
  /** The body's weight right now (`bodyScale`); `REST` under Reduced Motion. */
  readonly scale: BodyScale;
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
    drawBody(ctx, palette, cx, foot, options.scale);
  }
}
