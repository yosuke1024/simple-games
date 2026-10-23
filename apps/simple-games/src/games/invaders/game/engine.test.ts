import { describe, expect, it } from 'vitest';
import {
  createSession,
  enemyFirePeriod,
  finished,
  movePlayer,
  nextStage,
  pause,
  PLAYER_Y,
  stageSpeed,
  start,
  step,
  STAGE_COUNT,
  type Session,
} from './index';
const running = (patch: Partial<Session> = {}): Session => ({
  ...start(createSession()),
  ...patch,
});
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
      covers: [],
      fireTicks: 5,
      bullets: [{ id: 0, x: 180, y: 157, owner: 'player' }],
      nextBulletId: 1,
    });
    const next = step(state);
    expect(next.status).toBe('between');
    expect(next.score).toBe(20);
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
