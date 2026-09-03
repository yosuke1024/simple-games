/**
 * The three saved-game slots. All hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their level game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 *
 * The second half is the fail-closed half of §11: a record that play could not
 * have produced is dropped rather than resumed. Takuzu can be strict about
 * that, because the answer travels with the save — a solution that breaks the
 * rules would leave the player with a board that cannot be finished.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createFreeSession, createLevelSession, EMPTY } from '../game';
import { toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, freeGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const levelSession = createLevelSession(1);
const levelRecord = toPersisted(levelSession, SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);
const freeRecord = toPersisted(createFreeSession('hard'), SAVED_AT);

/** The first fixed cell of level 1 — the one no tap is allowed to move (§4). */
const givenIndex = levelSession.givens.findIndex((cell) => cell !== EMPTY);

/** Replaces one character of a board string. */
const withCharacter = (board: string, index: number, character: string): string =>
  board.slice(0, index) + character + board.slice(index + 1);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(levelRecord)?.mode).toBe('level');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(freeGameSchema.validate(freeRecord)?.mode).toBe('free');
    // A free board's tier travels as its size (§7): hard is the 10×10.
    expect(freeGameSchema.validate(freeRecord)?.size).toBe(10);
    expect(toSession(freeRecord)?.mode).toBe('free');
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

  it('refuses a free record that claims a level or a date', () => {
    expect(freeGameSchema.validate({ ...freeRecord, level: 3 })).toBeNull();
    expect(freeGameSchema.validate({ ...freeRecord, dailyDate: '2026-08-07' })).toBeNull();
  });
});

describe('a save play could not have produced (§11)', () => {
  it('resumes the real thing', () => {
    expect(givenIndex).toBeGreaterThanOrEqual(0);
    expect(toSession(levelRecord)?.level).toBe(1);
  });

  it('drops a mark written on top of a given', () => {
    const marks = withCharacter(levelRecord.marks, givenIndex, '0');
    expect(toSession({ ...levelRecord, marks })).toBeNull();
  });

  it('drops a solution that breaks the three rules', () => {
    // Flipping one cell of a finished board always breaks something: its line
    // now holds one digit more than half of it (§3, rule 2).
    const flipped = levelRecord.solution[0] === '0' ? '1' : '0';
    const solution = withCharacter(levelRecord.solution, 0, flipped);
    expect(toSession({ ...levelRecord, solution })).toBeNull();
  });

  it('drops a given that disagrees with the solution', () => {
    const wrong = levelRecord.solution[givenIndex] === '0' ? '1' : '0';
    const givens = withCharacter(levelRecord.givens, givenIndex, wrong);
    expect(toSession({ ...levelRecord, givens })).toBeNull();
  });

  it('drops a board of the wrong length, and one with characters it never writes', () => {
    expect(toSession({ ...levelRecord, marks: levelRecord.marks.slice(1) })).toBeNull();
    expect(
      toSession({ ...levelRecord, marks: withCharacter(levelRecord.marks, 0, '2') }),
    ).toBeNull();
  });
});
