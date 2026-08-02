import { describe, expect, it } from 'vitest';
import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DESCENT_LINE_Y,
  MAX_BALLS,
  PADDLE_Y,
  STARTING_LIVES,
} from './constants';
import {
  createInitialState,
  launchBall,
  movePaddleBy,
  paddleWidth,
  setPaddleCenterX,
  step,
  wallReachedLine,
} from './engine';
import { buildBricks } from './generator';
import { ballSpeed, LEVEL_COUNT, levelSpec } from './levels';
import type { Ball, GameState } from './types';

const STEP_MS = 1000 / 120;

function stepMany(state: GameState, count: number, dtMs = STEP_MS): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = step(next, dtMs);
  return next;
}

function launched(x: number, y: number, dx: number, dy: number): Ball {
  return { x, y, dx, dy, status: 'launched' };
}

describe('block-breaker levels', () => {
  it('difficulty keeps climbing all the way to level 100 — nothing saturates early', () => {
    for (const [a, b] of [
      [1, 25],
      [25, 50],
      [50, 75],
      [75, LEVEL_COUNT],
    ] as const) {
      const low = levelSpec(a);
      const high = levelSpec(b);
      expect(high.density).toBeGreaterThan(low.density);
      expect(high.baseSpeed).toBeGreaterThan(low.baseSpeed);
      expect(high.speedPerBrick).toBeGreaterThan(low.speedPerBrick);
      expect(high.paddleWidth).toBeLessThan(low.paddleWidth);
      expect(high.descentSpeed).toBeGreaterThan(low.descentSpeed);
      expect(high.rows).toBeGreaterThanOrEqual(low.rows);
    }
    expect(levelSpec(LEVEL_COUNT).rows).toBeGreaterThan(levelSpec(1).rows);
  });

  it('inside a level the ball only ever gets faster', () => {
    for (const level of [1, 50, LEVEL_COUNT]) {
      const start = ballSpeed(level, 0);
      const mid = ballSpeed(level, 10);
      const late = ballSpeed(level, 30);
      expect(mid).toBeGreaterThan(start);
      expect(late).toBeGreaterThan(mid);
      expect(late).toBeLessThanOrEqual(levelSpec(level).maxSpeed);
    }
  });

  it('level bounds are clamped rather than extrapolated', () => {
    expect(levelSpec(0)).toEqual(levelSpec(1));
    expect(levelSpec(999)).toEqual(levelSpec(LEVEL_COUNT));
  });
});

describe('block-breaker generator', () => {
  it('the same seed and level build the same board', () => {
    expect(buildBricks('a', 5)).toEqual(buildBricks('a', 5));
    expect(buildBricks('b', 5)).not.toEqual(buildBricks('a', 5));
    expect(buildBricks('a', 6)).not.toEqual(buildBricks('a', 5));
  });

  it('every board is non-empty, on-board, and carries its ball bricks', () => {
    for (let level = 1; level <= LEVEL_COUNT; level += 7) {
      const bricks = buildBricks('gen', level);
      expect(bricks.length).toBeGreaterThan(0);
      for (const brick of bricks) {
        expect(brick.x).toBeGreaterThanOrEqual(0);
        expect(brick.x + brick.width).toBeLessThanOrEqual(BOARD_WIDTH + 0.001);
        expect(brick.alive).toBe(true);
      }
      expect(bricks.filter((b) => b.kind === 'ball')).toHaveLength(levelSpec(level).ballBricks);
    }
  });

  it('boards are mirror-symmetric, so an angle is worth aiming at', () => {
    const bricks = buildBricks('sym', 40);
    const centre = BOARD_WIDTH / 2;
    for (const brick of bricks) {
      const mirroredX = centre + (centre - (brick.x + brick.width));
      const partner = bricks.find((b) => Math.abs(b.x - mirroredX) < 0.001 && b.y === brick.y);
      expect(partner).toBeDefined();
    }
  });
});

