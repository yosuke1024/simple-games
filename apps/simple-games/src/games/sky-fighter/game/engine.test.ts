import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ENEMY_BULLET_SPEED,
  DARTER_MAX_DX,
  ENEMY_KIND_GUN,
  ENEMY_KIND_RADIUS,
  ENEMY_KIND_TIER,
  FIRE_INTERVAL_MS,
  HEAVY_SPREAD_COUNT,
  MAX_LIVES_CAP,
  MIN_ENEMY_FIRE_INTERVAL_MS,
  MIN_FIRE_INTERVAL_MS,
  MISSILE_MAX_LEVEL,
  POWER_MAX_LEVEL,
  RAPID_MAX_LEVEL,
  SHIP_MIN_Y,
  SHIP_RADIUS,
  SHIP_SPEED,
  SHIP_START_Y,
  SPREAD_MAX_LEVEL,
  STARTING_LIVES,
  WAVE_BREAK_MS,
} from './constants';
import {
  chooseReward,
  createInitialState,
  fireInterval,
  moveShipBy,
  setShipPos,
  step,
} from './engine';
import {
  LEVEL_COUNT,
  bossSpec,
  enemyFireIntervalMs,
  enemyHp,
  isBossStage,
  waveSpec,
  wavesInLevel,
} from './levels';
import type { Enemy, EnemyKind, GameState, WeaponUpgrades } from './types';
import { spawnWave } from './waves';

const STEP_MS = 1000 / 120;
const BREAK_STEPS = Math.ceil(WAVE_BREAK_MS / STEP_MS) + 1;

const NO_UPGRADES: WeaponUpgrades = { power: 0, rapid: 0, spread: 0, missile: 0 };
const MAXED_UPGRADES: WeaponUpgrades = {
  power: POWER_MAX_LEVEL,
  rapid: RAPID_MAX_LEVEL,
  spread: SPREAD_MAX_LEVEL,
  missile: MISSILE_MAX_LEVEL,
};

/** The share of a stage's mix that carries a gun — the §4 pressure lever. */
function armedShare(spec: ReturnType<typeof waveSpec>): number {
  let armed = 0;
  let total = 0;
  for (const entry of spec.mix) {
    total += entry.weight;
    if (ENEMY_KIND_GUN[entry.kind] !== 'none') armed += entry.weight;
  }
  return armed / total;
}

function stepMany(state: GameState, count: number, dtMs = STEP_MS): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = step(next, dtMs);
  return next;
}

/** Runs until the first wave has entered, so tests start from real content. */
function afterFirstWave(seed = 'test', level = 1, runSeed?: string): GameState {
  return stepMany(createInitialState(seed, level, runSeed), BREAK_STEPS);
}

/** Clears the wave on screen without touching anything else. */
function clearWave(state: GameState): GameState {
  return step({ ...state, enemies: [], bullets: [], missiles: [] }, STEP_MS);
}

/** A one-hit craft at a spot, for tests that only care about the kill. */
function frailEnemy(id: number, kind: EnemyKind, x = 180, y = 200): Enemy {
  return { id, x, y, dx: 0, dy: 0, tier: ENEMY_KIND_TIER[kind], kind, hp: 1 };
}

/** A craft of `kind` with enough hp to survive whatever the test does to it. */
function toughEnemy(kind: EnemyKind, over: Partial<Enemy> = {}): Enemy {
  return {
    id: 1,
    x: 180,
    y: 200,
    dx: 0,
    dy: 0,
    tier: ENEMY_KIND_TIER[kind],
    kind,
    hp: 9,
    ...over,
  };
}

/** Runs a boss stage up to the moment the boss is on screen and fighting. */
function withBoss(level = 10): GameState {
  const state = afterFirstWave('test', level);
  expect(state.boss).not.toBeNull();
  // Skip the entry descent: park it at fighting altitude.
  return { ...state, boss: { ...state.boss!, y: state.boss!.targetY } };
}

