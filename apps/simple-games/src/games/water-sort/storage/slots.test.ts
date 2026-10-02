/**
 * The three saved-game slots. All hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their level game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 */
import { describe, expect, it } from 'vitest';
import {
  createClubSession,
  createDailySession,
  createFreeSession,
  createLevelSession,
} from '../game';
import { toPersisted } from './gamePersistence';
import { clubGameSchema, dailyGameSchema, freeGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const levelRecord = toPersisted(createLevelSession(1), SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);
const freeRecord = toPersisted(createFreeSession('hard'), SAVED_AT);
const clubRecord = toPersisted(createClubSession({ tier: 'easy' }, 'water-club-slots'), SAVED_AT);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(levelRecord)?.mode).toBe('level');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(freeGameSchema.validate(freeRecord)?.mode).toBe('free');
    expect(freeGameSchema.validate(freeRecord)?.freeTier).toBe('hard');
    expect(clubGameSchema.validate(clubRecord)?.mode).toBe('club');
    expect(clubGameSchema.validate(clubRecord)?.freeTier).toBe('easy');
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
    // The Club House slot (§14) is a fourth, and the same rule holds both ways.
    expect(gameSchema.validate(clubRecord)).toBeNull();
    expect(dailyGameSchema.validate(clubRecord)).toBeNull();
    expect(freeGameSchema.validate(clubRecord)).toBeNull();
    expect(clubGameSchema.validate(levelRecord)).toBeNull();
    expect(clubGameSchema.validate(dailyRecord)).toBeNull();
    expect(clubGameSchema.validate(freeRecord)).toBeNull();
  });

  it('refuses a club record that claims a level or a date, or no tier', () => {
    expect(clubGameSchema.validate({ ...clubRecord, level: 3 })).toBeNull();
    expect(clubGameSchema.validate({ ...clubRecord, dailyDate: '2026-08-07' })).toBeNull();
    expect(clubGameSchema.validate({ ...clubRecord, freeTier: null })).toBeNull();
  });

  it('refuses a free record that claims a level or a date, or no tier', () => {
    expect(freeGameSchema.validate({ ...freeRecord, level: 3 })).toBeNull();
    expect(freeGameSchema.validate({ ...freeRecord, dailyDate: '2026-08-07' })).toBeNull();
    expect(freeGameSchema.validate({ ...freeRecord, freeTier: null })).toBeNull();
    expect(freeGameSchema.validate({ ...freeRecord, freeTier: 'x' })).toBeNull();
  });

  it('reads a level record from before free play existed', () => {
    // Saved without the field at all — older, not broken.
    const { freeTier: _tier, ...older } = levelRecord;
    expect(gameSchema.validate(older)?.freeTier).toBeNull();
    // But a level or a daily that claims a tier is not what the game writes.
    expect(gameSchema.validate({ ...levelRecord, freeTier: 'easy' })).toBeNull();
  });
});
