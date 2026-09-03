/**
 * The preferences record holds one thing, the Free Play tier (§6
 * 「フリープレイ」). A record without the field is read as a fresh install
 * would be, not thrown away.
 */
import { describe, expect, it } from 'vitest';
import { prefsSchema } from './schemas';

describe('prefs', () => {
  it('starts the picker at medium', () => {
    expect(prefsSchema.defaultValue().freeTier).toBe('medium');
  });

  it('reads a record without the field as medium', () => {
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
