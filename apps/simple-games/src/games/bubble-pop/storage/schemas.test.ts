/**
 * What the persisted records accept and what they refuse. Validators never
 * throw: anything they cannot vouch for comes back null and the caller falls
 * back to the safe default (this file's header comment, §fail-closed).
 *
 * progressSchema's upper bound is LEVEL_COUNT+1, not LEVEL_COUNT: 101 is the
 * one value that means "all 100 levels cleared" rather than merely
 * "level 100 unlocked" (see applyClearToProgress in state/statsLogic.ts),
 * so it has to be accepted — but nothing past it should be.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT } from '../game/levels';
import { flagsSchema, progressSchema, statsSchema } from './schemas';

describe('progressSchema — the LEVEL_COUNT+1 "fully cleared" value', () => {
  it('accepts LEVEL_COUNT+1 (101): all levels cleared', () => {
    const progress = progressSchema.validate({
      schemaVersion: 1,
      highestUnlocked: LEVEL_COUNT + 1,
    });
    expect(progress).toEqual({ schemaVersion: 1, highestUnlocked: LEVEL_COUNT + 1 });
  });

  it('accepts every ordinary in-range value, including the LEVEL_COUNT boundary itself', () => {
    expect(progressSchema.validate({ schemaVersion: 1, highestUnlocked: 1 })?.highestUnlocked).toBe(
      1,
    );
    expect(
      progressSchema.validate({ schemaVersion: 1, highestUnlocked: LEVEL_COUNT })?.highestUnlocked,
    ).toBe(LEVEL_COUNT);
  });

  it('rejects LEVEL_COUNT+2 (102) and anything further past it', () => {
    expect(
      progressSchema.validate({ schemaVersion: 1, highestUnlocked: LEVEL_COUNT + 2 }),
    ).toBeNull();
    expect(progressSchema.validate({ schemaVersion: 1, highestUnlocked: 9999 })).toBeNull();
  });

  it('rejects 0 and negative values (fail-closed, never a thrown error)', () => {
    expect(progressSchema.validate({ schemaVersion: 1, highestUnlocked: 0 })).toBeNull();
    expect(progressSchema.validate({ schemaVersion: 1, highestUnlocked: -1 })).toBeNull();
  });

  it('rejects non-integers, the wrong schema version, and non-records', () => {
    expect(progressSchema.validate({ schemaVersion: 1, highestUnlocked: 3.5 })).toBeNull();
    expect(progressSchema.validate({ schemaVersion: 2, highestUnlocked: 3 })).toBeNull();
    expect(progressSchema.validate(null)).toBeNull();
    expect(progressSchema.validate('nonsense')).toBeNull();
  });

  it('defaults to level 1, unlocked and nothing cleared', () => {
    expect(progressSchema.defaultValue()).toEqual({ schemaVersion: 1, highestUnlocked: 1 });
  });
});

describe('statsSchema and flagsSchema — untouched by the highestUnlocked fix', () => {
  it('statsSchema keeps its own fail-closed bounds', () => {
    expect(
      statsSchema.validate({ schemaVersion: 1, played: 1, cleared: 1, totalPlaySeconds: 1 }),
    ).toEqual({ schemaVersion: 1, played: 1, cleared: 1, totalPlaySeconds: 1 });
    expect(
      statsSchema.validate({ schemaVersion: 1, played: -1, cleared: 0, totalPlaySeconds: 0 }),
    ).toBeNull();
  });

  it('flagsSchema round-trips the tutorial flag', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
  });
});
