import { describe, expect, it } from 'vitest';
import {
  BURST_GAP_TICKS,
  createSession,
  DIVE_EVERY_MAX,
  DIVE_GRACE_TICKS,
  DIVE_MAX,
  DIVE_SWOOP_TICKS,
  DIVE_TICKS,
  ENEMY_FIRE_TICKS_MAX,
  enemyFirePeriod,
  enemyPosition,
  expectedScore,
  finished,
  formation,
  LAYOUT_IDS,
  layoutPoints,
  layoutSlots,
  MAX_SCORE,
  movePlayer,
  nextStage,
  pause,
  PLAYER_Y,
  stageSpec,
  stageSpeed,
  STAGES,
  start,
  step,
  STAGE_COUNT,
  type LayoutId,
  type Session,
} from './index';
const running = (patch: Partial<Session> = {}): Session => ({
  ...start(createSession()),
  ...patch,
});
/** A session dealt as `stage` would be, with the run's score counted from zero. */
const atStage = (stage: number, patch: Partial<Session> = {}): Session => {
  const spec = stageSpec(stage);
  return running({
    stage,
    layout: spec.layout,
    enemies: formation(spec.layout, spec.drop),
    stageScoreBase: 0,
    score: 0,
    ...patch,
  });
};
describe('Invaders simulation', () => {
  it('requires explicit start and clamps horizontal input', () => {
    const state = createSession();
    expect(state.lives).toBe(3);
    expect(state.enemies).toHaveLength(28);
    expect(state.covers).toHaveLength(15);
    expect(step(state)).toBe(state);
    expect(movePlayer(state, -100).playerX).toBe(16);
    expect(movePlayer(state, 1000).playerX).toBe(344);
    expect(movePlayer(state, NaN)).toBe(state);
    const stopped = pause(start(state));
    expect(step(stopped)).toBe(stopped);
    expect(start(stopped).status).toBe('running');
  });
  it('reverses and descends the formation without mutating its input', () => {
    const state = running({ enemies: [{ id: 0, x: 342.9, y: 55 }], fireTicks: 5 });
    const before = structuredClone(state);
    const next = step(state);
    expect(next.direction).toBe(-1);
    expect(next.enemies[0]?.y).toBe(67);
    expect(state).toEqual(before);
  });
  it('uses swept collisions and awards row points once', () => {
    const state = running({
      enemies: [{ id: 14, x: 180, y: 140 }],
      score: 680,
      covers: [],
      fireTicks: 5,
      bullets: [{ id: 0, x: 180, y: 157, owner: 'player' }],
      nextBulletId: 1,
    });
    const next = step(state);
    expect(next.status).toBe('between');
    expect(next.score).toBe(700);
    expect(next.bullets).toHaveLength(0);
    expect(step(next)).toBe(next);
  });
  it('damages cover from both sides and clears it on the second hit', () => {
    const base = running({ fireTicks: 5 });
    const brick = base.covers[1]!;
    const hit1 = step({
      ...base,
      bullets: [{ id: 0, x: brick.x, y: brick.y + 10, owner: 'player' }],
      nextBulletId: 1,
    });
    expect(hit1.covers[1]?.hp).toBe(1);
    const hit2 = step({
      ...hit1,
      bullets: [{ id: 1, x: brick.x, y: brick.y - 10, owner: 'enemy' }],
      nextBulletId: 2,
    });
    expect(hit2.covers[1]?.hp).toBe(0);
  });
  it('spends one life per hit; simultaneous shots cannot consume extra lives', () => {
    const bullets = [0, 1, 2].map((id) => ({
      id,
      x: 180,
      y: PLAYER_Y - 12,
      owner: 'enemy' as const,
    }));
    const next = step(
      running({ bullets, nextBulletId: 3, invulnerableTicks: 0, covers: [], fireTicks: 5 }),
    );
    expect(next.lives).toBe(2);
    expect(next.invulnerableTicks).toBe(45);
    expect(next.bullets).toHaveLength(0);
    const loss = step(
      running({
        lives: 1,
        bullets,
        nextBulletId: 3,
        invulnerableTicks: 0,
        covers: [],
        fireTicks: 5,
      }),
    );
    expect(loss.status).toBe('lost');
    expect(step(loss)).toBe(loss);
  });
  it('loses at the defense line regardless of remaining lives', () => {
    const next = step(running({ enemies: [{ id: 0, x: 180, y: 402 }] }));
    expect(next.status).toBe('lost');
    expect(next.lives).toBe(3);
  });
  it('waits between stages, repairs cover without restoring lives, and wins only at stage 20', () => {
    const state = step(
      running({
        lives: 2,
        enemies: [],
        score: 700,
        covers: createSession().covers.map((cell) => ({ ...cell, hp: 0 })),
      }),
    );
    expect(state.status).toBe('between');
    const next = nextStage(state);
    expect(next.status).toBe('ready');
    expect(next.stage).toBe(2);
    expect(next.lives).toBe(2);
    expect(next.covers.every((cell) => cell.hp === 2)).toBe(true);
    const won = step(running({ stage: STAGE_COUNT, enemies: [] }));
    expect(won.status).toBe('won');
    expect(nextStage(won)).toBe(won);
  });
  it('increases difficulty at every stage and as the formation thins', () => {
    for (let stage = 2; stage <= STAGE_COUNT; stage += 1) {
      expect(stageSpeed(stage, 28)).toBeGreaterThan(stageSpeed(stage - 1, 28));
      expect(enemyFirePeriod(stage)).toBeLessThan(enemyFirePeriod(stage - 1));
    }
    expect(stageSpeed(1, 1)).toBeGreaterThan(stageSpeed(1, 28));
  });
  it('is deterministic and bounded through a first-stage tracking-pilot playthrough', () => {
    let a = start(createSession());
    let b = start(createSession());
    let maxBullets = 0;
    for (let tick = 0; tick < 30000 && !finished(a) && a.status !== 'between'; tick += 1) {
      const target = [...a.enemies].sort(
        (x, y) => y.y - x.y || Math.abs(x.x - a.playerX) - Math.abs(y.x - a.playerX),
      )[0]!;
      const x =
        target.x +
        (a.direction * stageSpeed(a.stage, a.enemies.length) * (PLAYER_Y - target.y)) / 360;
      a = step(movePlayer(a, x));
      b = step(movePlayer(b, x));
      expect(a).toEqual(b);
      maxBullets = Math.max(maxBullets, a.bullets.length);
      expect(a.elapsedSeconds).toBe(Math.floor(a.ticks / 30));
    }
    expect(maxBullets).toBeLessThanOrEqual(13);
    expect(a.status).toBe('between');
    expect(a.score).toBe(700);
  });
});

