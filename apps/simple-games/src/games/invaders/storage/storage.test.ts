import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import {
  createSession,
  DIVE_GRACE_TICKS,
  DIVE_TICKS,
  formation,
  nextStage,
  pause,
  start,
  step,
  type Session,
} from '../game';
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
  it('round-trips a stage dealt as another shape, with a dive in flight (§7)', () => {
    let run = start(createSession());
    run = { ...run, enemies: [], score: 700, status: 'between' };
    for (let stage = 2; stage <= 7; stage += 1) {
      run = start(nextStage(run));
      run = { ...run, enemies: [], score: run.stageScoreBase + 600, status: 'between' };
      if (stage === 3 || stage === 7)
        run = { ...run, score: run.stageScoreBase + (stage === 3 ? 600 : 600) };
    }
    // Stage 7 is the stair (600 points). Re-deal it and let the pilot's absence send a diver.
    run = start(nextStage({ ...run, stage: 6, score: run.stageScoreBase, enemies: [] }));
    expect(run.stage).toBe(7);
    expect(run.layout).toBe('stair');
    for (let i = 0; i < DIVE_GRACE_TICKS + 2; i += 1) run = step(run);
    expect(run.enemies.some((enemy) => enemy.dive)).toBe(true);
    const restored = restore(toPersisted(run, 5));
    expect(restored).toEqual(pause(run));
    expect(gameSchema.validate(toPersisted(run, 5))).toEqual(toPersisted(pause(run), 5));
  });
  it('reads a version 1 record as the full block it was, every earlier stage worth 700', () => {
    const base = start(createSession());
    const v1 = {
      schemaVersion: 1,
      savedAt: 1,
      session: {
        ...base,
        stage: 7,
        score: 6 * 700 + 80,
        enemies: formation('full', 0).filter((enemy) => enemy.id > 1),
        layout: undefined,
        stageScoreBase: undefined,
        diveTicks: undefined,
      },
    };
    const session = restore(v1);
    expect(session).not.toBeNull();
    expect(session!.layout).toBe('full');
    expect(session!.stageScoreBase).toBe(4200);
    expect(session!.diveTicks).toBe(DIVE_GRACE_TICKS);
    expect(session!.enemies).toHaveLength(26);
    expect(session!.enemies.every((enemy) => enemy.dive === undefined)).toBe(true);
    // A version 1 build never wrote a dive; one that appears there is noise, not state.
    const noisy = {
      ...v1,
      session: {
        ...v1.session,
        enemies: v1.session.enemies.map((enemy) => ({
          ...enemy,
          dive: { t: 3, px: 100, side: 1 },
        })),
      },
    };
    expect(restore(noisy)!.enemies.every((enemy) => enemy.dive === undefined)).toBe(true);
    // The same run written back is a version 2 record.
    expect(toPersisted(session!, 1).schemaVersion).toBe(2);
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
      expect(restore({ schemaVersion: 2, session, savedAt: 0 })).toBeNull();
    expect(gameSchema.validate({ schemaVersion: 2 })).toBeNull();
    expect(gameSchema.validate({ schemaVersion: 3, session: base, savedAt: 0 })).toBeNull();
  });
  it('rejects a formation that does not fit its shape, a score off its base, or too many divers', () => {
    const run: Session = {
      ...start(createSession()),
      stage: 3,
      layout: 'wings',
      stageScoreBase: 1400,
      enemies: formation('wings', 1),
      score: 1400,
    };
    const dive = { t: 10, px: 180, side: 1 as const };
    const bad = [
      { ...run, layout: 'triangle' as Session['layout'] },
      { ...run, enemies: [...run.enemies, { id: 3, x: 180, y: 67 }] },
      { ...run, stageScoreBase: 1500 },
      { ...run, score: 1410 },
      { ...run, diveTicks: 151 },
      { ...run, enemies: run.enemies.map((enemy, i) => (i < 3 ? { ...enemy, dive } : enemy)) },
      { ...run, enemies: [{ ...run.enemies[0]!, dive: { ...dive, t: DIVE_TICKS } }] },
      { ...run, enemies: [{ ...run.enemies[0]!, dive: { ...dive, px: 400 } }] },
      { ...run, enemies: [{ ...run.enemies[0]!, dive: { ...dive, side: 0 } }] },
      { ...createSession(), layout: 'ring' as const },
    ];
    for (const session of bad) {
      const fixed = { ...session, score: session.score };
      expect(restore({ schemaVersion: 2, session: fixed, savedAt: 0 })).toBeNull();
    }
    expect(
      restore({
        schemaVersion: 2,
        session: {
          ...run,
          enemies: run.enemies.map((enemy, i) => (i < 2 ? { ...enemy, dive } : enemy)),
        },
        savedAt: 0,
      }),
    ).not.toBeNull();
  });
  it('rejects impossible statistics', () => {
    const stats = statsSchema.defaultValue();
    expect(statsSchema.validate(stats)).toEqual(stats);
    expect(statsSchema.validate({ ...stats, cleared: 1 })).toBeNull();
    expect(statsSchema.validate({ ...stats, bestStage: 21 })).toBeNull();
    expect(statsSchema.validate({ ...stats, bestScore: 14001 })).toBeNull();
  });
});
