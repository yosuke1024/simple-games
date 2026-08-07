/**
 * The two saved-set slots. Both hold the same record shape, so the KEY is what
 * says which mode a record is — and a record that disagrees with its key is
 * corrupt data, not an instruction to change modes. Loading one would send a
 * player who asked to resume their level set into the daily slot: the other
 * set, or a blank screen where the other set isn't.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession } from '../game';
import { toPersisted } from './gamePersistence';
import { dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const levelRecord = toPersisted(createLevelSession(1), SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);

describe('saved-set slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(levelRecord)?.mode).toBe('level');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
  });

  it('refuses a record written for the other mode', () => {
    // Both records are what the game itself writes, and both are otherwise
    // perfectly valid. The only thing wrong is the slot they are sitting in.
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(levelRecord)).toBeNull();
  });
});
