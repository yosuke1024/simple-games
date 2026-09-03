/**
 * The Free Play tier joined the preferences after release (§9「フリープレイ」):
 * a record without it is an older one, not a broken one.
 */
import { describe, expect, it } from 'vitest';
import { prefsSchema } from './schemas';

describe('prefs', () => {
  it('starts the picker at medium', () => {
    expect(prefsSchema.defaultValue().freeTier).toBe('medium');
  });

  it('reads a record from before the picker existed', () => {
    expect(prefsSchema.validate({ schemaVersion: 1, highlightMistakes: false })).toEqual({
      schemaVersion: 1,
      highlightMistakes: false,
      freeTier: 'medium',
    });
  });

  it('keeps the tier that was chosen, and rejects one that is not a tier', () => {
    expect(
      prefsSchema.validate({ schemaVersion: 1, highlightMistakes: true, freeTier: 'hard' })
        ?.freeTier,
    ).toBe('hard');
    expect(
      prefsSchema.validate({ schemaVersion: 1, highlightMistakes: true, freeTier: 'x' }),
    ).toBeNull();
  });
});