describe('the stage table (docs/INVADERS_RULES.md §1, §3)', () => {
  it('deals twenty stages, the first of them the classic block exactly', () => {
    expect(STAGES).toHaveLength(STAGE_COUNT);
    expect(stageSpec(1)).toEqual({
      layout: 'full',
      drop: 0,
      fire: 'rotate',
      descent: 12,
      diveEvery: 0,
      diveMax: 0,
    });
    expect(createSession().enemies).toEqual(formation('full', 0));
    expect(stageSpec(0)).toEqual(stageSpec(1));
    expect(stageSpec(99)).toEqual(stageSpec(STAGE_COUNT));
  });
  it('keeps every row inside the bounds the engine and the save validator assume', () => {
    for (const spec of STAGES) {
      expect(LAYOUT_IDS).toContain(spec.layout);
      expect(spec.drop).toBeGreaterThanOrEqual(0);
      expect(spec.drop).toBeLessThanOrEqual(4);
      expect([12, 18]).toContain(spec.descent);
      // A faster descent is asked only of the smaller formations.
      if (spec.descent === 18) expect(layoutSlots(spec.layout).length).toBeLessThanOrEqual(20);
      expect(spec.diveMax).toBeLessThanOrEqual(DIVE_MAX);
      expect(spec.diveEvery).toBeLessThanOrEqual(DIVE_EVERY_MAX);
      expect(spec.diveEvery === 0).toBe(spec.diveMax === 0);
      if (spec.diveEvery) expect(spec.diveEvery).toBeGreaterThanOrEqual(DIVE_GRACE_TICKS - 15);
    }
    // The three voices and the diver each arrive before the half-way point.
    expect(STAGES.findIndex((spec) => spec.fire === 'aimed')).toBeLessThan(5);
    expect(STAGES.findIndex((spec) => spec.fire === 'burst')).toBeLessThan(5);
    expect(STAGES.findIndex((spec) => spec.diveMax > 0)).toBeLessThan(10);
    // After the opening pair (the classic block, then the same block lower), no two
    // neighbouring stages are dealt the same shape.
    for (let i = 2; i < STAGES.length; i += 1)
      expect(STAGES[i]!.layout).not.toBe(STAGES[i - 1]!.layout);
  });
  it('shapes every layout from the 4 × 7 grid and prices it by row', () => {
    const sizes: Record<LayoutId, number> = {
      full: 28,
      wings: 24,
      arrow: 16,
      wedge: 16,
      ring: 18,
      stair: 22,
      'stair-mirror': 22,
      pillars: 16,
      hourglass: 20,
      checker: 14,
    };
    for (const layout of LAYOUT_IDS) {
      const slots = layoutSlots(layout);
      expect(slots).toHaveLength(sizes[layout]);
      expect([...slots].sort((a, b) => a - b)).toEqual(slots);
      expect(slots.every((id) => id >= 0 && id < 28)).toBe(true);
      // The formation a layout deals spans the full width, so every shape sweeps the same way.
      const dealt = formation(layout, 0);
      expect(Math.min(...dealt.map((e) => e.x))).toBe(60);
      expect(Math.max(...dealt.map((e) => e.x))).toBe(300);
    }
    expect(layoutSlots('wings').some((id) => id % 7 === 3)).toBe(false);
    expect(layoutSlots('arrow').filter((id) => id >= 21)).toEqual([24]);
    expect(layoutSlots('wedge').filter((id) => id < 7)).toEqual([3]);
    expect(layoutSlots('ring').filter((id) => id >= 7 && id < 21)).toEqual([7, 13, 14, 20]);
    expect(layoutPoints('full')).toBe(700);
    expect(layoutPoints('arrow')).toBe(500);
    expect(layoutPoints('wedge')).toBe(300);
    expect(MAX_SCORE).toBe(STAGES.reduce((sum, spec) => sum + layoutPoints(spec.layout), 0));
    expect(MAX_SCORE).toBe(10960);
    expect(MAX_SCORE).toBeLessThanOrEqual(14000);
  });
  it('enters lower on later stages and deals the next shape when a stage is cleared', () => {
    expect(formation('full', 1)[0]).toEqual({ id: 0, x: 60, y: 67 });
    expect(formation('full', 3)[27]).toEqual({ id: 27, x: 300, y: 55 + 36 + 96 });
    const cleared = running({ enemies: [], score: 700, status: 'between' });
    const second = nextStage(cleared);
    expect(second.layout).toBe('full');
    expect(second.stageScoreBase).toBe(700);
    expect(second.diveTicks).toBe(DIVE_GRACE_TICKS);
    expect(second.enemies[0]?.y).toBe(67);
    const third = nextStage({ ...second, status: 'between', enemies: [], score: 1400 });
    expect(third.layout).toBe('wings');
    expect(third.stageScoreBase).toBe(1400);
    expect(third.enemies).toHaveLength(24);
    expect(expectedScore(third)).toBe(1400);
  });
  it('thins to the same top speed whatever the formation started as', () => {
    expect(stageSpeed(1, 28)).toBe(23.5);
    expect(stageSpeed(1, 28, 28)).toBe(stageSpeed(1, 28));
    expect(stageSpeed(5, 1, 14)).toBe(stageSpeed(5, 1, 28));
    expect(stageSpeed(5, 14, 14)).toBe(stageSpeed(5, 28, 28));
    expect(stageSpeed(5, 7, 14)).toBeGreaterThan(stageSpeed(5, 21, 28));
  });
});

