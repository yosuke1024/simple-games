/**
 * The Free Play tier joined the preferences after release (§6): a record
 * without it is an older one, not a broken one.
 */
import { describe, expect, it } from 'vitest';
import { prefsSchema } from './schemas';

describe('prefs', () => {
  it('starts the picker at medium', () => {
    expect(prefsSchema.defaultValue().freeTier).toBe('medium');
  });

  it('reads a record from before the picker existed', () => {
    expect(prefsSchema.validate({ schemaVersion: 1, xMode: true })).toEqual({
      schemaVersion: 1,
      xMode: true,
      freeTier: 'medium',
    });
  });

  it('keeps the tier that was chosen, and rejects one that is not a tier', () => {
    expect(
      prefsSchema.validate({ schemaVersion: 1, xMode: false, freeTier: 'hard' })?.freeTier,
    ).toBe('hard');
    expect(prefsSchema.validate({ schemaVersion: 1, xMode: false, freeTier: 'x' })).toBeNull();
  });
});
