/**
 * The three saved-game slots. All hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their level game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createFreeSession, createLevelSession } from '../game';
import { toPersisted } from './gamePersistence';
import { dailyGameSchema, freeGameSchema, gameSchema, strandedDailySchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const levelRecord = toPersisted(createLevelSession(1), SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);
const freeRecord = toPersisted(createFreeSession('hard'), SAVED_AT);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(levelRecord)?.mode).toBe('level');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(freeGameSchema.validate(freeRecord)?.mode).toBe('free');
    expect(freeGameSchema.validate(freeRecord)?.freeTier).toBe('hard');
  });

  it('refuses a record written for another mode', () => {
    // All records are what the game itself writes, and all are otherwise
    // perfectly valid. The only thing wrong is the slot they are sitting in.
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(gameSchema.validate(freeRecord)).toBeNull();
    expect(dailyGameSchema.validate(levelRecord)).toBeNull();
    expect(dailyGameSchema.validate(freeRecord)).toBeNull();
    expect(freeGameSchema.validate(levelRecord)).toBeNull();
    expect(freeGameSchema.validate(dailyRecord)).toBeNull();
  });

  it('refuses a free record that claims a level or a date, or has no tier', () => {
    expect(freeGameSchema.validate({ ...freeRecord, level: 3 })).toBeNull();
    expect(freeGameSchema.validate({ ...freeRecord, dailyDate: '2026-08-07' })).toBeNull();
    // The tier is what the board's outline and clear bonus follow from.
    expect(freeGameSchema.validate({ ...freeRecord, freeTier: null })).toBeNull();
    expect(freeGameSchema.validate({ ...freeRecord, freeTier: 'brutal' })).toBeNull();
  });

  it('refuses a tier on a level or a daily record', () => {
    expect(gameSchema.validate({ ...levelRecord, freeTier: 'easy' })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, freeTier: 'easy' })).toBeNull();
  });

  it('reads a level record from before free play existed', () => {
    // The field is simply absent from older saves — not a corrupt record.
    const older: Record<string, unknown> = { ...levelRecord };
    delete older.freeTier;
    expect(gameSchema.validate(older)?.freeTier).toBeNull();
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
