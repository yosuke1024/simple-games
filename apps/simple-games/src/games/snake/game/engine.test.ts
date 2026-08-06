import { describe, expect, it } from 'vitest';
import {
  CELL_COUNT,
  GRID_SIZE,
  MAX_STEPS_PER_SECOND,
  STARTING_LENGTH,
  TURN_QUEUE_LIMIT,
} from './constants';
import {
  createInitialState,
  foodValue,
  queueTurn,
  step,
  stepIntervalMs,
  stepsPerSecond,
} from './engine';
import { samePoint, type GameState, type Point } from './types';

/** Advances exactly one cell of travel, whatever the current speed is. */
function oneStep(state: GameState): GameState {
  return step(state, stepIntervalMs(state.eaten));
}

function stepMany(state: GameState, count: number): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = oneStep(next);
  return next;
}

/** A board with the snake laid out by hand and the food parked out of the way. */
function board(snake: readonly Point[], overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState('test'),
    snake,
    food: { x: GRID_SIZE - 1, y: GRID_SIZE - 1 },
    ...overrides,
  };
}

describe('the speed curve (§5)', () => {
  it('rises for every single piece of food from 0 to 99 — nothing saturates early', () => {
    for (let eaten = 0; eaten < 100; eaten++) {
      expect(stepsPerSecond(eaten + 1), `food ${eaten + 1}`).toBeGreaterThan(stepsPerSecond(eaten));
    }
    expect(stepsPerSecond(0)).toBeLessThan(MAX_STEPS_PER_SECOND);
    expect(stepsPerSecond(99)).toBeLessThan(MAX_STEPS_PER_SECOND);
  });

  it('reaches its ceiling at the 100th and stays there', () => {
    expect(stepsPerSecond(100)).toBe(MAX_STEPS_PER_SECOND);
    expect(stepsPerSecond(500)).toBe(MAX_STEPS_PER_SECOND);
    // The interval is the curve read the other way round; nothing else uses it.
    expect(stepIntervalMs(100)).toBeCloseTo(1000 / MAX_STEPS_PER_SECOND, 10);
    expect(stepIntervalMs(0)).toBeGreaterThan(stepIntervalMs(50));
  });
});

describe('scoring (§5)', () => {
  it('steps up one point every ten pieces of food', () => {
    expect(foodValue(0)).toBe(1);
    expect(foodValue(9)).toBe(1);
    expect(foodValue(10)).toBe(2);
    expect(foodValue(19)).toBe(2);
    expect(foodValue(20)).toBe(3);
    expect(foodValue(99)).toBe(10);
  });
});

describe('turning (§3)', () => {
  it('opens length three, at the centre, facing right', () => {
    const state = createInitialState('test');
    expect(state.snake).toHaveLength(STARTING_LENGTH);
    expect(state.direction).toBe('right');
    expect(state.snake[0]).toEqual({ x: 7, y: 7 });
    expect(state.status).toBe('playing');
    // One piece of food, and never under the snake.
    expect(state.snake.some((s) => samePoint(s, state.food))).toBe(false);
  });

  it('ignores a 180° reversal instead of killing the player for a slip', () => {
    const state = createInitialState('test');
    expect(queueTurn(state, 'left')).toBe(state);
    // ...and against the last *queued* turn, not the one on screen: after
    // queueing "up" the snake is already committed to it.
    const turned = queueTurn(state, 'up');
    expect(turned.queue).toEqual(['up']);
    expect(queueTurn(turned, 'down')).toBe(turned);
  });

  it('honours two queued turns one per step, and drops a third', () => {
    let state = createInitialState('test');
    state = queueTurn(state, 'up');
    state = queueTurn(state, 'left');
    expect(state.queue).toHaveLength(TURN_QUEUE_LIMIT);

    const overflowed = queueTurn(state, 'down');
    expect(overflowed).toBe(state);

    state = oneStep(state);
    expect(state.direction).toBe('up');
    expect(state.queue).toEqual(['left']);
    state = oneStep(state);
    expect(state.direction).toBe('left');
    expect(state.queue).toEqual([]);
  });
});