describe('block-breaker engine', () => {
  it('a center-paddle hit sends the ball straight back up', () => {
    let state = createInitialState('test', 1);
    state = setPaddleCenterX(state, BOARD_WIDTH / 2);
    // Keep the real board: the bricks sit near the top and the ball near the
    // paddle, so they never interact — and an empty board would count as
    // cleared before the bounce could happen.
    state = { ...state, balls: [launched(BOARD_WIDTH / 2, PADDLE_Y - 40, 0, 260)] };
    state = stepMany(state, 20);
    expect(state.balls[0]!.dx).toBeCloseTo(0, 5);
    expect(state.balls[0]!.dy).toBeLessThan(0);
  });

  it('hitting the paddle edge deflects the ball toward that edge', () => {
    let state = createInitialState('test', 1);
    const paddleX = BOARD_WIDTH / 2;
    state = setPaddleCenterX(state, paddleX);
    const hitX = paddleX + paddleWidth(state) / 2 - 2;
    state = { ...state, balls: [launched(hitX, PADDLE_Y - 20, 0, 260)] };
    state = stepMany(state, 20);
    expect(state.balls[0]!.dx).toBeGreaterThan(0);
    expect(state.balls[0]!.dy).toBeLessThan(0);
  });

  it('launch only fires a ready ball, and only upward', () => {
    const ready = createInitialState('test', 1);
    const fired = launchBall(ready);
    expect(fired.balls[0]!.status).toBe('launched');
    expect(fired.balls[0]!.dy).toBeLessThan(0);
    expect(fired.balls[0]!.dx).toBe(0);
    expect(launchBall(fired)).toBe(fired);
  });

  it('a wall hit flips the horizontal direction and keeps the ball in bounds', () => {
    let state = createInitialState('test', 1);
    state = { ...state, balls: [launched(BALL_RADIUS + 1, 300, -260, -50)] };
    state = step(state, 1000 / 60);
    expect(state.balls[0]!.dx).toBeGreaterThan(0);
    expect(state.balls[0]!.x).toBeGreaterThanOrEqual(BALL_RADIUS);
  });

  it('breaking a brick removes exactly one, reverses the ball, and speeds it up', () => {
    let state = createInitialState('test', 1);
    const brick = state.bricks.find((b) => b.kind === 'normal')!;
    const before = state.bricks.filter((b) => b.alive).length;
    state = {
      ...state,
      balls: [
        launched(
          brick.x + brick.width / 2,
          brick.y + brick.height + BALL_RADIUS - 1,
          0,
          -ballSpeed(1, 0),
        ),
      ],
    };
    const speedBefore = Math.hypot(state.balls[0]!.dx, state.balls[0]!.dy);
    state = step(state, 1000 / 60);
    expect(state.bricks.filter((b) => b.alive).length).toBe(before - 1);
    expect(state.broken).toBe(1);
    expect(state.balls[0]!.dy).toBeGreaterThan(0);
    expect(Math.hypot(state.balls[0]!.dx, state.balls[0]!.dy)).toBeGreaterThan(speedBefore);
  });

  it('a ball brick releases a second ball', () => {
    let state = createInitialState('test', 1);
    const brick = state.bricks.find((b) => b.kind === 'ball')!;
    state = {
      ...state,
      balls: [
        launched(brick.x + brick.width / 2, brick.y + brick.height + BALL_RADIUS - 1, 0, -260),
      ],
    };
    state = step(state, 1000 / 60);
    expect(state.balls).toHaveLength(2);
    expect(state.balls.every((b) => b.status === 'launched')).toBe(true);
  });

  it('the ball count is capped', () => {
    let state = createInitialState('test', 1);
    const brick = state.bricks.find((b) => b.kind === 'ball')!;
    const extras: Ball[] = Array.from({ length: MAX_BALLS - 1 }, (_, i) =>
      launched(20 + i * 10, 300, 0, -200),
    );
    state = {
      ...state,
      balls: [
        ...extras,
        launched(brick.x + brick.width / 2, brick.y + brick.height + BALL_RADIUS - 1, 0, -260),
      ],
    };
    expect(state.balls).toHaveLength(MAX_BALLS);
    state = step(state, 1000 / 60);
    expect(state.balls).toHaveLength(MAX_BALLS);
  });

  it('losing one ball of several costs no life', () => {
    let state = createInitialState('test', 1);
    state = {
      ...state,
      bricks: state.bricks,
      balls: [launched(180, BOARD_HEIGHT + BALL_RADIUS - 1, 0, 400), launched(100, 300, 0, -200)],
      lives: STARTING_LIVES,
    };
    state = step(state, 1000 / 60);
    expect(state.balls).toHaveLength(1);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.status).toBe('playing');
  });

  it('losing the last ball costs a life and re-arms on the paddle', () => {
    let state = createInitialState('test', 1);
    state = {
      ...state,
      balls: [launched(180, BOARD_HEIGHT + BALL_RADIUS - 1, 0, 400)],
      lives: STARTING_LIVES,
    };
    state = step(state, 1000 / 60);
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.balls).toHaveLength(1);
    expect(state.balls[0]!.status).toBe('ready');
    expect(state.status).toBe('playing');
  });

  it('losing the last life fails the level', () => {
    let state = createInitialState('test', 1);
    state = { ...state, balls: [launched(180, BOARD_HEIGHT + BALL_RADIUS - 1, 0, 400)], lives: 1 };
    state = step(state, 1000 / 60);
    expect(state.status).toBe('failed');
    expect(step(state, STEP_MS)).toBe(state);
  });

  it('clearing every brick clears the level', () => {
    let state = createInitialState('test', 1);
    const last = state.bricks[0]!;
    state = {
      ...state,
      bricks: state.bricks.map((brick, i) => (i === 0 ? brick : { ...brick, alive: false })),
      balls: [launched(last.x + last.width / 2, last.y + last.height + BALL_RADIUS - 1, 0, -260)],
    };
    state = step(state, 1000 / 60);
    expect(state.status).toBe('cleared');
    expect(step(state, STEP_MS)).toBe(state);
  });

  it('the paddle is clamped to the board and carries a ready ball with it', () => {
    let state = createInitialState('test', 1);
    const half = paddleWidth(state) / 2;
    state = setPaddleCenterX(state, -500);
    expect(state.paddleX).toBeCloseTo(half, 5);
    expect(state.balls[0]!.x).toBeCloseTo(half, 5);
    state = movePaddleBy(state, 10000);
    expect(state.paddleX).toBeCloseTo(BOARD_WIDTH - half, 5);
  });

  it('every level starts with one ball, full lives and an undropped wall', () => {
    for (const level of [1, 50, LEVEL_COUNT]) {
      const state = createInitialState('a', level);
      expect(state.balls).toHaveLength(1);
      expect(state.broken).toBe(0);
      expect(state.descent).toBe(0);
      expect(state.lives).toBe(STARTING_LIVES);
    }
  });

  it('the wall creeps down while the level runs', () => {
    const state = stepMany(createInitialState('test', 1), 120);
    expect(state.descent).toBeGreaterThan(0);
  });

  it('a wall that reaches the line fails the level outright', () => {
    const start = createInitialState('test', 1);
    const lowest = Math.max(...start.bricks.map((b) => b.y + b.height));
    // One step short of the line, then over it.
    const nearly = { ...start, descent: DESCENT_LINE_Y - lowest - 1 };
    expect(wallReachedLine(nearly.bricks, nearly.descent)).toBe(false);
    // Level 1 creeps at a few pixels a second, so cover a full second.
    const state = stepMany(nearly, 120);
    expect(state.status).toBe('failed');
  });

  it('broken bricks do not hold the line — only surviving ones can fail you', () => {
    const start = createInitialState('test', 1);
    const lowest = Math.max(...start.bricks.map((b) => b.y + b.height));
    const dead = start.bricks.map((b) => ({ ...b, alive: b.y + b.height < lowest }));
    expect(wallReachedLine(dead, DESCENT_LINE_Y - lowest + 5)).toBe(false);
  });

  it('losing a ball buys no time — the wall keeps coming', () => {
    let state = createInitialState('test', 1);
    state = {
      ...state,
      balls: [launched(180, BOARD_HEIGHT + BALL_RADIUS - 1, 0, 400)],
      lives: STARTING_LIVES,
    };
    const before = state.descent;
    state = step(state, 1000 / 60);
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.descent).toBeGreaterThan(before);
  });

  it('a descended brick is still hittable where it now sits', () => {
    const start = createInitialState('test', 1);
    const brick = start.bricks.find((b) => b.kind === 'normal')!;
    const descent = 40;
    const state = step(
      {
        ...start,
        descent,
        balls: [
          launched(
            brick.x + brick.width / 2,
            brick.y + descent + brick.height + BALL_RADIUS - 1,
            0,
            -260,
          ),
        ],
      },
      1000 / 60,
    );
    expect(state.broken).toBe(1);
  });
});
