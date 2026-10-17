/**
 * Core Snake types and the numbers the game is made of. See
 * docs/SNAKE_RULES.md — the single source of truth for the rules these shapes
 * serve; comments cite it by section.
 *
 * The board is a fixed square of cells, numbered row-major from the top-left
 * (§1). A cell is a plain integer and the snake is the list of the cells it
 * covers, head first — no coordinates objects, no identity, nothing that a
 * saved run could not spell back exactly (§11).
 */

/**
 * 14×14, and only 14×14 (§1). Even by even, which is what guarantees a full
 * board is reachable on every seed (§4): such a grid has a cycle through every
 * cell, and a snake following it can never be trapped.
 */
export const BOARD_SIZE = 14;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export type Direction = 'up' | 'down' | 'left' | 'right';
export const DIRECTIONS: readonly Direction[] = Object.freeze(['up', 'down', 'left', 'right']);

export const isDirection = (value: unknown): value is Direction =>
  value === 'up' || value === 'down' || value === 'left' || value === 'right';

export const OPPOSITE: Readonly<Record<Direction, Direction>> = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
});

/** True when `b` would turn the snake straight back on itself from `a` (§5). */
export const isReverse = (a: Direction, b: Direction): boolean => OPPOSITE[a] === b;

/**
 * The three tick intervals (§7). Constant for the whole run — the snake never
 * speeds up — and the only thing that differs between the three: board, food
 * and rules are the same at every speed.
 */
export type Speed = 'slow' | 'normal' | 'fast';
export const SPEEDS: readonly Speed[] = Object.freeze(['slow', 'normal', 'fast']);
export const DEFAULT_SPEED: Speed = 'normal';

export const isSpeed = (value: unknown): value is Speed =>
  value === 'slow' || value === 'normal' || value === 'fast';

export const TICK_MS: Readonly<Record<Speed, number>> = Object.freeze({
  slow: 220,
  normal: 150,
  fast: 100,
});

/** Cells per row and per column, read back from an index. */
export const rowOf = (cell: number): number => Math.floor(cell / BOARD_SIZE);
export const colOf = (cell: number): number => cell % BOARD_SIZE;
export const cellAt = (row: number, col: number): number => row * BOARD_SIZE + col;

export const isCell = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CELL_COUNT;

/**
 * The opening snake (§2): three cells lying along row 6 (the upper of the two
 * middle rows), tail at column 2, head at column 4, facing right — head first,
 * like every body in this game.
 *
 * Frozen, like every constant table in this file: every fresh run's body *is*
 * this array (`createSession`), and the restore check replays from it (§11),
 * so one stray in-place change from a caller would corrupt every later run.
 * `readonly` alone only stops the type checker, not a cast.
 */
export const INITIAL_LENGTH = 3;
export const INITIAL_DIRECTION: Direction = 'right';
export const INITIAL_BODY: readonly number[] = Object.freeze([
  cellAt(6, 4),
  cellAt(6, 3),
  cellAt(6, 2),
]);
export const INITIAL_HEAD = INITIAL_BODY[0]!;

/** One point per food, so the highest score is the board filled (§4, §7). */
export const MAX_SCORE = CELL_COUNT - INITIAL_LENGTH;

/**
 * How many turns may wait for their ticks (§5). Two make a U-turn and three an
 * S-bend; a fourth would be a press from more than three ticks ahead, no
 * longer a reaction to the board on screen.
 */
export const INPUT_QUEUE_LIMIT = 3;

/**
 * `ready` is the board before the first input: visible, standing still, so
 * opening the game never costs a run (§2, §6). `paused` is the only state a
 * saved run comes back in (§11).
 */
export type RunStatus = 'ready' | 'running' | 'paused' | 'over' | 'cleared';

/** What ended a run that was not a full board (§4). */
export type Crash = 'wall' | 'self';
