import { describe, expect, it } from 'vitest';
import {
  BOARD_WIDTH,
  DUCK_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_SPEED,
  MIN_GAP_SECONDS,
  PX_PER_POINT,
  RUNNER_HEIGHT,
  RUNNER_X,
  START_SPEED,
} from './constants';
import {
  createInitialState,
  isGrounded,
  jump,
  obstacleBox,
  obstacleX,
  runnerBox,
  setDucking,
  step,
} from './engine';
import { obstacleKind } from './obstacles';
import type { GameState } from './types';

const STEP_MS = 1000 / 120;

/** Runs the simulation the way the board does: fixed steps, no input. */
function advance(state: GameState, ms: number, between?: (state: GameState) => GameState) {
  let current = state;
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    if (between) current = between(current);
    current = step(current, STEP_MS);
  }
  return current;
}

const running = (seed = 'test') => jump(createInitialState(seed));

describe('starting a run (§2)', () => {
  it('stands still until the first input', () => {
    const state = createInitialState('test');
    const later = advance(state, 2000);
    expect(later.status).toBe('ready');
    expect(later.distance).toBe(0);
    expect(later.obstacles).toEqual([]);
  });

  it('starts on a jump, and on a duck', () => {
    expect(jump(createInitialState('test')).status).toBe('running');
    expect(setDucking(createInitialState('test'), true).status).toBe('running');
    // Letting go of a duck that never started a run does not start one.
    expect(setDucking(createInitialState('test'), false).status).toBe('ready');
  });

  it('ignores every input once the run is over', () => {
    const over: GameState = { ...running(), status: 'over' };
    expect(jump(over)).toBe(over);
    expect(setDucking(over, true)).toBe(over);
    expect(step(over, STEP_MS)).toBe(over);
  });
});

describe('the jump (§3, §4)', () => {
  it('leaves the ground and comes back to it', () => {
    const state = running();
    const midAir = advance(state, 300);
    expect(midAir.runnerY).toBeGreaterThan(80);
    // The whole arc is 2 × 640 / 2100 = 0.61s; a beat later it has landed.
    const landed = advance(state, 700);
    expect(landed.runnerY).toBe(0);
    expect(isGrounded(landed)).toBe(true);
  });

  it('reaches the height the two constants promise', () => {
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    let best = 0;
    let state = running();
    for (let i = 0; i < 100; i++) {
      state = step(state, STEP_MS);
      best = Math.max(best, state.runnerY);
    }
    expect(best).toBeGreaterThan(apex - 4);
    expect(best).toBeLessThan(apex + 4);
  });

  it('cannot be jumped again in mid-air', () => {
    const midAir = advance(running(), 200);
    const again = jump(midAir);
    expect(again.runnerVelocity).toBe(midAir.runnerVelocity);
    expect(again).toBe(midAir);
  });

  it('drops faster when ducking is held in the air (§3)', () => {
    const midAir = advance(running(), 200);
    const gliding = advance(midAir, 150);
    const diving = advance(setDucking(midAir, true), 150);
    expect(diving.runnerY).toBeLessThan(gliding.runnerY);
  });
});

describe('the pose (§3, §7)', () => {
  it('is half as tall while ducking, and only on the ground', () => {
    const ducked = setDucking(running(), true);
    expect(runnerBox(ducked).top - runnerBox(ducked).bottom).toBeCloseTo(DUCK_HEIGHT - 4, 5);

    const duckedInAir = advance(setDucking(running(), true), 100);
    expect(duckedInAir.runnerY).toBeGreaterThan(0);
    const box = runnerBox(duckedInAir);
    expect(box.top - box.bottom).toBeCloseTo(RUNNER_HEIGHT - 4, 5);
  });
});

