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
  CARROT_AIR_BOTTOM,
  CARROT_HEIGHT,
  CARROT_MAX,
  CARROT_MIN_GAP_SECONDS,
  CARROT_WIDTH,
  GRAVITY,
  HIT_INSET,
  HIT_INVULN_MS,
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
import { drawCarrot } from './carrots';
import { drawObstacle, obstacleKind } from './obstacles';
import type { Carrot, GameState, Obstacle } from './types';

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
    carrots: 0,
    carrotItems: [],
    nextCarrotId: 1,
    carrotsCollected: 0,
    invulnerableMs: 0,
  };
}

/** Where a track item's left edge is right now, in board coordinates. Shared
    by obstacles and carrots — both are placed purely as a function of the
    run's distance and their own spawnDistance (§1). */
function trackX(distance: number, spawnDistance: number): number {
  return BOARD_WIDTH - (distance - spawnDistance);
}

/** Where an obstacle's left edge is right now, in board coordinates. */
export function obstacleX(distance: number, obstacle: Obstacle): number {
  return trackX(distance, obstacle.spawnDistance);
}

/** Where a carrot's left edge is right now, in board coordinates. */
export function carrotX(distance: number, carrot: Carrot): number {
  return trackX(distance, carrot.spawnDistance);
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

/** A carrot's box, drawn at its full declared size — there is no inset here,
    reaching one is a bonus and not a hazard the runner has to be forgiven
    for grazing (§7). */
export function carrotBox(distance: number, carrot: Carrot): Box {
  const left = carrotX(distance, carrot);
  return {
    left,
    right: left + CARROT_WIDTH,
    bottom: carrot.bottom,
    top: carrot.bottom + CARROT_HEIGHT,
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
  let carrotItems = state.carrotItems;
  let nextObstacleIndex = state.nextObstacleIndex;
  let nextSpawnDistance = state.nextSpawnDistance;
  let nextObstacleId = state.nextObstacleId;
  let nextCarrotId = state.nextCarrotId;
  while (distance >= nextSpawnDistance) {
    const draw = drawObstacle(state.seed, nextObstacleIndex, score);
    const kind = obstacleKind(draw.kindId);
    const obstacleSpawn = nextSpawnDistance;
    obstacles = [
      ...obstacles,
      {
        id: nextObstacleId++,
        kindId: draw.kindId,
        spawnDistance: obstacleSpawn,
        passed: false,
      },
    ];

    // A carrot, maybe, riding in the room behind this obstacle — drawn from
    // its own rng stream (game/carrots.ts) so it can never shift the obstacle
    // draw after it, which is what the golden test in compatibility.test.ts
    // pins. Only a gap roomy enough that reaching for the carrot is never
    // also a dodge, and never airborne right behind a high bird — that would
    // bait the one jump that turns a harmless bird into a hit (§5).
    const gapPx = draw.gapSeconds * speed;
    if (draw.gapSeconds >= CARROT_MIN_GAP_SECONDS) {
      const carrot = drawCarrot(state.seed, nextObstacleIndex);
      if (carrot.present) {
        const air = carrot.air && draw.kindId !== 'bird-high';
        carrotItems = [
          ...carrotItems,
          {
            id: nextCarrotId++,
            spawnDistance: obstacleSpawn + kind.width + (gapPx - CARROT_WIDTH) / 2,
            bottom: air ? CARROT_AIR_BOTTOM : 0,
          },
        ];
      }
    }

    // Edge to edge: the gap is the room between two obstacles, never the
    // distance between their left corners — a row of bushes would otherwise
    // eat the gap it stands in.
    nextSpawnDistance += kind.width + gapPx;
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

  const runner: Box = {
    left: RUNNER_X + HIT_INSET,
    right: RUNNER_X + RUNNER_WIDTH - HIT_INSET,
    bottom: runnerY + HIT_INSET,
    top: runnerY + RUNNER_HEIGHT - HIT_INSET,
  };

  // Carrots: culled the same way as obstacles that scroll off, and picked up
  // on overlap with the runner — but only while there is a slot free. A held
  // one is spent below to survive a hit; a track already at the cap just
  // scrolls a spare carrot by uncollected (§5).
  let carrots = state.carrots;
  let carrotsCollected = state.carrotsCollected;
  const keptCarrots: Carrot[] = [];
  for (const carrot of carrotItems) {
    const left = carrotX(distance, carrot);
    if (left + CARROT_WIDTH < 0) continue;
    if (carrots < CARROT_MAX && overlaps(runner, carrotBox(distance, carrot))) {
      carrots += 1;
      carrotsCollected += 1;
      continue;
    }
    keptCarrots.push(carrot);
  }
  if (keptCarrots.length !== carrotItems.length) carrotItems = keptCarrots;

  // Invulnerability counts down every running step, hit or not (§7).
  const invulnerableMs = Math.max(0, state.invulnerableMs - dtMs);

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
    carrots,
    carrotItems,
    nextCarrotId,
    carrotsCollected,
    invulnerableMs,
  };

  // Carrots are the lives now (§7). While invulnerable, a struck obstacle is
  // ignored outright — the point of the window is that one wide cluster
  // cannot cost more than the one carrot it started with. Otherwise a hit
  // with a carrot in hand spends it and opens the window instead of ending
  // the run; with none held, it ends the run exactly as it always has.
  // Checked after everything has moved, so what the next frame draws is the
  // frame the hit (or the crash) happened on.
  if (invulnerableMs > 0) return next;
  const struck = obstacles.some((obstacle) => overlaps(runner, obstacleBox(distance, obstacle)));
  if (!struck) return next;
  if (carrots > 0) {
    return { ...next, carrots: carrots - 1, invulnerableMs: HIT_INVULN_MS };
  }
  return { ...next, status: 'over' };
}
