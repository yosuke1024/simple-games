import { describe, expect, it } from 'vitest';
import { layoutPoints, MAX_SCORE, STAGE_COUNT } from '../game';
import { statsSchema } from '../storage/schemas';
import { INVADERS_CHALLENGE } from './contract';

const run = { score: 3650, stage: 7 };

describe('invaders challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(INVADERS_CHALLENGE.contractVersion).toBe(1);
    expect(INVADERS_CHALLENGE.order).toBe('score');
    expect(INVADERS_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(INVADERS_CHALLENGE.validateParams({})).toEqual({});
    expect(INVADERS_CHALLENGE.validateParams({ stage: 3 })).toEqual({});
    expect(INVADERS_CHALLENGE.paramsKey({})).toBe('standard');
    expect(INVADERS_CHALLENGE.paramsKey({})).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it('refuses params that are not an object', () => {
    expect(INVADERS_CHALLENGE.validateParams(null)).toBeNull();
    expect(INVADERS_CHALLENGE.validateParams(undefined)).toBeNull();
    expect(INVADERS_CHALLENGE.validateParams('standard')).toBeNull();
    expect(INVADERS_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score and the stage reached as integers', () => {
    expect(INVADERS_CHALLENGE.validateFacts(run)).toEqual(run);
    expect(INVADERS_CHALLENGE.validateFacts({ score: 0, stage: 1 })).toEqual({
      score: 0,
      stage: 1,
    });
    expect(INVADERS_CHALLENGE.validateFacts({ score: MAX_SCORE, stage: STAGE_COUNT })).toEqual({
      score: MAX_SCORE,
      stage: STAGE_COUNT,
    });
  });

  it('keeps only the two figures', () => {
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, lives: 2, best: 9000 })).toEqual(run);
  });

  it('bounds the stage by the game’s twenty (a literal, since the contract imports nothing)', () => {
    expect(STAGE_COUNT).toBe(20);
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, stage: STAGE_COUNT })).not.toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, stage: STAGE_COUNT + 1 })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, stage: 0 })).toBeNull();
  });

  it('bounds the score where the saved score is bounded, so a resumed v1 run is still accepted', () => {
    // Today's table tops out lower; a run begun on the v1 build (twenty full
    // blocks) is resumed as it was and may score up to 14,000 (RULES §3, §7).
    expect(MAX_SCORE).toBe(10_960);
    const v1Ceiling = STAGE_COUNT * layoutPoints('full');
    expect(v1Ceiling).toBe(14_000);
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, score: v1Ceiling })).toEqual({
      ...run,
      score: v1Ceiling,
    });
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, score: v1Ceiling + 1 })).toBeNull();
    // The same line the stored best is held to (storage/schemas.ts SCORE_CAP).
    const stats = { ...statsSchema.defaultValue(), played: 1 };
    expect(statsSchema.validate({ ...stats, bestScore: v1Ceiling })).not.toBeNull();
    expect(statsSchema.validate({ ...stats, bestScore: v1Ceiling + 1 })).toBeNull();
  });

  it('refuses facts of the wrong shape', () => {
    expect(INVADERS_CHALLENGE.validateFacts(null)).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts([])).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts('3650')).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({})).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ score: 3650 })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ stage: 7 })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, score: 1.5 })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, score: -1 })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, score: '3650' })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, score: Number.NaN })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, score: Infinity })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, stage: 7.5 })).toBeNull();
    expect(INVADERS_CHALLENGE.validateFacts({ ...run, stage: '7' })).toBeNull();
  });
});
