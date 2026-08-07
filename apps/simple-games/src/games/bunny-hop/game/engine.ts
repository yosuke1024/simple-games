/**
 * The run, as a pure function of its inputs (docs/BUNNY_HOP_RULES.md). No
 * canvas, no React, no clock of its own: the view hands it fixed steps and
 * the one thing a player can do — jump.
 *
 * The world does not move; the runner's distance grows and every obstacle's
 * position is read from it (`obstacleX`). That is what keeps a long run
 * exact: nothing accumulates per obstacle, so an obstacle three minutes in
 * sits where the same seed puts it every time.
 */
import {
  BOARD_WIDTH,
  GRAVITY,
  HIT_INSET,
  JUMP_VELOCITY,
  MAX_SPEED,
  MILESTONE_EVERY,
  PX_PER_POINT,
  RUNNER_HEIGHT,
  RUNNER_WIDTH,
  RUNNER_X,
  SPEED_GAIN,
  START_SPEED,
} from './constants';
import { drawObstacle, obstacleKind } from './obstacles';
import type { GameState, Obstacle } from './types';

/** A fresh run, standing still until the first input (§2). */
export function createInitialState(seed = 'prototype'): GameState {
  return {
    seed,
    status: 'ready',
    distance: 0,
    speed: START_SPEED,
    runnerY: 0,
    runnerVelocity: 0,
    obstacles: [],
    nextObstacleIndex: 0,
    // The first obstacle enters after a beat of empty track, so the run
    // starts with a look at what is coming rather than with a reaction.
    nextSpawnDistance: BOARD_WIDTH * 0.6,
    nextObstacleId: 1,
    obstaclesPassed: 0,
    score: 0,
    milestones: 0,
    elapsedMs: 0,
  };
}

/** Where an obstacle's left edge is right now, in board coordinates. */
export function obstacleX(distance: number, obstacle: Obstacle): number {
  return BOARD_WIDTH - (distance - obstacle.spawnDistance);
}

export const isGrounded = (state: GameState): boolean => state.runnerY <= 0;

/**
 * Jump — the only input there is (§3). Only from the ground: a second jump in
 * mid-air would make every gap survivable and the track meaningless. The
 * first jump also starts the run, which is why a player never has to find a
 * separate start control.
 */
export function jump(state: GameState): GameState {
  if (state.status === 'over') return state;
  const started = state.status === 'ready' ? { ...state, status: 'running' as const } : state;
  if (!isGrounded(started)) return started;
  return { ...started, runnerVelocity: JUMP_VELOCITY };
}

export interface Box {
  left: number;
  right: number;
  /** Height above the ground of the underside and the top. */
  bottom: number;
  top: number;
}

/** The runner's box: the drawn shape, pulled in on every side (§7). */
export function runnerBox(state: GameState): Box {
  return {
    left: RUNNER_X + HIT_INSET,
    right: RUNNER_X + RUNNER_WIDTH - HIT_INSET,
    bottom: state.runnerY + HIT_INSET,
    top: state.runnerY + RUNNER_HEIGHT - HIT_INSET,
  };
}

export function obstacleBox(distance: number, obstacle: Obstacle): Box {
  const kind = obstacleKind(obstacle.kindId);
  const left = obstacleX(distance, obstacle);
  return {
    left,
    right: left + kind.width,
    bottom: kind.bottom,
    top: kind.bottom + kind.height,
  };
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;

/** Speed after this much running. Time, not score: the curve is the same one
    for a careful player and a lucky one (§5). */
function speedAt(elapsedMs: number): number {
  return Math.min(MAX_SPEED, START_SPEED + (SPEED_GAIN * elapsedMs) / 1000);
}

export function step(state: GameState, dtMs: number): GameState {
  if (state.status !== 'running') return state;
  const dt = dtMs / 1000;

  const elapsedMs = state.elapsedMs + dtMs;
  const speed = speedAt(elapsedMs);
  const distance = state.distance + speed * dt;

  // The jump arc.
  let runnerY = state.runnerY;
  let runnerVelocity = state.runnerVelocity;
  if (runnerY > 0 || runnerVelocity > 0) {
    runnerVelocity -= GRAVITY * dt;
    runnerY += runnerVelocity * dt;
    if (runnerY <= 0) {
      runnerY = 0;
      runnerVelocity = 0;
    }
  }

  const score = Math.floor(distance / PX_PER_POINT);

  // Spawning. `nextSpawnDistance` is where the obstacle's leading edge meets
  // the right edge of the board, so an obstacle scheduled between two steps
  // still enters at exactly the right place instead of at the step boundary.
  let obstacles = state.obstacles;
  let nextObstacleIndex = state.nextObstacleIndex;
  let nextSpawnDistance = state.nextSpawnDistance;
  let nextObstacleId = state.nextObstacleId;
  while (distance >= nextSpawnDistance) {
    const draw = drawObstacle(state.seed, nextObstacleIndex, score);
    const kind = obstacleKind(draw.kindId);
    obstacles = [
      ...obstacles,
      {
        id: nextObstacleId++,
        kindId: draw.kindId,
        spawnDistance: nextSpawnDistance,
        passed: false,
      },
    ];
    // Edge to edge: the gap is the room between two obstacles, never the
    // distance between their left corners — a row of bushes would otherwise
    // eat the gap it stands in.
    nextSpawnDistance += kind.width + draw.gapSeconds * speed;
    nextObstacleIndex += 1;
  }

  // Counting and clearing out. An obstacle counts when the runner is past it,
  // not when it leaves the board: what was survived is the honest measure.
  let obstaclesPassed = state.obstaclesPassed;
  let changed = false;
  const kept: Obstacle[] = [];
  for (const obstacle of obstacles) {
    const kind = obstacleKind(obstacle.kindId);
    const left = obstacleX(distance, obstacle);
    if (left + kind.width < 0) {
      changed = true;
      continue;
    }
    if (!obstacle.passed && left + kind.width < RUNNER_X) {
      obstaclesPassed += 1;
      changed = true;
      kept.push({ ...obstacle, passed: true });
      continue;
    }
    kept.push(obstacle);
  }
  if (changed || kept.length !== obstacles.length) obstacles = kept;

  const next: GameState = {
    ...state,
    distance,
    speed,
    runnerY,
    runnerVelocity,
    obstacles,
    nextObstacleIndex,
    nextSpawnDistance,
    nextObstacleId,
    obstaclesPassed,
    score,
    milestones: Math.floor(score / MILESTONE_EVERY),
    elapsedMs,
  };

  // One touch ends the run (§7). Checked after everything has moved, so what
  // the next frame draws is the frame the run ended on.
  const runner = runnerBox(next);
  const struck = obstacles.some((obstacle) => overlaps(runner, obstacleBox(distance, obstacle)));
  return struck ? { ...next, status: 'over' } : next;
}
