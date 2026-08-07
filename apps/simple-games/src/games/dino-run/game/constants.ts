/**
 * Every number the run is made of (docs/DINO_RUN_RULES.md). Distances are in
 * board pixels, times in seconds unless a name says `Ms`.
 *
 * The board is a wide strip rather than a tall field: a runner is read
 * left-to-right, and the only thing that matters vertically is whether the
 * runner is over an obstacle or under one.
 */
export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 240;
/**
 * The ground line, measured from the top of the board. The sky above it is
 * two jumps deep: a high bird has to be readable well before the runner is
 * under it, and a jump must never leave the frame.
 */
export const GROUND_Y = 202;

/** The runner never moves along the track; the world moves past it (§1). */
export const RUNNER_X = 44;
/** The drawn runner exactly: 19×20 cells of art at 2px (ui/components/sprites.ts). */
export const RUNNER_WIDTH = 38;
export const RUNNER_HEIGHT = 40;
/** Ducking is wider and half as tall — the whole point of the pose (§3). */
export const DUCK_WIDTH = 44;
export const DUCK_HEIGHT = 22;

/**
 * The jump, in the two numbers that decide it: it rises 97px and is in the
 * air for 0.61s. Everything else — how far a jump carries, how wide a gap has
 * to be to be fair — falls out of those (§4).
 */
export const GRAVITY = 2100;
export const JUMP_VELOCITY = 640;
/** Ducking in mid-air drops the runner instead of ducking (§3). */
export const FAST_FALL_GRAVITY = GRAVITY * 2.8;

export const START_SPEED = 200;
export const MAX_SPEED = 460;
/** Added to the speed per second of running: the only difficulty curve (§5). */
export const SPEED_GAIN = 5.5;

/** Board pixels per point. Score is distance and nothing else (§6). */
export const PX_PER_POINT = 18;
/** Every this many points the score flashes — a landmark, never a reward (§6). */
export const MILESTONE_EVERY = 100;

/**
 * Collision forgiveness, inset on the runner's box only. A hit has to look
 * like a hit; a pixel of overlap between two drawn shapes does not (§7).
 */
export const HIT_INSET = 3;

/** Birds join the track once the run is worth this much (§5). */
export const BIRD_FROM_SCORE = 200;
/** The three-cactus wall needs a longer run-up than the openings give (§5). */
export const WIDE_CACTUS_FROM_SCORE = 120;

/**
 * The gap to the next obstacle, in seconds of running rather than pixels: a
 * gap that is fair at 200px/s and impossible at 460px/s is not a gap, it is a
 * countdown to an unavoidable death. Seconds keep the same choice available
 * at every speed (§5).
 *
 * The minimum is longer than one jump (0.61s), so an obstacle can never enter
 * while the runner is committed to clearing the one before it.
 */
export const MIN_GAP_SECONDS = 0.78;
export const MAX_GAP_SECONDS = 1.7;
/**
 * The room left behind a high bird. It is harmless while the runner stays on
 * the ground, so the thing to prevent is having to jump — for whatever comes
 * next — while it is still overhead (§5).
 */
export const HIGH_BIRD_MIN_GAP_SECONDS = 1.1;