describe('the three voices of fire and the descent (§3)', () => {
  it('rotates on a classic stage and fires from the column above the ship on an aimed one', () => {
    // The line moves before it fires, so a shot leaves a column's x less than a pixel on.
    const shots = (s: Session) =>
      s.bullets.filter((b) => b.owner === 'enemy').map((b) => Math.round(b.x));
    const classic = step(running({ enemyFireTicks: 1, fireTicks: 5 }));
    expect(shots(classic)).toEqual([101]);
    const aimed = step(atStage(4, { enemyFireTicks: 1, fireTicks: 5, playerX: 70 }));
    expect(shots(aimed)).toEqual([61]);
    const farSide = step(atStage(4, { enemyFireTicks: 1, fireTicks: 5, playerX: 330 }));
    expect(shots(farSide)).toEqual([301]);
  });
  it('fires in pairs on a burst stage, then rests longer than the rotation would', () => {
    const first = step(atStage(5, { enemyFireTicks: 1, fireTicks: 5 }));
    expect(first.bullets.filter((b) => b.owner === 'enemy')).toHaveLength(1);
    expect(first.enemyFireTicks).toBe(BURST_GAP_TICKS);
    let second = first;
    for (let i = 0; i < BURST_GAP_TICKS; i += 1) second = step({ ...second, fireTicks: 5 });
    expect(second.bullets.filter((b) => b.owner === 'enemy')).toHaveLength(2);
    expect(second.enemyFireTicks).toBe(Math.round(enemyFirePeriod(5) * 1.6));
    expect(second.enemyFireTicks).toBeLessThanOrEqual(ENEMY_FIRE_TICKS_MAX);
    for (let stage = 1; stage <= STAGE_COUNT; stage += 1)
      expect(Math.round(enemyFirePeriod(stage) * 1.6)).toBeLessThanOrEqual(ENEMY_FIRE_TICKS_MAX);
  });
  it('drops by the stage’s own step at the wall', () => {
    const quick = step(atStage(8, { enemies: [{ id: 0, x: 342.9, y: 67 }], fireTicks: 5 }));
    expect(quick.enemies[0]?.y).toBe(85);
    const slow = step(atStage(9, { enemies: [{ id: 0, x: 342.9, y: 79 }], fireTicks: 5 }));
    expect(slow.enemies[0]?.y).toBe(91);
  });
});

