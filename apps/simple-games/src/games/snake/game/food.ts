/**
 * Where the next food goes (docs/SNAKE_RULES.md §8).
 *
 * The n-th food of a run (n = 0 is the one on the board before the first move)
 * takes the first value r of `createRng(`${seed}:food:${n}`)` and lands on the
 * floor(r × free)-th free cell in row-major order, where `free` is the number
 * of cells the snake is not on. Uniform over the free cells, never under the
 * snake, and decided by (seed, n) and the body alone — which is why a saved
 * run carries its random state in two numbers it already has (§11).
 *
 * There is no retry loop to bound: the draw is one pass over the board, so its
 * work is fixed by construction (§8, `FOOD_DRAW_WORK_LIMIT`).
 */
import { createRng } from './rng';
import { CELL_COUNT } from './types';

/** The rng stream of the n-th food. Kept apart from anything else a seed might ever drive. */
export const foodSeed = (seed: string, drawIndex: number): string => `${seed}:food:${drawIndex}`;

/**
 * The most steps a draw can take: one mark per body cell (at most CELL_COUNT −
 * 1, since a full board draws nothing) plus one pass over the board. A bound
 * the code cannot exceed rather than a budget it checks; `drawFoodCounted`
 * reports the steps actually taken so a test can hold it to this.
 */
export const FOOD_DRAW_WORK_LIMIT = 2 * CELL_COUNT - 1;

export interface FoodDraw {
  /** The cell, or -1 when the snake covers the whole board. */
  readonly cell: number;
  /** Steps taken: body cells marked plus board cells visited. */
  readonly work: number;
}

/** `drawFood`, with its work counted (§8, §17). */
export function drawFoodCounted(
  seed: string,
  drawIndex: number,
  body: readonly number[],
): FoodDraw {
  const occupied = new Uint8Array(CELL_COUNT);
  let work = 0;
  for (const cell of body) {
    occupied[cell] = 1;
    work++;
  }
  const free = CELL_COUNT - body.length;
  if (free <= 0) return { cell: -1, work };

  const pick = Math.floor(createRng(foodSeed(seed, drawIndex))() * free);
  let seen = 0;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    work++;
    if (occupied[cell] === 1) continue;
    if (seen === pick) return { cell, work };
    seen++;
  }
  // Unreachable while `body` holds distinct cells (pick < free); a body that
  // does not is refused long before it gets here (engine.ts `isValidBody`).
  return { cell: -1, work };
}

/** The n-th food of a run for this body: a free cell, or -1 when there is none (§8). */
export function drawFood(seed: string, drawIndex: number, body: readonly number[]): number {
  return drawFoodCounted(seed, drawIndex, body).cell;
}
