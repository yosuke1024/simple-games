import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ENEMY_BULLET_SPEED,
  ENEMY_FIRE_INTERVAL_MS,
  ENEMY_RADII,
  FIRING_TIER,
  POWER_MAX,
  POWER_MIN,
  SHIP_Y,
  SMALLEST_TIER,
  STARTING_LIVES,
  WAVE_BREAK_MS,
} from './constants';
import { createInitialState, moveShipBy, setShipX, step } from './engine';
import { LEVEL_COUNT, waveSpec, wavesInLevel } from './levels';
import type { GameState } from './types';
import { spawnWave } from './waves';

const STEP_MS = 1000 / 120;
const BREAK_STEPS = Math.ceil(WAVE_BREAK_MS / STEP_MS) + 1;

function stepMany(state: GameState, count: number, dtMs = STEP_MS): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = step(next, dtMs);
  return next;
}

/** Runs until the first wave has entered, so tests start from real content. */
function afterFirstWave(seed = 'test', level = 1): GameState {
  return stepMany(createInitialState(seed, level), BREAK_STEPS);
}

/** Clears the wave on screen without touching anything else. */
function clearWave(state: GameState): GameState {
  return step({ ...state, enemies: [], bullets: [] }, STEP_MS);
}

describe('sky-fighter levels', () => {
  it('difficulty keeps climbing all the way to level 100 — nothing saturates early', () => {
    const finalWave = (level: number) => waveSpec(level, wavesInLevel(level) - 1);
    for (const [a, b] of [
      [1, 25],
      [25, 50],
      [50, 75],
      [75, LEVEL_COUNT],
    ] as const) {
      const low = finalWave(a);
      const high = finalWave(b);
      expect(high.speedMin).toBeGreaterThan(low.speedMin);
      expect(high.bigChance).toBeGreaterThan(low.bigChance);
      expect(high.count).toBeGreaterThanOrEqual(low.count);
    }
    // Across the whole ladder every lever must actually have moved.
    expect(finalWave(LEVEL_COUNT).count).toBeGreaterThan(finalWave(1).count);
    expect(wavesInLevel(LEVEL_COUNT)).toBeGreaterThan(wavesInLevel(1));
  });

  it('within a level the last wave is the hardest', () => {
    for (const level of [1, 40, 100]) {
      const waves = wavesInLevel(level);
      const first = waveSpec(level, 0);
      const last = waveSpec(level, waves - 1);
      expect(last.speedMin).toBeGreaterThan(first.speedMin);
      expect(last.count).toBeGreaterThan(first.count);
    }
  });

  it('level bounds are clamped rather than extrapolated', () => {
    expect(waveSpec(0, 0)).toEqual(waveSpec(1, 0));
    expect(waveSpec(999, 0)).toEqual(waveSpec(LEVEL_COUNT, 0));
    expect(wavesInLevel(0)).toBe(wavesInLevel(1));
  });
});

