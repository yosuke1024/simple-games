/**
 * The frontier (docs/BRICK_BREAKER_RULES.md §7): the last clear has to leave
 * a trace, or the Levels count stops at 99 of 100 forever.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT } from '../game/levels';
import { progressSchema } from '../storage/schemas';
import { applyClearToProgress, clearedLevelCount } from './statsLogic';

describe('the frontier (§7)', () => {
  it('moves one past the last level when that level is cleared', () => {
    const before = { schemaVersion: 1 as const, highestUnlocked: LEVEL_COUNT };
    const after = applyClearToProgress(before, LEVEL_COUNT);
    expect(after.highestUnlocked).toBe(LEVEL_COUNT + 1);
    expect(clearedLevelCount(after)).toBe(LEVEL_COUNT);
    // And no further: there is nothing past "all cleared".
    expect(applyClearToProgress(after, LEVEL_COUNT).highestUnlocked).toBe(LEVEL_COUNT + 1);
  });

  it('never moves back, and counts the levels behind it', () => {
    const progress = { schemaVersion: 1 as const, highestUnlocked: 7 };
    expect(applyClearToProgress(progress, 3)).toBe(progress);
    expect(clearedLevelCount(progress)).toBe(6);
    expect(clearedLevelCount({ schemaVersion: 1, highestUnlocked: 1 })).toBe(0);
  });

  it('is stored as "all cleared" and read back as such', () => {
    expect(
      progressSchema.validate({ schemaVersion: 1, highestUnlocked: LEVEL_COUNT + 1 })
        ?.highestUnlocked,
    ).toBe(LEVEL_COUNT + 1);
    expect(
      progressSchema.validate({ schemaVersion: 1, highestUnlocked: LEVEL_COUNT + 2 }),
    ).toBeNull();
  });
});
