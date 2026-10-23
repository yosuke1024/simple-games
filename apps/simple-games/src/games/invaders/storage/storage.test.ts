import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createSession, nextStage, pause, start, step } from '../game';
import { clearSavedGame, loadSavedGame, saveGame } from './gamePersistence';
import { gameSchema, restore, statsSchema, toPersisted } from './schemas';
describe('Invaders saved runs', () => {
  it('round-trips an active run into pause with no moving frame or lost second', async () => {
    const kv = createMemoryKV();
    let run = start(createSession());
    for (let i = 0; i < 100; i += 1) run = step(run);
    await saveGame(run, kv);
    const restored = await loadSavedGame(kv);
    expect(restored).toEqual(pause(run));
    expect(restored?.elapsedSeconds).toBe(3);
    expect(step(restored!)).toBe(restored);
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
  it('accepts ready and between-stage records while rejecting finished runs', () => {
    expect(restore(toPersisted(createSession(), 0))).toEqual(createSession());
    const between = {
      ...start(createSession()),
      enemies: [],
      score: 700,
      status: 'between' as const,
    };
    expect(restore(toPersisted(between, 0))).toEqual(between);
    expect(restore(toPersisted(nextStage(between), 0))).toEqual(nextStage(between));
    expect(restore(toPersisted({ ...between, status: 'lost' }, 0))).toBeNull();
  });
  it('rejects oversized structures, duplicate IDs, nonfinite positions, invalid clocks and fabricated scores', () => {
    const base = createSession();
    const bad = [
      { ...base, enemies: [...base.enemies, base.enemies[0]] },
      { ...base, enemies: base.enemies.map((enemy) => ({ ...enemy, id: 0 })) },
      { ...base, playerX: Infinity },
      { ...base, score: 10 },
      { ...base, elapsedSeconds: 1 },
      { ...base, lives: 0 },
      { ...base, covers: [] },
      { ...base, bullets: Array(20).fill({ id: 0, x: 1, y: 1, owner: 'enemy' }) },
    ];
    for (const session of bad)
      expect(restore({ schemaVersion: 1, session, savedAt: 0 })).toBeNull();
    expect(gameSchema.validate({ schemaVersion: 2 })).toBeNull();
  });
  it('rejects impossible statistics', () => {
    const stats = statsSchema.defaultValue();
    expect(statsSchema.validate(stats)).toEqual(stats);
    expect(statsSchema.validate({ ...stats, cleared: 1 })).toBeNull();
    expect(statsSchema.validate({ ...stats, bestStage: 21 })).toBeNull();
    expect(statsSchema.validate({ ...stats, bestScore: 14001 })).toBeNull();
  });
});