describe('sky-fighter engine', () => {
  it('opens with a quiet beat, then the first wave enters', () => {
    const start = createInitialState('test');
    expect(start.enemies).toHaveLength(0);
    expect(start.waveInLevel).toBe(-1);

    const state = afterFirstWave();
    expect(state.waveInLevel).toBe(0);
    expect(state.enemies.length).toBeGreaterThan(0);
  });

  it('the same seed and level replay the same wave', () => {
    const a = spawnWave('seed-a', 3, 1, 1);
    const b = spawnWave('seed-a', 3, 1, 1);
    expect(a.enemies).toEqual(b.enemies);
    expect(spawnWave('seed-b', 3, 1, 1).enemies).not.toEqual(a.enemies);
    expect(spawnWave('seed-a', 4, 1, 1).enemies).not.toEqual(a.enemies);
  });

  it('every spawned enemy starts inside the board horizontally', () => {
    for (let level = 1; level <= LEVEL_COUNT; level += 7) {
      for (let w = 0; w < wavesInLevel(level); w++) {
        for (const enemy of spawnWave('bounds', level, w, 1).enemies) {
          const radius = ENEMY_RADII[enemy.tier]!;
          expect(enemy.x).toBeGreaterThanOrEqual(radius - 0.001);
          expect(enemy.x).toBeLessThanOrEqual(BOARD_WIDTH - radius + 0.001);
        }
      }
    }
  });

  it('fires on its own once a wave is on screen — the player never presses', () => {
    const firing = stepMany(afterFirstWave(), 30);
    expect(firing.bullets.length).toBeGreaterThan(0);
    expect(firing.bullets.every((b) => b.y < SHIP_Y)).toBe(true);
  });

  it('holds fire during the quiet beat between waves', () => {
    const start = stepMany(createInitialState('test'), 20);
    expect(start.waveBreakMs).toBeGreaterThan(0);
    expect(start.bullets).toHaveLength(0);
  });

  it('a hit splits a large enemy into two smaller ones and scores', () => {
    let state = afterFirstWave();
    // Built rather than found: a low level rarely rolls a large enemy, and a
    // wave enters from above the top edge anyway — a bullet spawned off-screen
    // is culled before it can ever collide.
    const target = { id: 1001, x: 180, y: 200, dx: 0, dy: 0, tier: 0 };
    state = {
      ...state,
      enemies: [target],
      bullets: [{ x: target.x, y: target.y, dx: 0, dy: 0 }],
      score: 0,
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every((b) => b.tier === 1)).toBe(true);
    expect(state.bullets).toHaveLength(0);
    expect(state.score).toBeGreaterThan(0);
  });

  it('the smallest enemy is destroyed for good instead of splitting', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      enemies: [{ id: 999, x: 180, y: 200, dx: 0, dy: 0, tier: SMALLEST_TIER }],
      bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(0);
  });

  it('one bullet spends itself on one enemy', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      enemies: [
        { id: 901, x: 180, y: 200, dx: 0, dy: 0, tier: SMALLEST_TIER },
        { id: 902, x: 184, y: 200, dx: 0, dy: 0, tier: SMALLEST_TIER },
      ],
      bullets: [{ x: 182, y: 200, dx: 0, dy: 0 }],
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(1);
  });

  it('enemies bounce off the side walls instead of leaving', () => {
    let state = afterFirstWave();
    const radius = ENEMY_RADII[0]!;
    state = {
      ...state,
      enemies: [{ id: 801, x: radius + 1, y: 100, dx: -80, dy: 0, tier: 0 }],
      bullets: [],
    };
    state = step(state, 1000 / 60);
    expect(state.enemies[0]!.dx).toBeGreaterThan(0);
    expect(state.enemies[0]!.x).toBeGreaterThanOrEqual(radius);
  });

  it('a enemy that gets past the ship drifts away without costing a life', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      enemies: [
        { id: 701, x: 180, y: BOARD_HEIGHT + ENEMY_RADII[0]! - 1, dx: 0, dy: 200, tier: 0 },
      ],
      bullets: [],
      lives: STARTING_LIVES,
    };
    state = step(state, 1000 / 60);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.status).not.toBe('failed');
  });

  it('touching a enemy costs a life and grants brief grace', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      enemies: [{ id: 601, x: 180, y: SHIP_Y, dx: 0, dy: 0, tier: 0 }],
      bullets: [],
      lives: STARTING_LIVES,
      invulnerableMs: 0,
    };
    state = step(state, STEP_MS);
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.invulnerableMs).toBeGreaterThan(0);
  });

  it('grace actually protects: a second enemy in the same instant is survivable', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      enemies: [
        { id: 501, x: 180, y: SHIP_Y, dx: 0, dy: 0, tier: 0 },
        { id: 502, x: 180, y: SHIP_Y, dx: 0, dy: 0, tier: 0 },
      ],
      bullets: [],
      lives: 2,
      invulnerableMs: 0,
    };
    state = stepMany(state, 2);
    expect(state.lives).toBe(1);
    expect(state.status).toBe('playing');
  });

  it('losing the last life fails the level', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      enemies: [{ id: 401, x: 180, y: SHIP_Y, dx: 0, dy: 0, tier: 0 }],
      bullets: [],
      lives: 1,
      invulnerableMs: 0,
    };
    state = step(state, STEP_MS);
    expect(state.status).toBe('failed');
    expect(step(state, STEP_MS)).toBe(state);
  });

  it('clearing every wave clears the level, and not one wave sooner', () => {
    let state = afterFirstWave('test', 1);
    const waves = wavesInLevel(1);
    for (let w = 0; w < waves - 1; w++) {
      state = clearWave(state);
      expect(state.status).toBe('playing');
      expect(state.waveBreakMs).toBeGreaterThan(0);
      state = stepMany(state, BREAK_STEPS);
      expect(state.waveInLevel).toBe(w + 1);
    }
    state = clearWave(state);
    expect(state.status).toBe('cleared');
  });

  it('a bomber shot in flight does not survive into the quiet break', () => {
    const base = afterFirstWave();
    const state = clearWave({ ...base, enemyBullets: [{ x: 40, y: 100 }] });
    expect(state.waveBreakMs).toBeGreaterThan(0);
    expect(state.enemyBullets).toHaveLength(0);
  });

  it('a cleared level is final — stepping it again changes nothing', () => {
    let state = afterFirstWave('test', 1);
    for (let w = 0; w < wavesInLevel(1) - 1; w++) {
      state = stepMany(clearWave(state), BREAK_STEPS);
    }
    state = clearWave(state);
    expect(state.status).toBe('cleared');
    expect(step(state, STEP_MS)).toBe(state);
  });

  it('fires one barrel at power 1, two at power 2, three at power 3', () => {
    const base = afterFirstWave();
    for (const [power, expected] of [
      [1, 1],
      [2, 2],
      [3, 3],
    ] as const) {
      const fired = step({ ...base, power, bullets: [], fireCooldownMs: 0 }, STEP_MS);
      expect(fired.bullets).toHaveLength(expected);
    }
  });

  it('the outer barrels at full power fan out instead of stacking', () => {
    const state = step({ ...afterFirstWave(), power: 3, bullets: [], fireCooldownMs: 0 }, STEP_MS);
    const sideways = state.bullets.filter((b) => b.dx !== 0);
    expect(sideways).toHaveLength(2);
    expect(sideways.some((b) => b.dx < 0)).toBe(true);
    expect(sideways.some((b) => b.dx > 0)).toBe(true);
    expect(state.bullets.every((b) => b.dy < 0)).toBe(true);
  });

  it('only the smallest enemies can leave a token — chipping earns nothing', () => {
    const base = afterFirstWave();
    let fromBig = 0;
    for (let id = 1; id <= 60; id++) {
      const downed = step(
        {
          ...base,
          enemies: [{ id, x: 180, y: 200, dx: 0, dy: 0, tier: 0 }],
          bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
          tokens: [],
        },
        STEP_MS,
      );
      fromBig += downed.tokens.length;
    }
    expect(fromBig).toBe(0);
  });

  it('some smallest-tier kills leave a token and some do not', () => {
    const base = afterFirstWave();
    let dropped = 0;
    for (let id = 1; id <= 60; id++) {
      const downed = step(
        {
          ...base,
          enemies: [{ id, x: 180, y: 200, dx: 0, dy: 0, tier: SMALLEST_TIER }],
          bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
          tokens: [],
        },
        STEP_MS,
      );
      dropped += downed.tokens.length;
    }
    expect(dropped).toBeGreaterThan(0);
    expect(dropped).toBeLessThan(60);
  });

  it('the same kill always makes the same drop decision', () => {
    const kill = () => {
      const base = afterFirstWave('fixed');
      return step(
        {
          ...base,
          enemies: [{ id: 7, x: 180, y: 200, dx: 0, dy: 0, tier: SMALLEST_TIER }],
          bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
          tokens: [],
        },
        STEP_MS,
      ).tokens.length;
    };
    expect(kill()).toBe(kill());
  });

  it('catching a token adds a barrel', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      power: 1,
      tokens: [{ id: 1, x: 180, y: SHIP_Y }],
      enemies: [],
      bullets: [],
    };
    state = step(state, STEP_MS);
    expect(state.power).toBe(2);
    expect(state.tokens).toHaveLength(0);
  });

  it('power stops at the maximum, and no token drops once it is reached', () => {
    const base = afterFirstWave();
    const capped = step(
      {
        ...base,
        shipX: 180,
        power: POWER_MAX,
        tokens: [{ id: 1, x: 180, y: SHIP_Y }],
        enemies: [],
        bullets: [],
      },
      STEP_MS,
    );
    expect(capped.power).toBe(POWER_MAX);

    let anyDropped = 0;
    for (let id = 1; id <= 60; id++) {
      anyDropped += step(
        {
          ...base,
          power: POWER_MAX,
          enemies: [{ id, x: 180, y: 200, dx: 0, dy: 0, tier: SMALLEST_TIER }],
          bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
          tokens: [],
        },
        STEP_MS,
      ).tokens.length;
    }
    expect(anyDropped).toBe(0);
  });

  it('never puts a second token on screen while one is still falling', () => {
    const base = afterFirstWave();
    let extra = 0;
    for (let id = 1; id <= 60; id++) {
      const state = step(
        {
          ...base,
          enemies: [{ id, x: 180, y: 200, dx: 0, dy: 0, tier: SMALLEST_TIER }],
          bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
          tokens: [{ id: 900, x: 40, y: 100 }],
        },
        STEP_MS,
      );
      extra += state.tokens.length - 1;
    }
    expect(extra).toBe(0);
  });

  it('an uncaught token falls off the bottom and is gone', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 20,
      tokens: [{ id: 1, x: 340, y: BOARD_HEIGHT - 1 }],
      enemies: [],
      bullets: [],
    };
    state = stepMany(state, 20);
    expect(state.tokens).toHaveLength(0);
    expect(state.power).toBe(POWER_MIN);
  });

  it('a hit costs one barrel, never the whole gun', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      power: 3,
      enemies: [{ id: 301, x: 180, y: SHIP_Y, dx: 0, dy: 0, tier: 0 }],
      bullets: [],
      tokens: [],
      invulnerableMs: 0,
    };
    state = step(state, STEP_MS);
    expect(state.power).toBe(2);

    state = {
      ...state,
      power: POWER_MIN,
      enemies: [{ id: 302, x: 180, y: SHIP_Y, dx: 0, dy: 0, tier: 0 }],
      invulnerableMs: 0,
    };
    state = step(state, STEP_MS);
    expect(state.power).toBe(POWER_MIN);
  });

  it('every level starts at one barrel — strength is never carried over', () => {
    for (const level of [1, 50, LEVEL_COUNT]) {
      const state = createInitialState('a', level);
      expect(state.power).toBe(POWER_MIN);
      expect(state.tokens).toHaveLength(0);
      expect(state.lives).toBe(STARTING_LIVES);
    }
  });

  it('only the bomber tier shoots back', () => {
    const base = afterFirstWave();
    const armedTiers = [0, 1, 2].map((tier) => {
      const state = stepMany(
        {
          ...base,
          enemies: [{ id: 1, x: 180, y: 200, dx: 0, dy: 0, tier, fireCooldownMs: 1 }],
          bullets: [],
          enemyBullets: [],
        },
        4,
      );
      return state.enemyBullets.length;
    });
    expect(armedTiers[FIRING_TIER]).toBeGreaterThan(0);
    expect(armedTiers[1]).toBe(0);
    expect(armedTiers[2]).toBe(0);
  });

  it('a bomber above the top edge holds its fire until it is on screen', () => {
    const base = afterFirstWave();
    const offScreen = stepMany(
      {
        ...base,
        enemies: [{ id: 1, x: 180, y: -30, dx: 0, dy: 0, tier: FIRING_TIER, fireCooldownMs: 1 }],
        bullets: [],
        enemyBullets: [],
      },
      4,
    );
    expect(offScreen.enemyBullets).toHaveLength(0);
  });

  it('an enemy shot travels downward and leaves the board', () => {
    const base = afterFirstWave();
    // Keep base's enemies (non-empty): emptying them would clear the wave on
    // this very step and wipe enemyBullets with it (§ the quiet break must not
    // inherit a live shot, tested separately below).
    let state: GameState = {
      ...base,
      bullets: [],
      enemyBullets: [{ x: 40, y: 100 }],
    };
    const before = state.enemyBullets[0]!.y;
    state = step(state, STEP_MS);
    expect(state.enemyBullets[0]!.y).toBeGreaterThan(before);

    // Past the bottom edge it is gone; assert the outcome rather than the
    // exact frame it happens on.
    state = { ...state, enemyBullets: [{ x: 40, y: BOARD_HEIGHT }] };
    state = stepMany(state, 10);
    expect(state.enemyBullets).toHaveLength(0);
    // Slow enough to walk around rather than react to.
    expect(ENEMY_BULLET_SPEED).toBeLessThan(300);
  });

  it('being shot costs a life and a barrel, exactly like being run into', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        shipX: 180,
        power: 3,
        enemies: [],
        bullets: [],
        enemyBullets: [{ x: 180, y: SHIP_Y }],
        lives: STARTING_LIVES,
        invulnerableMs: 0,
      },
      STEP_MS,
    );
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.power).toBe(2);
    expect(state.invulnerableMs).toBeGreaterThan(0);
    // The shot is spent on the hit rather than passing through.
    expect(state.enemyBullets).toHaveLength(0);
  });

  it('grace covers enemy fire too', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        shipX: 180,
        enemies: [],
        bullets: [],
        enemyBullets: [{ x: 180, y: SHIP_Y }],
        lives: STARTING_LIVES,
        invulnerableMs: 500,
      },
      STEP_MS,
    );
    expect(state.lives).toBe(STARTING_LIVES);
  });

  it('a formation of bombers does not fire on the same beat', () => {
    const { enemies } = spawnWave('stagger', 100, 0, 1);
    const cooldowns = enemies
      .filter((e) => e.tier === FIRING_TIER)
      .map((e) => e.fireCooldownMs)
      .filter((c): c is number => c !== undefined);
    expect(cooldowns.length).toBeGreaterThan(1);
    expect(new Set(cooldowns).size).toBe(cooldowns.length);
    for (const c of cooldowns) expect(c).toBeLessThanOrEqual(ENEMY_FIRE_INTERVAL_MS * 1.3);
  });

  it('splits are unarmed, so killing the bomber is what quietens the sky', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        enemies: [{ id: 1, x: 180, y: 200, dx: 0, dy: 0, tier: 0 }],
        bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
        enemyBullets: [],
      },
      STEP_MS,
    );
    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every((e) => e.tier !== FIRING_TIER)).toBe(true);
  });

  it('the ship stays on the board however it is moved', () => {
    let state = setShipX(createInitialState(), -900);
    expect(state.shipX).toBeGreaterThan(0);
    state = moveShipBy(state, 9000);
    expect(state.shipX).toBeLessThan(BOARD_WIDTH);
  });
});
