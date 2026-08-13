/**
 * The board for a level, derived from (seed, level) — same shape as Brick
 * Breaker's `buildBricks('${seed}:${level}')`. A freshly generated board
 * never carries a pre-existing pop: every cell is chosen so it does not
 * complete a same-color group of POP_MIN_CLUSTER or more with whatever is
 * already placed above and to its left, which is everything reachable at
 * that point in the fill order (row-major, then column). `scatterBias`
 * (levels.ts) additionally steers away from *pairs* as level climbs, so
 * higher levels don't hand out free half-finished matches even though
 * nothing here would call that state illegal.
 *
 * Dispensed colors (§8: current + next) are a second, independent
 * deterministic stream — a function of (seed, level, shot index) restricted
 * to colors still on the board, so the supply can never hand out a color
 * that has nothing left to match.
 */
import { connectedGroup } from './engine';
import { allCellsInRow, cellFromKey, cellKey, neighborsOf } from './grid';
import { levelSpec } from './levels';
import { createRng } from './rng';
import { COLOR_ORDER, POP_MIN_CLUSTER } from './constants';
import type { Board, BubbleColor } from './types';

function pickColor(
  rng: () => number,
  palette: readonly BubbleColor[],
  cell: { row: number; col: number },
  cells: Map<string, BubbleColor>,
  scatterBias: number,
): BubbleColor {
  const key = cellKey(cell);
  const placedNeighborColors = neighborsOf(cell)
    .map((n) => cells.get(cellKey(n)))
    .filter((c): c is BubbleColor => c !== undefined);

  // A color is allowed only if placing it here would not already complete a
  // pop — tested by actually placing it, measuring the connected group, and
  // taking it back out. Reuses engine.ts's flood fill rather than a second
  // copy of it.
  let allowed = palette.filter((color) => {
    cells.set(key, color);
    const group = connectedGroup(cells, cell, (c) => c === color);
    cells.delete(key);
    return group.length < POP_MIN_CLUSTER;
  });
  // Only possible with POP_MIN_CLUSTER = 1 or a single-color palette, neither
  // of which this game ships — kept so the function stays total.
  if (allowed.length === 0) allowed = [...palette];

  if (rng() < scatterBias) {
    const scattered = allowed.filter((color) => !placedNeighborColors.includes(color));
    if (scattered.length > 0) allowed = scattered;
  }

  const index = Math.min(allowed.length - 1, Math.floor(rng() * allowed.length));
  return allowed[index]!;
}

/** The starting board for a level. Deterministic in (seed, level) alone. */
export function buildBoard(seed: string, level: number): Board {
  const rng = createRng(`${seed}:${level}`);
  const spec = levelSpec(level);
  const palette = COLOR_ORDER.slice(0, spec.colorCount);
  const cells = new Map<string, BubbleColor>();
  for (let row = 0; row < spec.rows; row++) {
    for (const cell of allCellsInRow(row)) {
      cells.set(cellKey(cell), pickColor(rng, palette, cell, cells, spec.scatterBias));
    }
  }
  return cells;
}

/** Colors still present on the board, in COLOR_ORDER (a stable, seed-free order). */
export function remainingColors(board: Board): BubbleColor[] {
  const present = new Set(board.values());
  return COLOR_ORDER.filter((color) => present.has(color));
}

/**
 * The color dispensed at `shotIndex` (§8): deterministic in (seed, level,
 * shotIndex, board), restricted to colors still on the board so the supply
 * never hands out a color the player cannot possibly match.
 *
 * Weighted by how many of that color remain, not drawn uniformly: a color
 * with 15 bubbles left is far more likely to sit next to another bubble of
 * its own color, at some exposed cell, than a color with 2 — a uniform draw
 * dispenses the *rare* color just as often as the common one, which spends
 * a large share of shots on colors the frontier barely offers a match for.
 * autoplay.test.ts is what surfaced this: with a uniform draw, several of
 * the hardest (6-color) levels never converged inside the shot budget no
 * matter how the shooter's search was strengthened, because the dispensed
 * color was so often one with nothing reachable to join. Weighting by
 * abundance is the ordinary shape of "help" a bubble shooter's supply
 * offers — it never removes information the board doesn't already show
 * (the counts are exactly what a player seeing the whole board can count
 * themselves), it only stops the supply from actively fighting the player
 * on top of whatever the board already makes hard.
 *
 * The weight is count *squared*, not count itself — autoplay.test.ts's own
 * data point: a linear weight still left 3 of the 100 shipped levels short
 * of the shot budget, and squaring (making the lean toward whichever color
 * is already most common noticeably stronger) is what closed the gap. A
 * cubed weight was tried too and swapped which handful of levels came up
 * short rather than clearing all of them — evidence this is a real
 * optimum for this shipped ladder, not a knob that keeps paying off the
 * harder it's turned.
 *
 * Falls back to the level's full palette only if the board has none left —
 * reachable only once the board is already cleared, at which point the
 * level is won and nothing calls this again, but it keeps the function
 * total rather than asserting an invariant the caller must already uphold.
 */
export function supplyColorFor(seed: string, level: number, shotIndex: number, board: Board): BubbleColor {
  const counts = new Map<BubbleColor, number>();
  for (const color of board.values()) counts.set(color, (counts.get(color) ?? 0) + 1);
  const present = COLOR_ORDER.filter((color) => (counts.get(color) ?? 0) > 0);
  const pool = present.length > 0 ? present : COLOR_ORDER.slice(0, levelSpec(level).colorCount);
  const weights = present.length > 0 ? pool.map((color) => counts.get(color)! ** 2) : pool.map(() => 1);
  const total = weights.reduce((sum, w) => sum + w, 0);

  const rng = createRng(`${seed}:${level}:supply:${shotIndex}`);
  let draw = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    draw -= weights[i]!;
    if (draw <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!; // Floating-point edge case at draw ≈ total.
}

const COLOR_CHAR: Record<BubbleColor, string> = {
  blue: 'b',
  green: 'g',
  yellow: 'y',
  purple: 'p',
  orange: 'o',
  cyan: 'c',
};

/**
 * The board as text, one row per line, '.' for an empty cell. Exists for the
 * compatibility golden — a moved board (or a moved landing cell, mid-script)
 * must fail a test, not ship silently.
 */
export function boardToString(board: Board): string {
  if (board.size === 0) return '(empty)';
  let maxRow = 0;
  for (const key of board.keys()) maxRow = Math.max(maxRow, cellFromKey(key).row);

  const lines: string[] = [];
  for (let row = 0; row <= maxRow; row++) {
    let line = '';
    for (const cell of allCellsInRow(row)) {
      const color = board.get(cellKey(cell));
      line += color ? COLOR_CHAR[color] : '.';
    }
    lines.push(line);
  }
  return lines.join('/');
}
