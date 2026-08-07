/**
 * Every number the run is made of (docs/DINO_RUN_RULES.md). Distances are in
 * board pixels, times in seconds unless a name says `Ms`.
 *
 * The board is a wide, shallow strip — the proportions the genre has had
 * since the browser's offline page: a runner is read left to right, and the
 * only thing that matters vertically is whether the runner is over an
 * obstacle or under it.
 */
export const BOARD_WIDTH = 600;
export const BOARD_HEIGHT = 150;
/** The ground line, measured from the top of the board. */
export const GROUND_Y = 127;

/** The runner never moves along the track; the world moves past it (§1). */
export const RUNNER_X = 24;
/** The drawn runner exactly: 20×21 cells of art at 2px (ui/components/sprites.ts). */
export const RUNNER_WIDTH = 40;
export const RUNNER_HEIGHT = 42;

/**
 * The jump, in the two numbers that decide it: it rises 80px and is in the
 * air for 0.55s. Everything else — how far a jump carries, how wide a gap has
 * to be to be fair — falls out of those (§4). At the top of the arc the
 * runner still fits inside the board, with a few pixels to spare.
 */
export const GRAVITY = 2100;
export const JUMP_VELOCITY = 580;

export const START_SPEED = 340;
export const MAX_SPEED = 780;
/** Added to the speed per second of running: the only difficulty curve (§5). */
export const SPEED_GAIN = 3.6;

/** Board pixels per point. Score is distance and nothing else (§6). */
export const PX_PER_POINT = 40;
/** Every this many points the score blinks — a landmark, never a reward (§6). */
export const MILESTONE_EVERY = 100;

/**
 * Collision forgiveness, inset on the runner's box only. A hit has to look
 * like a hit; a pixel of overlap between two drawn shapes does not (§7).
 */
export const HIT_INSET = 4;

/** Birds join the track once the run is worth this much (§5). */
export const BIRD_FROM_SCORE = 400;
/** The three-cactus wall and the double saguaro need a run-up first (§5). */
export const CLUSTER_FROM_SCORE = 150;

/**
 * The gap to the next obstacle, in seconds of running rather than pixels: a
 * gap that is fair at 340px/s and impossible at 780px/s is not a gap, it is a
 * countdown to an unavoidable death. Seconds keep the same choice available
 * at every speed (§5).
 *
 * The minimum is longer than one jump (0.55s), so an obstacle can never enter
 * while the runner is committed to clearing the one before it.
 */
export const MIN_GAP_SECONDS = 0.72;
export const MAX_GAP_SECONDS = 1.6;

/**
 * The room left behind a high bird. It is harmless while the runner stays on
 * the ground, so the thing to prevent is having to jump — for whatever comes
 * next — while it is still overhead (§5).
 */
export const HIGH_BIRD_MIN_GAP_SECONDS = 1.1;
