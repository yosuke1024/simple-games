import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DESCENT_LINE_Y,
  MAX_BALLS,
  MAX_BOUNCE_ANGLE,
  PADDLE_HEIGHT,
  PADDLE_Y,
  STARTING_LIVES,
} from './constants';
import { buildBricks } from './generator';
import { ballSpeed, levelSpec } from './levels';
import type { Ball, Brick, GameState } from './types';

function readyBall(paddleX: number): Ball {
  return { x: paddleX, y: PADDLE_Y - BALL_RADIUS - 1, dx: 0, dy: 0, status: 'ready' };
}

export function paddleWidth(state: GameState): number {
  return levelSpec(state.level).paddleWidth;
}

/** A brick's on-screen top, once the wall's creep is applied. */
export function brickTop(brick: Brick, descent: number): number {
  return brick.y + descent;
}

/** True once any surviving brick has reached the line above the paddle. */
export function wallReachedLine(bricks: readonly Brick[], descent: number): boolean {
  return bricks.some((brick) => brick.alive && brick.y + brick.height + descent >= DESCENT_LINE_Y);
}

export function createInitialState(seed = 'prototype', level = 1): GameState {
  const paddleX = BOARD_WIDTH / 2;
  return {
    seed,
    level,
    paddleX,
    balls: [readyBall(paddleX)],
    bricks: buildBricks(seed, level),
    broken: 0,
    descent: 0,
    lives: STARTING_LIVES,
    status: 'playing',
  };
}

export function setPaddleCenterX(state: GameState, x: number): GameState {
  const half = paddleWidth(state) / 2;
  const clamped = Math.min(BOARD_WIDTH - half, Math.max(half, x));
  const balls = state.balls.map((ball) =>
    ball.status === 'ready' ? { ...ball, x: clamped } : ball,
  );
  return { ...state, paddleX: clamped, balls };
}

export function movePaddleBy(state: GameState, deltaX: number): GameState {
  return setPaddleCenterX(state, state.paddleX + deltaX);
}

export function launchBall(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  if (!state.balls.some((ball) => ball.status === 'ready')) return state;
  const speed = ballSpeed(state.level, state.broken);
  return {
    ...state,
    balls: state.balls.map((ball) =>
      ball.status === 'ready' ? { ...ball, dx: 0, dy: -speed, status: 'launched' } : ball,
    ),
  };
}

function reflectOffPaddle(ball: Ball, paddleX: number, half: number, speed: number): Ball {
  const offset = Math.min(1, Math.max(-1, (ball.x - paddleX) / half));
  const angle = offset * MAX_BOUNCE_ANGLE;
  return {
    ...ball,
    y: PADDLE_Y - BALL_RADIUS,
    dx: speed * Math.sin(angle),
    dy: -speed * Math.cos(angle),
  };
}

// Small ball vs. AABB: reflect whichever axis is nearer the ball center. Not
// exact physics, but stable and reads correctly for a fast-moving point ball.
function resolveBrickCollision(ball: Ball, brick: Brick): Ball {
  const closestX = Math.min(Math.max(ball.x, brick.x), brick.x + brick.width);
  const closestY = Math.min(Math.max(ball.y, brick.y), brick.y + brick.height);
  const overlapX = ball.x - closestX;
  const overlapY = ball.y - closestY;
  if (Math.abs(overlapX) > Math.abs(overlapY)) return { ...ball, dx: -ball.dx };
  return { ...ball, dy: -ball.dy };
}

/** Rescales a ball to the current speed so acceleration reaches balls in flight. */
function withSpeed(ball: Ball, speed: number): Ball {
  const magnitude = Math.hypot(ball.dx, ball.dy);
  if (magnitude === 0) return ball;
  const scale = speed / magnitude;
  return { ...ball, dx: ball.dx * scale, dy: ball.dy * scale };
}

export function step(state: GameState, dtMs: number): GameState {
  if (state.status !== 'playing') return state;
  const dt = dtMs / 1000;
  const half = paddleWidth(state) / 2;

  let bricks = state.bricks;
  let broken = state.broken;
  let lives = state.lives;

  // The wall creeps down whatever else happens — losing a ball does not buy
  // time, which is what stops a level from being stalled.
  const descent = state.descent + levelSpec(state.level).descentSpeed * dt;
  if (wallReachedLine(bricks, descent)) {
    return { ...state, descent, status: 'failed' };
  }
  const spawned: Ball[] = [];
  const survivors: Ball[] = [];

  for (const original of state.balls) {
    if (original.status === 'ready') {
      survivors.push(original);
      continue;
    }

    let ball: Ball = {
      ...original,
      x: original.x + original.dx * dt,
      y: original.y + original.dy * dt,
    };

    if (ball.x - BALL_RADIUS < 0) {
      ball = { ...ball, x: BALL_RADIUS, dx: Math.abs(ball.dx) };
    } else if (ball.x + BALL_RADIUS > BOARD_WIDTH) {
      ball = { ...ball, x: BOARD_WIDTH - BALL_RADIUS, dx: -Math.abs(ball.dx) };
    }
    if (ball.y - BALL_RADIUS < 0) {
      ball = { ...ball, y: BALL_RADIUS, dy: Math.abs(ball.dy) };
    }

    const inPaddleBand =
      ball.y + BALL_RADIUS >= PADDLE_Y && ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT;
    const overPaddle =
      ball.x >= state.paddleX - half - BALL_RADIUS && ball.x <= state.paddleX + half + BALL_RADIUS;
    if (ball.dy > 0 && inPaddleBand && overPaddle) {
      ball = reflectOffPaddle(ball, state.paddleX, half, ballSpeed(state.level, broken));
    }

    const hitIndex = bricks.findIndex(
      (brick) =>
        brick.alive &&
        ball.x + BALL_RADIUS > brick.x &&
        ball.x - BALL_RADIUS < brick.x + brick.width &&
        ball.y + BALL_RADIUS > brickTop(brick, descent) &&
        ball.y - BALL_RADIUS < brickTop(brick, descent) + brick.height,
    );
    if (hitIndex !== -1) {
      const brick = { ...bricks[hitIndex]!, y: brickTop(bricks[hitIndex]!, descent) };
      ball = resolveBrickCollision(ball, brick);
      bricks = bricks.map((entry, i) => (i === hitIndex ? { ...entry, alive: false } : entry));
      broken += 1;
      // The board empties, and the ball gets faster for it.
      ball = withSpeed(ball, ballSpeed(state.level, broken));
      if (brick.kind === 'ball') {
        spawned.push({
          x: brick.x + brick.width / 2,
          y: brick.y + brick.height + BALL_RADIUS,
          dx: -ball.dx,
          dy: Math.abs(ball.dy),
          status: 'launched',
        });
      }
    }

    // Off the bottom: this ball is gone, but the life is only spent when the
    // last one goes with it.
    if (ball.y - BALL_RADIUS > BOARD_HEIGHT) continue;
    survivors.push(ball);
  }

  const room = Math.max(0, MAX_BALLS - survivors.length);
  let balls = [...survivors, ...spawned.slice(0, room)];

  if (balls.length === 0) {
    lives -= 1;
    if (lives <= 0)
      return { ...state, bricks, broken, descent, lives: 0, balls: [], status: 'failed' };
    balls = [readyBall(state.paddleX)];
  }

  if (bricks.every((brick) => !brick.alive)) {
    return { ...state, bricks, broken, descent, lives, balls, status: 'cleared' };
  }

  return { ...state, bricks, broken, descent, lives, balls };
}
