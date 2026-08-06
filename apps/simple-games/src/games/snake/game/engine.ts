/**
 * The Snake simulation (docs/SNAKE_RULES.md §1–§6). Pure TypeScript: no React,
 * no storage, no platform — the view in ui/components/SnakeBoard.tsx only
 * feeds it milliseconds and draws whatever comes back.
 */
import {
  BASE_STEPS_PER_SECOND,
  BOARD_SEED,
  CELL_COUNT,
  GRID_SIZE,
  MAX_STEPS_PER_SECOND,
  SCORE_BAND,
  STARTING_LENGTH,
  STEPS_PER_SECOND_PER_FOOD,
  TURN_QUEUE_LIMIT,
} from './constants';
import { createRng } from './rng';
import {
  DIRECTION_DELTA,
  opposite,
  samePoint,
  type Direction,
  type GameState,
  type Point,
} from './types';

/**
 * Grid steps per second after `eaten` pieces of food (§5). Continuous, never
 * flat before the ceiling: the difficulty of this game is the player's own
 * length plus this line, and a level ladder would only cut it into stairs (§7).
 */
export function stepsPerSecond(eaten: number): number {
  const meals = Math.max(0, eaten);
  return Math.min(MAX_STEPS_PER_SECOND, BASE_STEPS_PER_SECOND + meals * STEPS_PER_SECOND_PER_FOOD);
}

/** How long one cell of travel takes, in milliseconds. */
export function stepIntervalMs(eaten: number): number {
  return 1000 / stepsPerSecond(eaten);
}

/**
 * What the `index`-th piece of food (0-based) is worth (§5). Living longer
 * makes a single meal heavier, so the score is not a restatement of the
 * length — two runs of the same length can end on very different numbers.
 */
export function foodValue(index: number): number {
  return 1 + Math.floor(Math.max(0, index) / SCORE_BAND);
}

const cellIndex = (point: Point): number => point.y * GRID_SIZE + point.x;

/**
 * Uniform over the empty cells, drawn from a stream keyed by seed and meal
 * count (§6). Deriving the stream per meal rather than carrying one generator
 * in the state keeps the state a plain value: two boards that look the same
 * really are the same, whatever route each took to get there.
 *
 * Returns null only when the board is full — the caller reads that as the
 * clear (§2) rather than as an error.
 */
function spawnFood(seed: string, eaten: number, snake: readonly Point[]): Point | null {
  const taken = new Set(snake.map(cellIndex));
  const empty: number[] = [];
  for (let index = 0; index < CELL_COUNT; index++) {
    if (!taken.has(index)) empty.push(index);
  }
  if (empty.length === 0) return null;
  const rng = createRng(`${seed}:${eaten}`);
  const picked = empty[Math.min(empty.length - 1, Math.floor(rng() * empty.length))]!;
  return { x: picked % GRID_SIZE, y: Math.floor(picked / GRID_SIZE) };
}

export function createInitialState(seed = BOARD_SEED): GameState {
  // The head sits on the middle cell with the body trailing to its left, so
  // the opening move — straight ahead — has the most room in front of it.
  const centre = Math.floor(GRID_SIZE / 2);
  const snake: Point[] = [];
  for (let i = 0; i < STARTING_LENGTH; i++) snake.push({ x: centre - i, y: centre });
  return {
    seed,
    snake,
    direction: 'right',
    queue: [],
    // Three cells of 225 are taken, so the draw always finds room; the
    // fallback exists only because the shared helper is honest about the one
    // board where it cannot.
    food: spawnFood(seed, 0, snake) ?? { x: 0, y: 0 },
    eaten: 0,
    score: 0,
    status: 'playing',
    elapsedMs: 0,
  };
}

/**
 * Accepts a turn (§3). The reversal test is against the *last queued* turn
 * rather than the direction on screen: after queueing "up" the snake is
 * already committed to going up, so "down" is the 180° that must be dropped
 * even though the snake is still visibly travelling right.
 *
 * A turn that repeats the direction already committed is dropped too. It
 * would change nothing on the board while spending one of the two slots that
 * exist for turns that do.
 */
export function queueTurn(state: GameState, direction: Direction): GameState {
  if (state.status !== 'playing') return state;
  if (state.queue.length >= TURN_QUEUE_LIMIT) return state;
  const last = state.queue.length > 0 ? state.queue[state.queue.length - 1]! : state.direction;
  if (direction === last || direction === opposite(last)) return state;
  return { ...state, queue: [...state.queue, direction] };
}

/** One cell of travel: the whole of §4 in one function. */
function advance(state: GameState): GameState {
  // Exactly one queued turn is spent per grid step, so two flicks inside one
  // step become two corners rather than one (§3).
  const direction = state.queue[0] ?? state.direction;
  const queue = state.queue.length > 0 ? state.queue.slice(1) : state.queue;
  const moved = { ...state, direction, queue };

  const head = state.snake[0]!;
  const delta = DIRECTION_DELTA[direction];
  const next: Point = { x: head.x + delta.x, y: head.y + delta.y };

  // Outside is wall, never a wrap-around (§1, §13).
  if (next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE) {
    return { ...moved, status: 'over' };
  }

  const eats = samePoint(next, state.food);
  // Collision is tested against the body as it will be *after* the tail
  // moves. The cell the tail is vacating is free by the time the head gets
  // there, and calling that a crash would kill exactly the tight turns a good
  // player is aiming for (§4). Eating is the case where the tail stays put,
  // so there the whole body counts.
  const body = eats ? state.snake : state.snake.slice(0, state.snake.length - 1);
  if (body.some((segment) => samePoint(segment, next))) {
    return { ...moved, status: 'over' };
  }

  const snake = [next, ...body];
  if (!eats) return { ...moved, snake };

  const eaten = state.eaten + 1;
  const score = state.score + foodValue(state.eaten);
  const food = spawnFood(state.seed, eaten, snake);
  if (food === null) {
    // Every one of the 225 cells is body. Nobody realistically gets here, but
    // a board with no ending would be a board this document could not describe
    // honestly (§2).
    return { ...moved, snake, eaten, score, status: 'full' };
  }
  return { ...moved, snake, eaten, score, food };
}

/**
 * Advances the board by `dtMs` of real time, one whole cell at a time (§4).
 *
 * The interval is re-read after every cell so a meal speeds up the steps that
 * follow it within the same call — at 17.5 steps per second a slow frame can
 * legitimately carry more than one.
 */
export function step(state: GameState, dtMs: number): GameState {
  if (state.status !== 'playing') return state;
  let next = state;
  let elapsed = state.elapsedMs + Math.max(0, dtMs);
  while (next.status === 'playing' && elapsed >= stepIntervalMs(next.eaten)) {
    elapsed -= stepIntervalMs(next.eaten);
    next = advance(next);
  }
  return { ...next, elapsedMs: elapsed };
}