describe('sky-fighter levels', () => {
  it('difficulty keeps climbing all the way to stage 100 — nothing saturates early', () => {
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
      // Later stages field more kinds, and a larger share of them shoot (§4).
      expect(high.mix.length).toBeGreaterThanOrEqual(low.mix.length);
      expect(armedShare(high)).toBeGreaterThan(armedShare(low));
      expect(high.count).toBeGreaterThanOrEqual(low.count);
    }
    // Across the whole ladder every lever must actually have moved.
    expect(finalWave(LEVEL_COUNT).count).toBeGreaterThan(finalWave(1).count);
    expect(wavesInLevel(LEVEL_COUNT)).toBeGreaterThan(wavesInLevel(1));
  });

  it('within a stage the last wave is the hardest', () => {
    for (const level of [1, 40, 100]) {
      const waves = wavesInLevel(level);
      const first = waveSpec(level, 0);
      const last = waveSpec(level, waves - 1);
      expect(last.speedMin).toBeGreaterThan(first.speedMin);
      expect(last.count).toBeGreaterThan(first.count);
    }
  });

  it('stage bounds are clamped rather than extrapolated', () => {
    expect(waveSpec(0, 0)).toEqual(waveSpec(1, 0));
    expect(waveSpec(999, 0)).toEqual(waveSpec(LEVEL_COUNT, 0));
    expect(wavesInLevel(0)).toBe(wavesInLevel(1));
  });

  it('every tenth stage is a boss and no other stage is (§7)', () => {
    expect(isBossStage(9)).toBe(false);
    expect(isBossStage(10)).toBe(true);
    expect(isBossStage(19)).toBe(false);
    expect(isBossStage(20)).toBe(true);
    expect(isBossStage(1)).toBe(false);
    expect(isBossStage(100)).toBe(true);
  });

  it('the smallest craft stay one-shot kills for the whole ladder (§4)', () => {
    for (const level of [1, 50, 100]) {
      expect(enemyHp(level, 'scout')).toBe(1);
      expect(enemyHp(level, 'darter')).toBe(1);
    }
    expect(enemyHp(100, 'bomber')).toBeGreaterThan(enemyHp(1, 'bomber'));
    // The two craft built to soak are the two that carry the heavier guns.
    expect(enemyHp(1, 'heavy')).toBeGreaterThan(enemyHp(1, 'bomber'));
    expect(enemyHp(1, 'gunship')).toBeGreaterThan(enemyHp(1, 'fighter'));
  });

  it('boss archetypes cycle and every later boss of a kind is stronger (§7)', () => {
    expect(bossSpec(10).kind).toBe('fighter');
    expect(bossSpec(20).kind).toBe('bomber');
    expect(bossSpec(30).kind).toBe('carrier');
    expect(bossSpec(40).kind).toBe('fighter');
    expect(bossSpec(40).hp).toBeGreaterThan(bossSpec(10).hp);
    expect(bossSpec(40).fireIntervalMs).toBeLessThan(bossSpec(10).fireIntervalMs);
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

  it('the same seed and stage replay the same wave', () => {
    const a = spawnWave('seed-a', 3, 1, 1);
    const b = spawnWave('seed-a', 3, 1, 1);
    expect(a.enemies).toEqual(b.enemies);
    expect(spawnWave('seed-b', 3, 1, 1).enemies).not.toEqual(a.enemies);
    expect(spawnWave('seed-a', 4, 1, 1).enemies).not.toEqual(a.enemies);
  });

  it('every spawned enemy starts inside the board horizontally', () => {
    for (let level = 1; level <= LEVEL_COUNT; level += 7) {
      if (isBossStage(level)) continue;
      for (let w = 0; w < wavesInLevel(level); w++) {
        for (const enemy of spawnWave('bounds', level, w, 1).enemies) {
          const radius = ENEMY_KIND_RADIUS[enemy.kind];
          expect(enemy.x).toBeGreaterThanOrEqual(radius - 0.001);
          expect(enemy.x).toBeLessThanOrEqual(BOARD_WIDTH - radius + 0.001);
        }
      }
    }
  });

  it('fires on its own once a wave is on screen — the player never presses', () => {
    const firing = stepMany(afterFirstWave(), 30);
    expect(firing.bullets.length).toBeGreaterThan(0);
    expect(firing.bullets.every((b) => b.y < SHIP_START_Y)).toBe(true);
  });

  it('holds fire during the quiet beat between waves', () => {
    const start = stepMany(createInitialState('test'), 20);
    expect(start.waveBreakMs).toBeGreaterThan(0);
    expect(start.bullets).toHaveLength(0);
  });

  // ---------- 2D movement (§3) ----------

  it('the ship moves freely in both axes and never leaves its box', () => {
    let state = createInitialState();
    state = setShipPos(state, -900, -900);
    expect(state.shipX).toBe(SHIP_RADIUS);
    expect(state.shipY).toBe(SHIP_MIN_Y);
    state = moveShipBy(state, 9000, 9000);
    expect(state.shipX).toBe(BOARD_WIDTH - SHIP_RADIUS);
    expect(state.shipY).toBe(BOARD_HEIGHT - SHIP_RADIUS);
    state = moveShipBy(state, -40, -40);
    expect(state.shipX).toBe(BOARD_WIDTH - SHIP_RADIUS - 40);
    expect(state.shipY).toBe(BOARD_HEIGHT - SHIP_RADIUS - 40);
  });

  it('shots leave from wherever the ship is flying', () => {
    let state = afterFirstWave();
    state = setShipPos(state, 60, 300);
    state = step({ ...state, bullets: [], fireCooldownMs: 0 }, STEP_MS);
    expect(state.bullets.length).toBeGreaterThan(0);
    expect(state.bullets[0]!.y).toBeLessThan(300);
    expect(Math.abs(state.bullets[0]!.x - 60)).toBeLessThanOrEqual(6);
  });

  // ---------- enemies, hp and splitting (§4) ----------

  it('a downed bomber splits into two fighters and scores', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      enemies: [frailEnemy(1001, 'bomber')],
      bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
      score: 0,
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every((b) => b.kind === 'fighter')).toBe(true);
    expect(state.bullets).toHaveLength(0);
    expect(state.score).toBeGreaterThan(0);
  });

  it('an enemy with hp left survives the hit, flashes, and splits later (§4)', () => {
    const base = afterFirstWave();
    let state: GameState = {
      ...base,
      enemies: [toughEnemy('bomber', { hp: 2 })],
      bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]!.hp).toBe(1);
    expect(state.enemies[0]!.hitMs).toBeGreaterThan(0);

    state = {
      ...state,
      bullets: [{ x: state.enemies[0]!.x, y: state.enemies[0]!.y, dx: 0, dy: 0 }],
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(2);
  });

  it('Power raises the damage of one shot (§5)', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        upgrades: { ...NO_UPGRADES, power: 1 },
        enemies: [toughEnemy('bomber', { hp: 2 })],
        bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
      },
      STEP_MS,
    );
    // Two damage against two hp: down in one shot.
    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every((b) => b.kind === 'fighter')).toBe(true);
  });

  it('the smallest enemy is destroyed for good instead of splitting', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      enemies: [frailEnemy(999, 'scout')],
      bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(0);
  });

  it('one bullet spends itself on one enemy', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      enemies: [frailEnemy(901, 'scout', 180), frailEnemy(902, 'scout', 184)],
      bullets: [{ x: 182, y: 200, dx: 0, dy: 0 }],
    };
    state = step(state, STEP_MS);
    expect(state.enemies).toHaveLength(1);
  });

  it('enemies bounce off the side walls instead of leaving', () => {
    let state = afterFirstWave();
    const radius = ENEMY_KIND_RADIUS.bomber;
    state = {
      ...state,
      enemies: [toughEnemy('bomber', { id: 801, x: radius + 1, y: 100, dx: -80, hp: 2 })],
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
        toughEnemy('bomber', {
          id: 701,
          y: BOARD_HEIGHT + ENEMY_KIND_RADIUS.bomber - 1,
          dy: 200,
          hp: 2,
        }),
      ],
      bullets: [],
      lives: STARTING_LIVES,
    };
    state = step(state, 1000 / 60);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.status).not.toBe('failed');
  });

  // ---------- lives and the weapon/life split (§6) ----------

  it('touching a enemy costs a life and grants brief grace — never a weapon level', () => {
    let state = afterFirstWave();
    const upgrades = { power: 2, rapid: 1, spread: 3, missile: 1 };
    state = {
      ...state,
      shipX: 180,
      shipY: SHIP_START_Y,
      upgrades,
      enemies: [toughEnemy('bomber', { id: 601, y: SHIP_START_Y, hp: 2 })],
      bullets: [],
      lives: STARTING_LIVES,
      invulnerableMs: 0,
    };
    state = step(state, STEP_MS);
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.invulnerableMs).toBeGreaterThan(0);
    expect(state.upgrades).toEqual(upgrades);
  });

  it('grace actually protects: a second enemy in the same instant is survivable', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      shipY: SHIP_START_Y,
      enemies: [
        toughEnemy('bomber', { id: 501, y: SHIP_START_Y, hp: 2 }),
        toughEnemy('bomber', { id: 502, y: SHIP_START_Y, hp: 2 }),
      ],
      bullets: [],
      lives: 2,
      invulnerableMs: 0,
    };
    state = stepMany(state, 2);
    expect(state.lives).toBe(1);
    expect(state.status).toBe('playing');
  });

  it('losing the last life fails the run', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      shipY: SHIP_START_Y,
      enemies: [toughEnemy('bomber', { id: 401, y: SHIP_START_Y, hp: 2 })],
      bullets: [],
      lives: 1,
      invulnerableMs: 0,
    };
    state = step(state, STEP_MS);
    expect(state.status).toBe('failed');
    expect(step(state, STEP_MS)).toBe(state);
  });

  // ---------- stages flow on (§2, §7) ----------

  it('clearing every wave of a stage flies on into the next stage, carrying the build', () => {
    let state = afterFirstWave('test', 1);
    state = { ...state, upgrades: { ...NO_UPGRADES, spread: 2 }, lives: 2 };
    const waves = wavesInLevel(1);
    for (let w = 0; w < waves - 1; w++) {
      state = clearWave(state);
      expect(state.status).toBe('playing');
      expect(state.level).toBe(1);
      state = stepMany(state, BREAK_STEPS);
      expect(state.waveInLevel).toBe(w + 1);
    }
    state = clearWave(state);
    expect(state.status).toBe('playing');
    expect(state.level).toBe(2);
    expect(state.waveInLevel).toBe(-1);
    expect(state.waveBreakMs).toBeGreaterThan(0);
    // The run's build and hearts ride along (§2).
    expect(state.upgrades.spread).toBe(2);
    expect(state.lives).toBe(2);
  });

  it('a bomber shot in flight does not survive into the quiet break', () => {
    const base = afterFirstWave();
    const state = clearWave({ ...base, enemyBullets: [{ x: 40, y: 100, dx: 0, dy: 100 }] });
    expect(state.waveBreakMs).toBeGreaterThan(0);
    expect(state.enemyBullets).toHaveLength(0);
  });

  it('a failed run is final — stepping it again changes nothing', () => {
    let state = afterFirstWave();
    state = { ...state, lives: 0, status: 'failed' };
    expect(step(state, STEP_MS)).toBe(state);
  });

  // ---------- the weapon axes (§5) ----------

  it('Spread fires 1..5 barrels across its levels', () => {
    const base = afterFirstWave();
    for (const [spread, expected] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ] as const) {
      const fired = step(
        { ...base, upgrades: { ...NO_UPGRADES, spread }, bullets: [], fireCooldownMs: 0 },
        STEP_MS,
      );
      expect(fired.bullets).toHaveLength(expected);
    }
  });

  it('the outer barrels of a fan spread out instead of stacking', () => {
    const state = step(
      {
        ...afterFirstWave(),
        upgrades: { ...NO_UPGRADES, spread: 2 },
        bullets: [],
        fireCooldownMs: 0,
      },
      STEP_MS,
    );
    const sideways = state.bullets.filter((b) => b.dx !== 0);
    expect(sideways).toHaveLength(2);
    expect(sideways.some((b) => b.dx < 0)).toBe(true);
    expect(sideways.some((b) => b.dx > 0)).toBe(true);
    expect(state.bullets.every((b) => b.dy < 0)).toBe(true);
  });

  it('Rapid shortens the firing interval and never passes the floor', () => {
    expect(fireInterval(0)).toBe(FIRE_INTERVAL_MS);
    expect(fireInterval(1)).toBeLessThan(FIRE_INTERVAL_MS);
    expect(fireInterval(RAPID_MAX_LEVEL)).toBeGreaterThanOrEqual(MIN_FIRE_INTERVAL_MS);
    expect(fireInterval(99)).toBe(MIN_FIRE_INTERVAL_MS);
  });

  it('Missile launches homing shots that spend themselves on a target (§5)', () => {
    const base = afterFirstWave();
    let state: GameState = {
      ...base,
      upgrades: { ...NO_UPGRADES, missile: 2 },
      enemies: [toughEnemy('bomber', { y: 300, hp: 99 })],
      bullets: [],
      missiles: [],
      fireCooldownMs: 5000,
      missileCooldownMs: 0,
    };
    state = step(state, STEP_MS);
    expect(state.missiles).toHaveLength(2);
    expect(state.missiles.every((m) => m.targetId === 1)).toBe(true);

    // Left alone, the missiles curve into the enemy and are spent on it.
    let hits = 0;
    for (let i = 0; i < 400 && hits === 0; i++) {
      const before = state.missiles.length;
      state = step({ ...state, fireCooldownMs: 5000, missileCooldownMs: 5000 }, STEP_MS);
      if (state.missiles.length < before && state.enemies[0]!.hp < 99) hits += 1;
    }
    expect(hits).toBeGreaterThan(0);
  });

  // ---------- items (§5, §6) ----------

  it('only the smallest enemies can drop — chipping earns nothing', () => {
    const base = afterFirstWave();
    let fromBig = 0;
    for (let id = 1; id <= 120; id++) {
      const downed = step(
        {
          ...base,
          enemies: [frailEnemy(id, 'bomber')],
          bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
          items: [],
        },
        STEP_MS,
      );
      fromBig += downed.items.length;
    }
    expect(fromBig).toBe(0);
  });

  it('some smallest-tier kills drop and most do not, deterministically per run', () => {
    const base = afterFirstWave();
    // Which enemy ids drop, and what — the run's whole payout pattern.
    const dropPattern = (runSeed: string) => {
      const drops: string[] = [];
      for (let id = 1; id <= 400; id++) {
        const downed = step(
          {
            ...base,
            runSeed,
            enemies: [frailEnemy(id, 'scout')],
            bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
            items: [],
          },
          STEP_MS,
        );
        for (const item of downed.items) drops.push(`${id}:${item.kind}`);
      }
      return drops.join('|');
    };
    const a = dropPattern('run-a');
    expect(a.length).toBeGreaterThan(0);
    expect(a.split('|').length).toBeLessThan(400);
    // The same run rolls the same; another run rolls its own skies (§1).
    expect(dropPattern('run-a')).toBe(a);
    expect(dropPattern('run-b')).not.toBe(a);
  });

  it('never puts a second item on screen while one is still falling', () => {
    const base = afterFirstWave();
    let extra = 0;
    for (let id = 1; id <= 200; id++) {
      const state = step(
        {
          ...base,
          enemies: [frailEnemy(id, 'scout')],
          bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
          items: [{ id: 900, x: 40, y: 100, kind: 'weapon' }],
        },
        STEP_MS,
      );
      extra += state.items.length - 1;
    }
    expect(extra).toBe(0);
  });

  it('an uncaught item falls off the bottom and is gone', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 20,
      shipY: SHIP_START_Y,
      items: [{ id: 1, x: 340, y: BOARD_HEIGHT - 1, kind: 'weapon' }],
      enemies: [],
      bullets: [],
    };
    state = stepMany(state, 20);
    expect(state.items).toHaveLength(0);
    expect(state.upgrades).toEqual(NO_UPGRADES);
  });

  it('a caught weapon crate raises exactly one axis by one and leaves lives alone', () => {
    let state = afterFirstWave();
    state = {
      ...state,
      shipX: 180,
      shipY: SHIP_START_Y,
      items: [{ id: 1, x: 180, y: SHIP_START_Y, kind: 'weapon' }],
      enemies: [],
      bullets: [],
      lives: 2,
      maxLives: 3,
    };
    state = step(state, STEP_MS);
    expect(state.items).toHaveLength(0);
    const total =
      state.upgrades.power + state.upgrades.rapid + state.upgrades.spread + state.upgrades.missile;
    expect(total).toBe(1);
    expect(state.lives).toBe(2);
    expect(state.maxLives).toBe(3);
    expect(state.pickup).not.toBeNull();
  });

  it('a capped axis is never the random pick (§5)', () => {
    const base = afterFirstWave();
    const nearlyMaxed = { ...MAXED_UPGRADES, missile: 0 };
    for (let i = 1; i <= 30; i++) {
      const state = step(
        {
          ...base,
          shipX: 180,
          shipY: SHIP_START_Y,
          upgrades: nearlyMaxed,
          pickup: { kind: 'life', seq: i * 7 },
          items: [{ id: i, x: 180, y: SHIP_START_Y, kind: 'weapon' }],
          enemies: [],
          bullets: [],
        },
        STEP_MS,
      );
      expect(state.upgrades.missile).toBe(1);
      expect(state.upgrades.power).toBe(POWER_MAX_LEVEL);
    }
  });

  it('a weapon crate with everything capped converts to score instead', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        shipX: 180,
        shipY: SHIP_START_Y,
        upgrades: MAXED_UPGRADES,
        items: [{ id: 1, x: 180, y: SHIP_START_Y, kind: 'weapon' }],
        enemies: [],
        bullets: [],
        score: 0,
      },
      STEP_MS,
    );
    expect(state.upgrades).toEqual(MAXED_UPGRADES);
    expect(state.score).toBeGreaterThan(0);
    expect(state.pickup?.kind).toBe('bonus');
  });

  it('a Life item restores one heart and never passes the maximum (§6)', () => {
    const base = afterFirstWave();
    const catchLife = (lives: number) =>
      step(
        {
          ...base,
          shipX: 180,
          shipY: SHIP_START_Y,
          lives,
          maxLives: 3,
          items: [{ id: 1, x: 180, y: SHIP_START_Y, kind: 'life' }],
          enemies: [],
          bullets: [],
        },
        STEP_MS,
      );
    expect(catchLife(1).lives).toBe(2);
    // Catchable at full; it simply cannot overfill (§6).
    const full = catchLife(3);
    expect(full.lives).toBe(3);
    expect(full.items).toHaveLength(0);
  });

  it('a Max Life item raises the cap and fills the new heart (§6)', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        shipX: 180,
        shipY: SHIP_START_Y,
        lives: 2,
        maxLives: 3,
        items: [{ id: 1, x: 180, y: SHIP_START_Y, kind: 'maxlife' }],
        enemies: [],
        bullets: [],
      },
      STEP_MS,
    );
    expect(state.maxLives).toBe(4);
    expect(state.lives).toBe(3);
  });

  it('Max Life never passes its hard cap (§6)', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        shipX: 180,
        shipY: SHIP_START_Y,
        lives: MAX_LIVES_CAP - 1,
        maxLives: MAX_LIVES_CAP,
        items: [{ id: 1, x: 180, y: SHIP_START_Y, kind: 'maxlife' }],
        enemies: [],
        bullets: [],
      },
      STEP_MS,
    );
    expect(state.maxLives).toBe(MAX_LIVES_CAP);
    // At the cap it still restores, like a Life item.
    expect(state.lives).toBe(MAX_LIVES_CAP);
  });

  // ---------- bombers still shoot back (§4) ----------

  /** Runs one craft on its own for a few frames and returns what it fired. */
  function shotsFrom(kind: EnemyKind, over: Partial<Enemy> = {}, frames = 4) {
    const base = afterFirstWave();
    return stepMany(
      {
        ...base,
        enemies: [toughEnemy(kind, { fireCooldownMs: 1, ...over })],
        bullets: [],
        enemyBullets: [],
      },
      frames,
    ).enemyBullets;
  }

  it('three of the six kinds shoot, and three do not (§4)', () => {
    for (const kind of ['bomber', 'heavy', 'gunship'] as const) {
      expect(shotsFrom(kind).length).toBeGreaterThan(0);
    }
    for (const kind of ['fighter', 'scout', 'darter'] as const) {
      expect(shotsFrom(kind)).toHaveLength(0);
    }
  });

  it('a bomber fires one shot straight down its own column (§4)', () => {
    const shots = shotsFrom('bomber');
    expect(shots).toHaveLength(1);
    expect(shots[0]!.dx).toBe(0);
    expect(shots[0]!.dy).toBeGreaterThan(0);
  });

  it('a heavy fires a downward curtain, not a single shot (§4)', () => {
    const shots = shotsFrom('heavy');
    expect(shots).toHaveLength(HEAVY_SPREAD_COUNT);
    // Every shot travels down, and the curtain opens to both sides.
    expect(shots.every((shot) => shot.dy > 0)).toBe(true);
    expect(Math.min(...shots.map((shot) => shot.dx))).toBeLessThan(0);
    expect(Math.max(...shots.map((shot) => shot.dx))).toBeGreaterThan(0);
  });

  it('a gunship shoots at where the ship is, from either side (§4)', () => {
    // Ship sits left of the craft: the shot must lean left, and the mirror
    // case must lean right. Aim, not a fixed direction.
    const left = shotsFrom('gunship', { x: 300 })[0]!;
    const right = shotsFrom('gunship', { x: 60 })[0]!;
    expect(left.dx).toBeLessThan(0);
    expect(right.dx).toBeGreaterThan(0);
    expect(left.dy).toBeGreaterThan(0);
    expect(right.dy).toBeGreaterThan(0);
  });

  it('every enemy gun gets quicker with the ladder and stops at a floor (§4)', () => {
    for (const kind of ['bomber', 'heavy', 'gunship'] as const) {
      expect(enemyFireIntervalMs(100, kind)).toBeLessThan(enemyFireIntervalMs(1, kind));
      expect(enemyFireIntervalMs(100, kind)).toBeGreaterThanOrEqual(MIN_ENEMY_FIRE_INTERVAL_MS);
    }
    for (const kind of ['fighter', 'scout', 'darter'] as const) {
      expect(enemyFireIntervalMs(50, kind)).toBe(0);
    }
  });

  it('a darter steers toward the ship instead of falling past it (§4)', () => {
    const base = afterFirstWave();
    const start = 60;
    const state = stepMany(
      {
        ...base,
        shipX: 300,
        enemies: [toughEnemy('darter', { x: start, dx: 0, dy: 0 })],
        bullets: [],
      },
      30,
    );
    const darter = state.enemies[0]!;
    expect(darter.x).toBeGreaterThan(start);
    // Never faster sideways than the ship, so it is always out-flyable.
    expect(Math.abs(darter.dx)).toBeLessThanOrEqual(DARTER_MAX_DX);
    expect(DARTER_MAX_DX).toBeLessThan(SHIP_SPEED);
  });

  it('no armed craft fires from above the top edge', () => {
    for (const kind of ['bomber', 'heavy', 'gunship'] as const) {
      expect(shotsFrom(kind, { y: -30 })).toHaveLength(0);
    }
  });

  it('an enemy shot travels downward and leaves the board', () => {
    const base = afterFirstWave();
    let state: GameState = {
      ...base,
      bullets: [],
      enemyBullets: [{ x: 40, y: 100, dx: 0, dy: ENEMY_BULLET_SPEED }],
    };
    const before = state.enemyBullets[0]!.y;
    state = step(state, STEP_MS);
    expect(state.enemyBullets[0]!.y).toBeGreaterThan(before);

    state = { ...state, enemyBullets: [{ x: 40, y: BOARD_HEIGHT, dx: 0, dy: ENEMY_BULLET_SPEED }] };
    state = stepMany(state, 10);
    expect(state.enemyBullets).toHaveLength(0);
    // Slow enough to walk around rather than react to.
    expect(ENEMY_BULLET_SPEED).toBeLessThan(300);
  });

  it('being shot costs a life and a grace period, exactly like being run into', () => {
    const base = afterFirstWave();
    const state = step(
      {
        ...base,
        shipX: 180,
        shipY: SHIP_START_Y,
        upgrades: { ...NO_UPGRADES, spread: 2 },
        enemies: [],
        bullets: [],
        enemyBullets: [{ x: 180, y: SHIP_START_Y, dx: 0, dy: 0 }],
        lives: STARTING_LIVES,
        invulnerableMs: 0,
      },
      STEP_MS,
    );
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.upgrades.spread).toBe(2);
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
        shipY: SHIP_START_Y,
        enemies: [],
        bullets: [],
        enemyBullets: [{ x: 180, y: SHIP_START_Y, dx: 0, dy: 0 }],
        lives: STARTING_LIVES,
        invulnerableMs: 500,
      },
      STEP_MS,
    );
    expect(state.lives).toBe(STARTING_LIVES);
  });

  it('an armed formation does not fire on the same beat', () => {
    const { enemies } = spawnWave('stagger', 99, 0, 1);
    const cooldowns = enemies
      .filter((e) => ENEMY_KIND_GUN[e.kind] !== 'none')
      .map((e) => e.fireCooldownMs)
      .filter((c): c is number => c !== undefined);
    expect(cooldowns.length).toBeGreaterThan(1);
    expect(new Set(cooldowns).size).toBe(cooldowns.length);
    for (const enemy of enemies) {
      if (ENEMY_KIND_GUN[enemy.kind] === 'none') continue;
      expect(enemy.fireCooldownMs).toBeLessThanOrEqual(enemyFireIntervalMs(99, enemy.kind) * 1.3);
    }
  });

  /** Downs one craft with a point-blank shot and returns what it left behind. */
  function splitOf(kind: EnemyKind): Enemy[] {
    const base = afterFirstWave();
    return step(
      {
        ...base,
        enemies: [frailEnemy(1, kind)],
        bullets: [{ x: 180, y: 200, dx: 0, dy: 0 }],
        enemyBullets: [],
      },
      STEP_MS,
    ).enemies;
  }

  it('a bomber comes apart into something quieter than it was (§4)', () => {
    const children = splitOf('bomber');
    expect(children).toHaveLength(2);
    expect(children.every((e) => ENEMY_KIND_GUN[e.kind] === 'none')).toBe(true);
  });

  it('the heavy is the exception: its halves are armed (§4)', () => {
    const children = splitOf('heavy');
    expect(children).toHaveLength(2);
    expect(children.every((e) => e.kind === 'gunship')).toBe(true);
    // ...and they do not both fire the instant they appear.
    const cooldowns = children.map((e) => e.fireCooldownMs);
    expect(cooldowns.every((c) => c !== undefined && c > 0)).toBe(true);
    expect(new Set(cooldowns).size).toBe(2);
  });

  it('a gunship comes apart into unarmed scouts (§4)', () => {
    const children = splitOf('gunship');
    expect(children).toHaveLength(2);
    expect(children.every((e) => e.kind === 'scout')).toBe(true);
  });

  it('the two smallest craft leave nothing behind (§4)', () => {
    expect(splitOf('scout')).toHaveLength(0);
    expect(splitOf('darter')).toHaveLength(0);
  });

  // ---------- a fresh run starts from nothing (§2) ----------

  it('every run starts unarmed at three hearts — nothing is carried over', () => {
    for (const level of [1, 50, LEVEL_COUNT]) {
      const state = createInitialState('a', level);
      expect(state.level).toBe(level);
      expect(state.upgrades).toEqual(NO_UPGRADES);
      expect(state.items).toHaveLength(0);
      expect(state.lives).toBe(STARTING_LIVES);
      expect(state.maxLives).toBe(STARTING_LIVES);
      expect(state.boss).toBeNull();
      expect(state.rewardOptions).toBeNull();
    }
  });
});