describe('movement (§4)', () => {
  it('lets the head enter the cell the tail is vacating', () => {
    // A 2x2 coil: turning down puts the head exactly where the tail is now,
    // and the tail leaves on the same step. This is the tight turn §4 exists
    // to protect.
    const state = board(
      [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
      ],
      { direction: 'right' },
    );
    const turned = oneStep(queueTurn(state, 'down'));
    expect(turned.status).toBe('playing');
    expect(turned.snake[0]).toEqual({ x: 5, y: 6 });
  });

  it('ends the run at a wall', () => {
    const state = board([
      { x: GRID_SIZE - 1, y: 3 },
      { x: GRID_SIZE - 2, y: 3 },
      { x: GRID_SIZE - 3, y: 3 },
    ]);
    const dead = oneStep(state);
    expect(dead.status).toBe('over');
    // A settled board is final: stepping it again changes nothing.
    expect(step(dead, 1000)).toBe(dead);
  });

  it('ends the run on its own body', () => {
    // A coil whose sixth segment sits directly in front of the head — far
    // enough from the tail that nothing is vacating it this step.
    const state = board(
      [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ],
      { direction: 'right' },
    );
    expect(oneStep(state).status).toBe('over');
  });

  it('keeps the pace across uneven frames instead of dropping the remainder', () => {
    const state = createInitialState('test');
    const interval = stepIntervalMs(0);
    // Two half-steps make one whole one; the leftover is carried, not lost.
    const half = step(state, interval * 0.6);
    expect(half.snake[0]).toEqual(state.snake[0]);
    expect(step(half, interval * 0.6).snake[0]).toEqual({ x: 8, y: 7 });
  });
});

describe('food (§6)', () => {
  it('grows the snake by one and puts the next meal on an empty cell', () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const state = board(snake, { food: { x: 6, y: 5 }, direction: 'right' });
    const fed = oneStep(state);

    expect(fed.snake).toHaveLength(snake.length + 1);
    expect(fed.snake[0]).toEqual({ x: 6, y: 5 });
    // The tail stayed put — that is what growing is.
    expect(fed.snake[fed.snake.length - 1]).toEqual({ x: 3, y: 5 });
    expect(fed.eaten).toBe(1);
    expect(fed.score).toBe(foodValue(0));
    expect(fed.snake.some((s) => samePoint(s, fed.food))).toBe(false);
  });

  it('draws the same cell for the same seed and meal count', () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const eat = (seed: string) =>
      oneStep(board(snake, { seed, food: { x: 6, y: 5 }, direction: 'right' })).food;

    expect(eat('same')).toEqual(eat('same'));
    expect(eat('other')).not.toEqual(eat('same'));
    // A different meal count on the same seed is a different draw.
    expect(createInitialState('same').food).not.toEqual(eat('same'));
  });

  it('spreads the meals over the board rather than favouring one corner', () => {
    const cells = new Set<string>();
    for (let meal = 0; meal < 60; meal++) {
      const state = createInitialState(`spread-${meal}`);
      cells.add(`${state.food.x},${state.food.y}`);
    }
    expect(cells.size).toBeGreaterThan(40);
  });
});

describe('the whole board (§2)', () => {
  it('reports the clear when the body fills all 225 cells', () => {
    // A boustrophedon that covers every cell but one, with the food in the
    // hole the head is one step away from.
    const snake: Point[] = [];
    for (let y = GRID_SIZE - 1; y >= 0; y--) {
      for (let i = 0; i < GRID_SIZE; i++) {
        const x = y % 2 === 0 ? i : GRID_SIZE - 1 - i;
        snake.push({ x, y });
      }
    }
    // Drop the cell in front of the head so the run has one meal left to take.
    const full = snake.slice(1);
    const state = board(full, { food: snake[0]!, direction: 'left' });
    expect(state.snake).toHaveLength(CELL_COUNT - 1);

    const cleared = oneStep(state);
    expect(cleared.snake).toHaveLength(CELL_COUNT);
    expect(cleared.status).toBe('full');
    expect(step(cleared, 1000)).toBe(cleared);
  });
});

describe('a run end to end', () => {
  it('runs into the right-hand wall from the opening board', () => {
    // Seven cells of clearance from the centre, so the eighth step is the wall.
    const state = stepMany(createInitialState('test'), GRID_SIZE);
    expect(state.status).toBe('over');
  });
});
