/**
 * The preferences record holds the Free Play tier (§11「フリープレイ」). It
 * joined the game after release, so a record without the tier is an older
 * one, not a broken one.
 */
import { describe, expect, it } from 'vitest';
import { prefsSchema } from './schemas';

describe('prefs', () => {
  it('starts the picker at medium', () => {
    expect(prefsSchema.defaultValue().freeTier).toBe('medium');
  });

  it('reads a record from before the picker existed', () => {
    expect(prefsSchema.validate({ schemaVersion: 1 })).toEqual({
      schemaVersion: 1,
      freeTier: 'medium',
    });
  });

  it('keeps the tier that was chosen, and rejects one that is not a tier', () => {
    expect(prefsSchema.validate({ schemaVersion: 1, freeTier: 'hard' })?.freeTier).toBe('hard');
    expect(prefsSchema.validate({ schemaVersion: 1, freeTier: 'x' })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 2, freeTier: 'hard' })).toBeNull();
  });
});
