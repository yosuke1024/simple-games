/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their difficulty game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 */
import { describe, expect, it } from 'vitest';
import { createClubSession, createDailySession, createDifficultySession } from '../game';
import { toPersisted } from './gamePersistence';
import { clubGameSchema, dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const difficultyRecord = toPersisted(createDifficultySession('easy'), SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);
const clubRecord = toPersisted(
  createClubSession({ difficulty: 'easy', firstIndex: 40 }, 'mines-club-slots'),
  SAVED_AT,
);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(clubGameSchema.validate(clubRecord)?.mode).toBe('club');
    expect(clubGameSchema.validate(clubRecord)?.firstIndex).toBe(40);
  });

  it('refuses a record written for the other mode', () => {
    // Both records are what the game itself writes, and both are otherwise
    // perfectly valid. The only thing wrong is the slot they are sitting in.
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
    // The Club House slot (§14) is a third, and the same rule holds both ways.
    expect(gameSchema.validate(clubRecord)).toBeNull();
    expect(dailyGameSchema.validate(clubRecord)).toBeNull();
    expect(clubGameSchema.validate(difficultyRecord)).toBeNull();
    expect(clubGameSchema.validate(dailyRecord)).toBeNull();
  });

  it('refuses a club record with a date, or without its first cell', () => {
    expect(clubGameSchema.validate({ ...clubRecord, dailyDate: '2026-08-07' })).toBeNull();
    expect(clubGameSchema.validate({ ...clubRecord, firstIndex: null })).toBeNull();
  });
});