describe('the track (§5)', () => {
  it('puts the first obstacle on screen before it can be a surprise', () => {
    const state = advance(running(), 1500);
    expect(state.obstacles.length).toBeGreaterThan(0);
    const first = state.obstacles[0]!;
    expect(obstacleX(state.distance, first)).toBeLessThan(BOARD_WIDTH);
    expect(obstacleX(state.distance, first)).toBeGreaterThan(RUNNER_X);
  });

  it('never places two obstacles closer than one jump apart', () => {
    // The runner is kept in the air the whole time so the run does not end;
    // what is under test is the spacing, not the survival.
    let state = running('gap-check');
    const spawned: { spawnDistance: number; width: number; speed: number }[] = [];
    for (let i = 0; i < 12000; i++) {
      const before = state.obstacles.length;
      state = step(state, STEP_MS);
      if (state.obstacles.length > before) {
        const fresh = state.obstacles[state.obstacles.length - 1]!;
        spawned.push({
          spawnDistance: fresh.spawnDistance,
          width: obstacleKind(fresh.kindId).width,
          speed: state.speed,
        });
      }
      state = { ...state, status: 'running', runnerY: 200 };
    }
    expect(spawned.length).toBeGreaterThan(5);
    expect(spawned.some((entry) => entry.speed === MAX_SPEED)).toBe(true);
    for (let i = 1; i < spawned.length; i++) {
      const previous = spawned[i - 1]!;
      const gap = spawned[i]!.spawnDistance - (previous.spawnDistance + previous.width);
      // In seconds of running, which is the only unit the player feels. The
      // gap is set at the speed of the moment and crossed a second or so
      // later, by which time the track is at most a few px/s faster.
      expect(gap / previous.speed).toBeGreaterThanOrEqual(MIN_GAP_SECONDS - 0.001);
    }
  });

  it('leaves more room than one jump takes, at every speed', () => {
    // The whole reason gaps are measured in seconds: a jump lasts the same
    // 0.61s at 200px/s and at 460px/s, so a gap that is a jump plus change
    // stays a jump plus change for the whole run.
    const jumpSeconds = (2 * JUMP_VELOCITY) / GRAVITY;
    expect(MIN_GAP_SECONDS).toBeGreaterThan(jumpSeconds);
  });

  it('is the same track twice for the same seed, and a different one otherwise', () => {
    const kinds = (seed: string) =>
      advance(running(seed), 6000, (state) => ({ ...state, status: 'running', runnerY: 200 }))
        .obstacles.map((obstacle) => obstacle.kindId)
        .join(',');
    expect(kinds('same')).toBe(kinds('same'));
    expect(kinds('same')).not.toBe(kinds('other'));
  });
});

describe('speed and score (§5, §6)', () => {
  it('speeds up as the run goes on, and stops at the cap', () => {
    const airborne = (state: GameState) => ({ ...state, status: 'running' as const, runnerY: 200 });
    const early = advance(running(), 3000, airborne);
    expect(early.speed).toBeGreaterThan(START_SPEED);
    const late = advance(running(), 90_000, airborne);
    expect(late.speed).toBe(MAX_SPEED);
  });

  it('scores the distance run and nothing else', () => {
    const state = advance(running(), 2000, (s) => ({ ...s, status: 'running', runnerY: 200 }));
    expect(state.score).toBe(Math.floor(state.distance / PX_PER_POINT));
    expect(state.score).toBeGreaterThan(0);
  });
});

describe('the crash (§7)', () => {
  it('ends the run on the first obstacle when nothing is done about it', () => {
    const state = advance(running(), 20_000);
    expect(state.status).toBe('over');
    expect(state.score).toBeGreaterThan(0);
    // The frame the run ended on is the frame the player sees: the obstacle
    // that ended it is still on the board, overlapping the runner.
    const runner = runnerBox(state);
    const hit = state.obstacles.filter((obstacle) => {
      const box = obstacleBox(state.distance, obstacle);
      return runner.left < box.right && box.left < runner.right;
    });
    expect(hit.length).toBeGreaterThan(0);
  });

  it('counts each obstacle survived exactly once', () => {
    // Held in the air, every obstacle passes underneath and is counted.
    const state = advance(running(), 12_000, (s) => ({
      ...s,
      status: 'running' as const,
      runnerY: 200,
    }));
    expect(state.status).toBe('running');
    expect(state.obstaclesPassed).toBeGreaterThan(3);
    const stillCounted = advance(state, 1, (s) => ({ ...s, runnerY: 200 }));
    expect(stillCounted.obstaclesPassed).toBe(state.obstaclesPassed);
  });

  it('lets a ducking runner through a bird at head height', () => {
    // A mid bird sits 26px up; ducking is 21px tall, so it passes under.
    const state = running('duck-check');
    const kind = obstacleKind('bird-mid');
    const ducked = setDucking({ ...state, distance: 100 }, true);
    const bird = {
      id: 1,
      kindId: 'bird-mid' as const,
      spawnDistance: 100 - BOARD_WIDTH + RUNNER_X,
      passed: false,
    };
    const box = obstacleBox(ducked.distance, bird);
    const runner = runnerBox(ducked);
    expect(box.left).toBeLessThan(runner.right);
    expect(runner.top).toBeLessThan(box.bottom);
    expect(kind.bottom).toBeGreaterThan(DUCK_HEIGHT);
  });
});
