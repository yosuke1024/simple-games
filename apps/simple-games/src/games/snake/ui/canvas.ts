/**
 * Canvas drawing helpers for the board. Copied rather than shared: games stay
 * independent (docs/ARCHITECTURE.md), the same reason the two sibling arcade
 * titles carry their own copies.
 *
 * `ctx.roundRect` is Chromium 99; the supported floor is 88, so corners are
 * built from arcTo by hand. Nothing here uses shadowBlur or ctx.filter —
 * both are expensive on the low-end devices this collection targets
 * (docs/SNAKE_RULES.md §12).
 *
 * The one difference from the siblings' copies: this appends to the path
 * already open instead of beginning one. The snake is drawn as a single path
 * of segments and the joins between them, filled once — with a fill per
 * segment the overlaps would show as seams the moment the body is drawn at
 * anything but full opacity.
 */
export function addRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
