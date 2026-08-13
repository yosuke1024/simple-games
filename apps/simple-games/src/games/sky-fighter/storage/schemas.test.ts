/**
 * Save compatibility (docs/SKY_FIGHTER_RULES.md §10): the gameplay expansion
 * changed no persisted shape, so every record written by the previous version
 * must load unchanged — and junk must fall back to defaults instead of
 * crashing or being discarded.
 */
import { describe, expect, it } from 'vitest';
import { flagsSchema, progressSchema, statsSchema } from './schemas';

describe('sky-fighter save compatibility', () => {
  it('reads stats exactly as the previous version wrote them', () => {
    const old = {
      schemaVersion: 1,
      played: 9,
      cleared: 4,
      bestScore: 1520,
      totalPlaySeconds: 240,
    };
    expect(statsSchema.validate(old)).toEqual(old);
  });

  it('reads progress and flags exactly as the previous version wrote them', () => {
    const progress = { schemaVersion: 1, highestUnlocked: 42 };
    expect(progressSchema.validate(progress)).toEqual(progress);
    const flags = { schemaVersion: 1, tutorialCompleted: true };
    expect(flagsSchema.validate(flags)).toEqual(flags);
  });

  it('rejects corrupt records so callers fall back to defaults, never crash', () => {
    for (const raw of [null, 7, 'x', {}, { schemaVersion: 2 }, { schemaVersion: 1 }]) {
      expect(statsSchema.validate(raw)).toBeNull();
      expect(progressSchema.validate(raw)).toBeNull();
    }
    expect(statsSchema.defaultValue().played).toBe(0);
    expect(progressSchema.defaultValue().highestUnlocked).toBe(1);
  });
});
