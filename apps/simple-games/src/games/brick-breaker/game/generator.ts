import { BOARD_WIDTH, BRICK_COLUMNS, BRICK_GAP, BRICK_HEIGHT, BRICK_TOP } from './constants';
import { levelSpec } from './levels';
import { createRng } from './rng';
import type { Brick } from './types';

/**
 * The board for a level, derived from (seed, level). Rows are mirrored around
 * the centre column so a layout reads as a designed shape rather than as
 * scattered noise — the symmetry is what makes an angle worth aiming at.
 */
export function buildBricks(seed: string, level: number): Brick[] {
  const rng = createRng(`${seed}:${level}`);
  const spec = levelSpec(level);
  const cellWidth = (BOARD_WIDTH - BRICK_GAP * (BRICK_COLUMNS + 1)) / BRICK_COLUMNS;
  const half = BRICK_COLUMNS / 2;

  const bricks: Brick[] = [];
  for (let row = 0; row < spec.rows; row++) {
    const filled: boolean[] = [];
    for (let col = 0; col < half; col++) filled[col] = rng() < spec.density;
    // A row with nothing in it reads as a mistake, not as a gap.
    if (!filled.some(Boolean)) filled[Math.floor(rng() * half)] = true;

    for (let col = 0; col < BRICK_COLUMNS; col++) {
      const mirrored = col < half ? col : BRICK_COLUMNS - 1 - col;
      if (!filled[mirrored]) continue;
      bricks.push({
        x: BRICK_GAP + col * (cellWidth + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
        width: cellWidth,
        height: BRICK_HEIGHT,
        alive: true,
        kind: 'normal',
      });
    }
  }

  // Ball bricks sit in the lower half of the stack: reaching one is a small
  // goal in itself, and getting the reward early would flatten the level.
  const reachable = bricks
    .map((brick, index) => ({ brick, index }))
    .filter(
      ({ brick }) => brick.y >= BRICK_TOP + Math.floor(spec.rows / 2) * (BRICK_HEIGHT + BRICK_GAP),
    );
  const pool = reachable.length > 0 ? reachable : bricks.map((brick, index) => ({ brick, index }));
  for (let i = 0; i < spec.ballBricks && pool.length > 0; i++) {
    const pick = Math.floor(rng() * pool.length);
    const chosen = pool.splice(pick, 1)[0]!;
    bricks[chosen.index] = { ...chosen.brick, kind: 'ball' };
  }

  return bricks;
}

/**
 * The board as text, one row per line: '#' brick, 'o' ball brick, '.' gap.
 * Exists for the golden compatibility test — a moved board must fail a test,
 * not ship silently.
 */
export function boardToString(bricks: readonly Brick[]): string {
  const cellWidth = (BOARD_WIDTH - BRICK_GAP * (BRICK_COLUMNS + 1)) / BRICK_COLUMNS;
  const rows = new Map<number, string[]>();
  for (const brick of bricks) {
    const row = Math.round((brick.y - BRICK_TOP) / (BRICK_HEIGHT + BRICK_GAP));
    const col = Math.round((brick.x - BRICK_GAP) / (cellWidth + BRICK_GAP));
    if (!rows.has(row))
      rows.set(
        row,
        Array.from({ length: BRICK_COLUMNS }, () => '.'),
      );
    rows.get(row)![col] = brick.kind === 'ball' ? 'o' : '#';
  }
  return Array.from(rows.keys())
    .sort((a, b) => a - b)
    .map((row) => rows.get(row)!.join(''))
    .join('/');
}
