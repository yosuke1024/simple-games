/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their level game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession } from '../game';
import { toPersisted } from './gamePersistence';
import { dailyGameSchema, gameSchema, strandedDailySchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const levelRecord = toPersisted(createLevelSession(1), SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);

describe('saved-game slots', () => {
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

describe('the pre-split level key', () => {
  it('is still readable as the daily it was, but only through the migration', () => {
    // Builds before the daily got its own key kept it here. That record is
    // legacy, not corruption — but the live slot must still refuse to resume
    // it as a level game, or the bug this rule exists to stop comes back
    // through the one door left open for it (gamePersistence.ts).
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(strandedDailySchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(strandedDailySchema.validate(levelRecord)).toBeNull();
  });
});