describe('the diver (§3)', () => {
  const launched = (patch: Partial<Session> = {}) =>
    step(atStage(6, { diveTicks: 1, fireTicks: 5, enemyFireTicks: 50, ...patch }));
  it('never leaves the line on a stage without dives', () => {
    let a = running({ diveTicks: 0, fireTicks: 5 });
    for (let i = 0; i < 200; i += 1) a = step({ ...a, fireTicks: 5 });
    expect(a.enemies.some((enemy) => enemy.dive)).toBe(false);
  });
  it('sends the front invader above the ship, toward where the ship is, once the clock runs out', () => {
    const a = launched();
    const divers = a.enemies.filter((enemy) => enemy.dive);
    expect(divers.map((enemy) => enemy.id)).toEqual([24]);
    // The line has moved a step right by the time it launches, so the slot sits right of the ship.
    expect(divers[0]!.dive).toEqual({ t: 0, px: 180, side: 1 });
    expect(a.diveTicks).toBe(stageSpec(6).diveEvery);
    // Its slot still moves with the line; its drawn position starts on that slot.
    expect(enemyPosition(divers[0]!)).toEqual({ x: divers[0]!.x, y: divers[0]!.y });
    const other = launched({ playerX: 320 });
    expect(other.enemies.find((enemy) => enemy.dive)?.id).toBe(27);
    expect(other.enemies.find((enemy) => enemy.dive)?.dive?.side).toBe(-1);
  });
  it('swoops inside the walls to the ship’s row, runs off the bottom and glides home', () => {
    let a = launched();
    const id = 24;
    let reachedShip = false;
    for (let t = 1; t < DIVE_TICKS; t += 1) {
      a = step({ ...a, fireTicks: 5, enemyFireTicks: 50, playerX: 30 });
      const diver = a.enemies.find((enemy) => enemy.id === id)!;
      expect(diver.dive?.t).toBe(t);
      const at = enemyPosition(diver);
      expect(at.x).toBeGreaterThanOrEqual(16);
      expect(at.x).toBeLessThanOrEqual(344);
      if (t === DIVE_SWOOP_TICKS) {
        expect(at).toEqual({ x: 180, y: PLAYER_Y });
        reachedShip = true;
      }
      if (t > DIVE_SWOOP_TICKS + 2 && t < DIVE_SWOOP_TICKS + 6) expect(at.y).toBeGreaterThan(460);
    }
    expect(reachedShip).toBe(true);
    a = step({ ...a, fireTicks: 5, enemyFireTicks: 50 });
    const home = a.enemies.find((enemy) => enemy.id === id)!;
    expect(home.dive).toBeUndefined();
    expect(enemyPosition(home)).toEqual({ x: home.x, y: home.y });
    expect(a.status).toBe('running');
  });
  it('costs one life when it reaches the ship, and flies on rather than dying', () => {
    // The ship steps away after the launch and comes back under the dive's target at the end.
    let a = launched();
    for (let t = 1; t < DIVE_SWOOP_TICKS; t += 1)
      a = step({ ...a, fireTicks: 5, enemyFireTicks: 50, invulnerableTicks: 0, playerX: 30 });
    expect(a.lives).toBe(3);
    const hit = step({
      ...a,
      fireTicks: 5,
      enemyFireTicks: 50,
      invulnerableTicks: 0,
      playerX: 180,
    });
    expect(hit.lives).toBe(2);
    expect(hit.invulnerableTicks).toBe(45);
    expect(hit.enemies.find((enemy) => enemy.id === 24)?.dive).toBeDefined();
    expect(hit.enemies).toHaveLength(18);
    const dodged = step({
      ...a,
      fireTicks: 5,
      enemyFireTicks: 50,
      invulnerableTicks: 0,
      playerX: 220,
    });
    expect(dodged.lives).toBe(3);
  });
  it('can be shot on its way down, for its row’s points', () => {
    let a = launched();
    for (let t = 1; t < 40; t += 1) a = step({ ...a, fireTicks: 5, enemyFireTicks: 50 });
    const diver = a.enemies.find((enemy) => enemy.dive)!;
    const at = enemyPosition(diver);
    const shot = step({
      ...a,
      fireTicks: 5,
      enemyFireTicks: 50,
      covers: [],
      bullets: [{ id: 0, x: at.x, y: at.y + 20, owner: 'player' }],
      nextBulletId: 1,
    });
    expect(shot.enemies.some((enemy) => enemy.id === diver.id)).toBe(false);
    expect(shot.score).toBe(10);
    expect(expectedScore(shot)).toBe(shot.score);
  });
  it('neither turns the line at the wall nor lands it at the defence line', () => {
    // Its slot is what the walls read; the point on its path may be anywhere inside them.
    const atLine = step(
      running({
        enemies: [{ id: 24, x: 180, y: 300, dive: { t: 60, px: 180, side: 1 } }],
        fireTicks: 5,
        enemyFireTicks: 50,
      }),
    );
    expect(enemyPosition(atLine.enemies[0]!).y).toBeGreaterThan(412);
    expect(atLine.status).toBe('running');
    // A slot that sinks past the line while its invader is away lands when the invader does.
    let away = running({
      enemies: [{ id: 24, x: 180, y: 402, dive: { t: DIVE_TICKS - 3, px: 20, side: 1 } }],
      fireTicks: 5,
      enemyFireTicks: 50,
    });
    away = step(away);
    expect(away.status).toBe('running');
    away = step({ ...away, fireTicks: 5, enemyFireTicks: 50 });
    expect(away.status).toBe('running');
    away = step({ ...away, fireTicks: 5, enemyFireTicks: 50 });
    expect(away.enemies[0]?.dive).toBeUndefined();
    expect(away.status).toBe('lost');
  });
  it('is hit before a bunker it is passing beneath', () => {
    // Gliding home into a slot just above the line, the diver is between the ship and the
    // bunker block at (56, 381): the shot spends itself on the nearer of the two (Codex
    // review, 2026-11-06).
    const base = running({ fireTicks: 5, enemyFireTicks: 50 });
    const brick = base.covers[3]!;
    const diver = {
      id: 24,
      x: brick.x,
      y: 400,
      dive: { t: DIVE_TICKS - 2, px: 180, side: 1 as const },
    };
    const where = enemyPosition({ ...diver, dive: { ...diver.dive, t: diver.dive.t + 1 } });
    expect(where.y).toBeGreaterThan(brick.y);
    expect(where.y).toBeLessThan(397);
    const next = step({
      ...base,
      enemies: [diver],
      bullets: [{ id: 0, x: brick.x, y: 397, owner: 'player' }],
      nextBulletId: 1,
    });
    expect(next.enemies).toHaveLength(0);
    expect(next.covers[3]?.hp).toBe(2);
    expect(next.score).toBe(10);
    // With no diver in the way the same shot lands on the block, as it always has.
    const blocked = step({
      ...base,
      enemies: [{ id: 24, x: brick.x, y: 150 }],
      bullets: [{ id: 0, x: brick.x, y: 397, owner: 'player' }],
      nextBulletId: 1,
    });
    expect(blocked.covers[3]?.hp).toBe(1);
    expect(blocked.enemies).toHaveLength(1);
  });
  it('keeps to the stage’s number of divers in the air', () => {
    let a = atStage(16, { diveTicks: 0, fireTicks: 5, enemyFireTicks: 50 });
    const divers = () => a.enemies.filter((enemy) => enemy.dive).length;
    a = step(a);
    expect(divers()).toBe(1);
    a = step({ ...a, diveTicks: 0, fireTicks: 5, enemyFireTicks: 50 });
    expect(divers()).toBe(2);
    a = step({ ...a, diveTicks: 0, fireTicks: 5, enemyFireTicks: 50 });
    expect(divers()).toBe(2);
    expect(stageSpec(16).diveMax).toBe(2);
    // The divers are not the shooters: the line keeps firing from those still in it.
    const firing = step({ ...a, enemyFireTicks: 1, fireTicks: 5 });
    const shot = firing.bullets.find((b) => b.owner === 'enemy')!;
    expect(firing.enemies.some((enemy) => !enemy.dive && enemy.x === shot.x)).toBe(true);
  });
});

