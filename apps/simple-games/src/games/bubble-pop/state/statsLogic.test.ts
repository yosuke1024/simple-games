/**
 * applyClearToProgress's off-by-one edge: highestUnlocked has to reach
 * LEVEL_COUNT+1 for clearing the very last level, or clearedLevelCount
 * (highestUnlocked - 1) reports 99 for a player who cleared all 100 —
 * indistinguishable from someone who merely unlocked level 100 and never
 * played it.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT } from '../game/levels';
import type { Progress } from '../storage/schemas';
import { applyClearToProgress, clearedLevelCount } from './statsLogic';

const progress = (highestUnlocked: number): Progress => ({ schemaVersion: 1, highestUnlocked });

describe('applyClearToProgress — the last level', () => {
  it('clearing level 100 reaches LEVEL_COUNT+1, not the LEVEL_COUNT clamp', () => {
    const next = applyClearToProgress(progress(LEVEL_COUNT), LEVEL_COUNT);
    expect(next.highestUnlocked).toBe(LEVEL_COUNT + 1);
    expect(clearedLevelCount(next)).toBe(LEVEL_COUNT);
  });

  it('clearing level 100 a second time never pushes past LEVEL_COUNT+1', () => {
    let next = applyClearToProgress(progress(LEVEL_COUNT), LEVEL_COUNT);
    next = applyClearToProgress(next, LEVEL_COUNT);
    expect(next.highestUnlocked).toBe(LEVEL_COUNT + 1);
    expect(clearedLevelCount(next)).toBe(LEVEL_COUNT);
  });

  it('clearing an earlier level once the run is already fully cleared changes nothing', () => {
    // Replaying an old level never moves the frontier back — including once
    // the frontier already sits past the last real level.
    const fullyCleared = progress(LEVEL_COUNT + 1);
    const next = applyClearToProgress(fullyCleared, 40);
    expect(next).toBe(fullyCleared);
  });
});

describe('applyClearToProgress — ordinary levels (unaffected by the LEVEL_COUNT+1 clamp)', () => {
  it('unlocks exactly the next level', () => {
    const next = applyClearToProgress(progress(1), 1);
    expect(next.highestUnlocked).toBe(2);
    expect(clearedLevelCount(next)).toBe(1);
  });

  it('replaying a cleared level never moves the frontier back', () => {
    const next = applyClearToProgress(progress(10), 3);
    expect(next.highestUnlocked).toBe(10);
  });

  it('returns the same object (no-op) when nothing changes', () => {
    const before = progress(10);
    expect(applyClearToProgress(before, 3)).toBe(before);
  });
});

describe('clearedLevelCount', () => {
  it('is the frontier minus the level being faced, for every position including the last', () => {
    expect(clearedLevelCount(progress(1))).toBe(0);
    expect(clearedLevelCount(progress(50))).toBe(49);
    expect(clearedLevelCount(progress(LEVEL_COUNT + 1))).toBe(LEVEL_COUNT);
  });
});
