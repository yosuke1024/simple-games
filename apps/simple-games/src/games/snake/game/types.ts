/**
 * The shapes the simulation is made of (docs/SNAKE_RULES.md §1, §3, §4).
 *
 * Everything here is readonly: `step` returns a new state rather than editing
 * the old one, which is what lets a test hold two consecutive boards side by
 * side and lets the view diff frames for its sounds.
 */

/** A cell on the 15x15 grid. Integer coordinates, origin top-left. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/** The run's outcome once it stops being 'playing' (§2). */
export type RunStatus = 'playing' | 'over' | 'full';

export interface GameState {
  readonly seed: string;
  /** Head first, tail last. Its length is the snake's length. */
  readonly snake: readonly Point[];
  /** The direction the last committed grid step was taken in. */
  readonly direction: Direction;
  /** Turns waiting to be committed, oldest first; at most TURN_QUEUE_LIMIT (§3). */
  readonly queue: readonly Direction[];
  readonly food: Point;
  /** How many pieces of food have been eaten — the speed curve's input (§5). */
  readonly eaten: number;
  readonly score: number;
  readonly status: RunStatus;
  /**
   * Milliseconds accumulated toward the next grid step. The remainder is kept
   * rather than dropped so the snake's pace does not depend on the frame rate:
   * a 120Hz device and a 30Hz device cover the same ground per second (§4).
   */
  readonly elapsedMs: number;
}

/** One cell of travel per direction. */
export const DIRECTION_DELTA: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** The 180° turn — the one input the game refuses to take (§3). */
export function opposite(direction: Direction): Direction {
  return OPPOSITE[direction];
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
