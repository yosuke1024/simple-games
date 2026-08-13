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
 * shotIndex), restricted to colors still on the board so the supply never
 * hands out a color the player cannot possibly match. Falls back to the
 * level's full palette only if the board has none left — reachable only
 * once the board is already cleared, at which point the level is won and
 * nothing calls this again, but it keeps the function total rather than
 * asserting an invariant the caller must already uphold.
 */
export function supplyColorFor(
  seed: string,
  level: number,
  shotIndex: number,
  remaining: readonly BubbleColor[],
): BubbleColor {
  const pool = remaining.length > 0 ? remaining : COLOR_ORDER.slice(0, levelSpec(level).colorCount);
  const rng = createRng(`${seed}:${level}:supply:${shotIndex}`);
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index]!;
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
