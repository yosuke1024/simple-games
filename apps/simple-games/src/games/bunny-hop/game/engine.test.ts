import { describe, expect, it } from 'vitest';
import { drawCarrot } from './carrots';
import {
  BOARD_WIDTH,
  CARROT_MAX,
  GRAVITY,
  HIT_INSET,
  HIT_INVULN_MS,
  JUMP_VELOCITY,
  MAX_SPEED,
  MIN_GAP_SECONDS,
  PX_PER_POINT,
  RUNNER_HEIGHT,
  RUNNER_WIDTH,
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

  it('starts on the first jump', () => {
    expect(jump(createInitialState('test')).status).toBe('running');
  });

  it('ignores every input once the run is over', () => {
    const over: GameState = { ...running(), status: 'over' };
    expect(jump(over)).toBe(over);
    expect(step(over, STEP_MS)).toBe(over);
  });
});

describe('the jump (§3, §4)', () => {
  it('leaves the ground and comes back to it', () => {
    const state = running();
    const midAir = advance(state, 250);
    expect(midAir.runnerY).toBeGreaterThan(70);
    // The whole arc is 2 × 580 / 2100 = 0.55s; a beat later it has landed.
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
});

describe('the box (§7)', () => {
  it('is the drawn runner, pulled in on every side', () => {
    const box = runnerBox(running());
    expect(box.right - box.left).toBeCloseTo(RUNNER_WIDTH - 2 * HIT_INSET, 5);
    expect(box.top - box.bottom).toBeCloseTo(RUNNER_HEIGHT - 2 * HIT_INSET, 5);
  });

  it('rises with the hop, so a bush passes underneath', () => {
    const midAir = advance(running(), 250);
    expect(runnerBox(midAir).bottom).toBeGreaterThan(40);
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
    for (let i = 0; i < 20000; i++) {
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
    const late = advance(running(), 150_000, airborne);
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

  it('lets a grounded runner under a high bird, and catches one in the air', () => {
    // The high bird sits above a runner on the ground; only a jump reaches it.
    const grounded = { ...running('bird-check'), distance: 100 };
    const bird = {
      id: 1,
      kindId: 'bird-high' as const,
      spawnDistance: 100 - BOARD_WIDTH + RUNNER_X,
      passed: false,
    };
    const box = obstacleBox(grounded.distance, bird);
    expect(box.left).toBeLessThan(runnerBox(grounded).right);
    expect(runnerBox(grounded).top).toBeLessThan(box.bottom);

    const midAir = { ...grounded, runnerY: 60 };
    expect(runnerBox(midAir).top).toBeGreaterThan(box.bottom);
  });
});

describe('carrots (§5, §7)', () => {
  const DISTANCE = 1000;
  // Both land the item's left edge at 30 — inside the grounded runner's box
  // (28 to 60), via the same distance/spawnDistance math obstacleX uses.
  const AT_RUNNER_SPAWN = DISTANCE - (BOARD_WIDTH - 30);

  /** A running state parked with nothing about to spawn, so a dtMs: 0 step
      only exercises pickup and collision — never generation. */
  function groundedRunning(seed = 'carrot-test'): GameState {
    return {
      ...createInitialState(seed),
      status: 'running',
      runnerY: 0,
      runnerVelocity: 0,
      distance: DISTANCE,
      nextSpawnDistance: DISTANCE + 1_000_000,
    };
  }

  const carrotHere = (id: number): GameState['carrotItems'][number] => ({
    id,
    spawnDistance: AT_RUNNER_SPAWN,
    bottom: 0,
  });
  const obstacleHere = (id: number): GameState['obstacles'][number] => ({
    id,
    kindId: 'bush',
    spawnDistance: AT_RUNNER_SPAWN,
    passed: false,
  });

  it('is picked up: +1 held, +1 collected this run, gone from the track', () => {
    const state: GameState = { ...groundedRunning(), carrotItems: [carrotHere(1)] };
    const after = step(state, 0);
    expect(after.carrots).toBe(1);
    expect(after.carrotsCollected).toBe(1);
    expect(after.carrotItems).toEqual([]);
  });

  it('stays on the track, uncollected, once the runner already holds the max', () => {
    const state: GameState = {
      ...groundedRunning(),
      carrots: CARROT_MAX,
      carrotItems: [carrotHere(1)],
    };
    const after = step(state, 0);
    expect(after.carrots).toBe(CARROT_MAX);
    expect(after.carrotsCollected).toBe(0);
    expect(after.carrotItems).toEqual([carrotHere(1)]);
  });

  it('a hit spends exactly one carrot and opens an invulnerable window', () => {
    const state: GameState = {
      ...groundedRunning(),
      carrots: 2,
      obstacles: [obstacleHere(1)],
    };
    const hit = step(state, 0);
    expect(hit.status).toBe('running');
    expect(hit.carrots).toBe(1);
    expect(hit.invulnerableMs).toBe(HIT_INVULN_MS);

    // Struck again while the window is still open: nothing more is spent.
    const again = step(hit, 0);
    expect(again.status).toBe('running');
    expect(again.carrots).toBe(1);
    expect(again.invulnerableMs).toBe(HIT_INVULN_MS);
  });

  it('ends the run on a hit with no carrots held, exactly as before', () => {
    const state: GameState = {
      ...groundedRunning(),
      carrots: 0,
      obstacles: [obstacleHere(1)],
    };
    expect(step(state, 0).status).toBe('over');
  });

  it('spawns from its own rng stream, deterministically per seed', () => {
    // Same seed, same index: the two draws (present, air) never differ.
    expect(drawCarrot('carrot-seed', 5)).toEqual(drawCarrot('carrot-seed', 5));

    // Held in the air the whole time, so nothing is ever picked up and the
    // full spawn sequence for the seed gets generated. Tracked by id rather
    // than array length, since carrots also cull off-screen mid-run.
    const track = (seed: string) => {
      let state = running(seed);
      let prevId = state.nextCarrotId;
      const spawned: string[] = [];
      for (let elapsed = 0; elapsed < 20_000; elapsed += STEP_MS) {
        state = step({ ...state, status: 'running', runnerY: 200 }, STEP_MS);
        for (let id = prevId; id < state.nextCarrotId; id++) {
          const item = state.carrotItems.find((carrot) => carrot.id === id);
          if (item) spawned.push(`${item.spawnDistance.toFixed(1)}:${item.bottom}`);
        }
        prevId = state.nextCarrotId;
      }
      return spawned.join('|');
    };

    const track1 = track('carrot-fixed');
    expect(track1.length).toBeGreaterThan(0);
    expect(track('carrot-fixed')).toBe(track1);
    expect(track('carrot-other')).not.toBe(track1);
  });
});
