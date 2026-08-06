/**
 * The production board seed. Unlike the two other arcade titles there is no
 * level ladder to promise (docs/SNAKE_RULES.md §7) — what this seed fixes is
 * the sequence of food positions, which the golden test in
 * compatibility.test.ts pins. Changing this string moves every meal.
 */
export const BOARD_SEED = 'snake-v1';

/** 15x15 cells of 24px: a 360px board, the same width as the sibling arcades. */
export const GRID_SIZE = 15;
export const CELL = 24;
export const BOARD_WIDTH = GRID_SIZE * CELL;
export const BOARD_HEIGHT = GRID_SIZE * CELL;

/** 225 — the length at which there is nowhere left to grow (§2). */
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export const STARTING_LENGTH = 3;

/**
 * The speed curve (§5). There are no levels, so this is the whole difficulty
 * ladder: every single piece of food makes the snake faster, and the ceiling
 * is placed so that it is not reached before the 100th — a run long enough
 * that nobody meets a flat curve in practice. The engine test pins both ends.
 */
export const BASE_STEPS_PER_SECOND = 5.5;
export const STEPS_PER_SECOND_PER_FOOD = 0.12;
export const MAX_STEPS_PER_SECOND = 17.5;

/**
 * Two turns may wait at once (§3): at speed, a corner is often taken with two
 * flicks inside one grid step, and dropping the second would make the board
 * feel unresponsive exactly when it matters. A third would not improve any
 * corner — it would only let a mistake sit in the queue and happen later.
 */
export const TURN_QUEUE_LIMIT = 2;

/** Food gets worth more in bands of ten (§5): the n-th is 1 + floor(n / 10). */
export const SCORE_BAND = 10;

/** How far a finger must travel before it counts as a turn (§3). */
export const SWIPE_THRESHOLD_PX = 24;
