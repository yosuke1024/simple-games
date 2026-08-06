/**
 * Golden meals: the first four of a run on seed `snake-golden`, pinned exactly.
 *
 * There are no levels to promise here (§7), so what a Snake seed fixes is
 * where the food appears. Any change to the rng, to the way an empty cell is
 * drawn, or to the order the board is scanned in will fail this test, which is
 * the point: it has to be a decision rather than a side effect.
 *
 * This pins released behaviour. Do not edit the literals to go green — if a
 * change here is intended, regenerate them and say so in the commit message,
 * along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, queueTurn, step, stepIntervalMs } from './engine';
import { GRID_SIZE } from './constants';
import { DIRECTION_DELTA, opposite, samePoint, type Direction, type GameState } from './types';

const CANDIDATES: readonly Direction[] = ['right', 'down', 'left', 'up'];

/**
 * A deliberately dumb autopilot: close the horizontal gap, then the vertical
 * one, and take the first direction that is neither a reversal nor a wall or a
 * body. Fixed and total, so the run below is one exact board every time —
 * which is what makes the meals it eats a golden rather than a sample.
 */
function autopilot(state: GameState): Direction {
  const head = state.snake[0]!;
  const dx = state.food.x - head.x;
  const dy = state.food.y - head.y;
  const wanted: Direction[] = [];
  if (dx !== 0) wanted.push(dx > 0 ? 'right' : 'left');
  if (dy !== 0) wanted.push(dy > 0 ? 'down' : 'up');

  const body = state.snake.slice(0, state.snake.length - 1);
  for (const direction of [...wanted, ...CANDIDATES]) {
    if (direction === opposite(state.direction)) continue;
    const delta = DIRECTION_DELTA[direction];
    const next = { x: head.x + delta.x, y: head.y + delta.y };
    if (next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE) continue;
    if (body.some((segment) => samePoint(segment, next))) continue;
    return direction;
  }
  return state.direction;
}

/** The cells the run is fed at, in order, starting with the opening meal. */
function firstMeals(seed: string, count: number): string[] {
  let state = createInitialState(seed);
  const meals = [`${state.food.x},${state.food.y}`];
  // Generous but finite: a straight walk to each meal takes well under this.
  for (let guard = 0; guard < 2000 && meals.length < count; guard++) {
    if (state.status !== 'playing') break;
    const before = state.eaten;
    state = step(queueTurn(state, autopilot(state)), stepIntervalMs(state.eaten));
    if (state.eaten > before) meals.push(`${state.food.x},${state.food.y}`);
  }
  return meals;
}

describe('meals that must never change', () => {
  it('seed snake-golden feeds the same four cells it always has', () => {
    expect(firstMeals('snake-golden', 4)).toEqual(['8,10', '1,14', '10,13', '8,8']);
  });
});