describe('sky-fighter bosses (§7, §8)', () => {
  it('a boss stage opens with the boss instead of a wave', () => {
    const state = afterFirstWave('test', 10);
    expect(state.boss).not.toBeNull();
    expect(state.enemies).toHaveLength(0);
    expect(state.boss!.kind).toBe('fighter');
    expect(state.boss!.hp).toBe(state.boss!.maxHp);
  });

  it('stage 9 and 19 open with plain waves', () => {
    for (const level of [9, 19]) {
      const state = afterFirstWave('test', level);
      expect(state.boss).toBeNull();
      expect(state.enemies.length).toBeGreaterThan(0);
    }
  });

  it('the boss descends, then patrols and fires its pattern', () => {
    let state = afterFirstWave('test', 10);
    const entryY = state.boss!.y;
    state = stepMany(state, 240);
    expect(state.boss!.y).toBeGreaterThan(entryY);
    expect(state.boss!.y).toBeLessThanOrEqual(state.boss!.targetY + 0.001);
    // Enough steps at altitude for at least one volley.
    state = stepMany(state, 400);
    expect(state.enemyBullets.length).toBeGreaterThan(0);
  });

  it('the carrier launches darts', () => {
    let state = withBoss(30);
    expect(state.boss!.kind).toBe('carrier');
    state = stepMany(state, 800);
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(state.enemies.every((e) => e.kind === 'darter')).toBe(true);
  });

  it('player fire wears the boss down and a surviving hit flashes it', () => {
    let state = withBoss(10);
    const boss = state.boss!;
    state = step(
      { ...state, bullets: [{ x: boss.x, y: boss.y, dx: 0, dy: 0 }], fireCooldownMs: 5000 },
      STEP_MS,
    );
    expect(state.boss!.hp).toBe(boss.maxHp - 1);
    expect(state.boss!.hitMs).toBeGreaterThan(0);
  });

  it('running into the boss costs a life like any other hull', () => {
    let state = withBoss(10);
    const boss = state.boss!;
    state = step(
      {
        ...state,
        shipX: boss.x,
        shipY: boss.targetY,
        lives: STARTING_LIVES,
        invulnerableMs: 0,
        bullets: [],
      },
      STEP_MS,
    );
    expect(state.lives).toBe(STARTING_LIVES - 1);
  });

  it('the boss falls once: score, a clean sky, and the reward offer (§8)', () => {
    let state = withBoss(10);
    state = {
      ...state,
      boss: { ...state.boss!, hp: 1 },
      enemyBullets: [{ x: 10, y: 10, dx: 0, dy: 50 }],
      score: 0,
    };
    state = step(
      { ...state, bullets: [{ x: state.boss!.x, y: state.boss!.y, dx: 0, dy: 0 }] },
      STEP_MS,
    );
    expect(state.boss).toBeNull();
    expect(state.status).toBe('reward');
    expect(state.score).toBeGreaterThan(0);
    expect(state.enemyBullets).toHaveLength(0);
    expect(state.rewardOptions).not.toBeNull();
    expect(state.rewardOptions!.length).toBeGreaterThan(0);
    // The offer pauses the world (§8).
    expect(step(state, STEP_MS)).toBe(state);
  });

  it('reward options never repeat and never offer a capped axis (§8)', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      let state = withBoss(10);
      state = {
        ...state,
        runSeed: `roll-${attempt}`,
        upgrades: { ...NO_UPGRADES, power: POWER_MAX_LEVEL },
        boss: { ...state.boss!, hp: 1 },
      };
      state = step(
        { ...state, bullets: [{ x: state.boss!.x, y: state.boss!.y, dx: 0, dy: 0 }] },
        STEP_MS,
      );
      const options = state.rewardOptions!;
      expect(new Set(options).size).toBe(options.length);
      expect(options).not.toContain('power');
    }
  });

  it('choosing a reward applies exactly that reward and flies into the next stage (§8)', () => {
    let state = withBoss(10);
    state = { ...state, boss: { ...state.boss!, hp: 1 } };
    state = step(
      { ...state, bullets: [{ x: state.boss!.x, y: state.boss!.y, dx: 0, dy: 0 }] },
      STEP_MS,
    );
    const options = state.rewardOptions!;
    const index = options.findIndex((kind) => kind === 'spread');
    const pick = index === -1 ? 0 : index;
    const chosen = options[pick]!;
    const before = state.upgrades;

    const after = chooseReward(state, pick);
    expect(after.status).toBe('playing');
    expect(after.level).toBe(11);
    expect(after.waveInLevel).toBe(-1);
    expect(after.rewardOptions).toBeNull();
    if (chosen === 'spread') {
      expect(after.upgrades.spread).toBe(before.spread + 1);
      expect(after.upgrades.power).toBe(before.power);
      expect(after.lives).toBe(state.lives);
    }
  });

  it('felling the stage-100 boss clears the run (§2)', () => {
    let state = withBoss(100);
    state = { ...state, boss: { ...state.boss!, hp: 1 } };
    state = step(
      { ...state, bullets: [{ x: state.boss!.x, y: state.boss!.y, dx: 0, dy: 0 }] },
      STEP_MS,
    );
    expect(state.status).toBe('cleared');
    expect(state.rewardOptions).toBeNull();
    expect(step(state, STEP_MS)).toBe(state);
  });
});
