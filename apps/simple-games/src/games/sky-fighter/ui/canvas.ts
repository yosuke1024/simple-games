/**
 * Canvas drawing helpers for the prototype. Copied rather than shared: games
 * stay independent (docs/ARCHITECTURE.md), and a helper used twice is not yet
 * the observed duplication that earns an extraction.
 *
 * `ctx.roundRect` is Chromium 99; the supported floor is 88, so corners are
 * built from arcTo by hand. Nothing here uses shadowBlur or ctx.filter —
 * both are expensive on the low-end devices this collection targets.
 */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Cubic ease-out: fast at the start, settling — how a real thing stops. */
export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}