/**
 * A deterministic pilot limited to `reach` px per tick: it wants to stand under the lowest
 * invader (leading its drift), and among the positions it can reach this tick it takes the
 * one closest to that wish that no shot or diver is about to cross. It is a solvability gate,
 * not a difficulty gauge — it reads the whole board with no reaction time.
 */
function pilotX(a: Session, reach: number): number {
  const threats: number[] = [];
  for (const b of a.bullets)
    if (b.owner === 'enemy' && b.y < PLAYER_Y + 10 && PLAYER_Y - b.y < 130) threats.push(b.x);
  for (const e of a.enemies) {
    if (!e.dive) continue;
    const p = enemyPosition(e);
    if (p.y < PLAYER_Y + 14 && PLAYER_Y - p.y < 170) threats.push(p.x);
    if (e.dive.t < DIVE_SWOOP_TICKS && PLAYER_Y - p.y < 230) threats.push(e.dive.px);
  }
  const danger = (x: number) =>
    threats.reduce((worst, t) => Math.max(worst, 26 - Math.abs(t - x)), 0);
  const inLine = a.enemies.filter((e) => !e.dive);
  const pool = inLine.length ? inLine : a.enemies;
  const target = [...pool]
    .map((e) => ({ e, p: enemyPosition(e) }))
    .sort((x, y) => y.p.y - x.p.y || Math.abs(x.p.x - a.playerX) - Math.abs(y.p.x - a.playerX))[0]!;
  const desired = target.e.dive
    ? target.p.x
    : target.p.x +
      (a.direction *
        stageSpeed(a.stage, a.enemies.length, a.enemies.length) *
        (PLAYER_Y - target.p.y)) /
        360;
  let best = a.playerX;
  let bestKey = Number.POSITIVE_INFINITY;
  for (let d = -reach; d <= reach; d += 2) {
    const x = Math.max(16, Math.min(344, a.playerX + d));
    const key = danger(x) * 1000 + Math.abs(x - desired);
    if (key < bestKey) {
      bestKey = key;
      best = x;
    }
  }
  return best;
}
/** Flies one stage to its end, checking the invariants every save relies on at every tick. */
function flyStage(s: Session, reach: number): Session {
  let a = s;
  for (let t = 0; t < 20000 && a.status === 'running'; t += 1) {
    a = step(movePlayer(a, pilotX(a, reach)));
    if (a.score !== expectedScore(a)) throw new Error(`score off its base at tick ${a.ticks}`);
    if (a.enemies.length > 28 || a.bullets.length > 13) throw new Error('bounds');
    if (a.enemies.filter((e) => e.dive).length > DIVE_MAX) throw new Error('too many divers');
    for (const e of a.enemies) {
      const at = enemyPosition(e);
      if (at.x < 16 || at.x > 344 || at.y < -24 || at.y > 520) throw new Error('off the board');
    }
  }
  return a;
}
describe('every stage can be flown (§1, §10)', () => {
  it('clears each stage in isolation with every life, at a touch-speed reach', () => {
    for (let stage = 1; stage <= STAGE_COUNT; stage += 1) {
      const end = flyStage(atStage(stage), 20);
      expect(end.status, `stage ${stage}`).toBe(stage === STAGE_COUNT ? 'won' : 'between');
      expect(end.lives, `stage ${stage}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('flies a whole run to the win, deterministically, and keeps the score on its base throughout', () => {
    let a = start(createSession());
    let b = start(createSession());
    const stagesFlown: number[] = [];
    while (!finished(a)) {
      a = flyStage(a, 30);
      b = flyStage(b, 30);
      expect(a).toEqual(b);
      stagesFlown.push(a.stage);
      if (a.status === 'between') {
        a = start(nextStage(a));
        b = start(nextStage(b));
      }
    }
    expect(a.status).toBe('won');
    expect(a.lives).toBeGreaterThanOrEqual(1);
    expect(a.score).toBe(MAX_SCORE);
    expect(stagesFlown).toEqual(Array.from({ length: STAGE_COUNT }, (_, i) => i + 1));
  });
});
