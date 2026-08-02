/**
 * The difficulty ladder. 100 levels, matching the rest of the collection.
 *
 * Two shapes, not one. *Across* the ladder the board grows and the ball starts
 * faster. *Inside* a level the ball accelerates with every brick broken, so an
 * emptying board does not become an easier one — which is the whole reason the
 * first prototype felt flat: its speed was constant within a board and capped
 * after 27 boards, and only three layouts ever repeated.
 *
 * Every lever is continuous in `level`; nothing saturates before 100.
 */
export const LEVEL_COUNT = 100;

function clampLevel(level: number): number {
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)));
}

/** 0 at level 1, 1 at level 100. */
function progress(level: number): number {
  return (clampLevel(level) - 1) / (LEVEL_COUNT - 1);
}

export interface LevelSpec {
  rows: number;
  /** Share of cells that carry a brick. */
  density: number;
  /** Bricks that release an extra ball when broken. */
  ballBricks: number;
  /** The paddle narrows as the ladder climbs — felt, never displayed. */
  paddleWidth: number;
  baseSpeed: number;
  /** Added to the ball's speed for each brick broken in this level. */
  speedPerBrick: number;
  maxSpeed: number;
  /** Pixels per second the whole wall creeps toward the line. */
  descentSpeed: number;
}

export function levelSpec(level: number): LevelSpec {
  const t = progress(level);
  return {
    rows: 3 + Math.round(t * 4),
    density: 0.55 + t * 0.45,
    ballBricks: 1 + Math.round(t),
    paddleWidth: 76 - t * 20,
    baseSpeed: 240 + t * 90,
    speedPerBrick: 3 + t * 2.5,
    maxSpeed: 400 + t * 80,
    descentSpeed: 3 + t * 5,
  };
}

/** The ball's speed after `broken` bricks in this level. */
export function ballSpeed(level: number, broken: number): number {
  const spec = levelSpec(level);
  return Math.min(spec.maxSpeed, spec.baseSpeed + broken * spec.speedPerBrick);
}
