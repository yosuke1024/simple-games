/**
 * The three saved-game slots. All hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their level game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 *
 * The second half is the fail-closed half of §11. Futoshiki can be strict
 * about it because the answer travels with the save: a solution that is not a
 * Latin square, or a sign that points against it, would leave the player with
 * a board that cannot be finished.
 *
 * Every rejection below is checked through `decodeGame` in the game layer, not
 * against a second copy of the rules living in storage/ — which is the point
 * of the split, and what these cases are really pinning.
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

/** The first fixed digit of level 1 — the one no move is allowed to touch (§4). */
const givenIndex = levelSession.board.givens.findIndex((cell) => cell !== EMPTY);
/** The first cell the puzzle leaves to the player. */
const openIndex = levelSession.board.givens.findIndex((cell) => cell === EMPTY);

/** Replaces one character of a grid string. */
const withCharacter = (grid: string, index: number, character: string): string =>
  grid.slice(0, index) + character + grid.slice(index + 1);

/** A digit this size has, that is not the one the solution wants there. */
const otherDigit = (index: number): string => {
  const truth = levelSession.solution[index]!;
  return String(truth === 1 ? 2 : 1);
};

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
    expect(freeGameSchema.validate({ ...freeRecord, freeTier: null })).toBeNull();
    // Hard is level 95's board, a 7×7 (§9): a tier that disagrees with the
    // size never came from play.
    expect(freeGameSchema.validate({ ...freeRecord, freeTier: 'easy' })).toBeNull();
  });

  it('reads a level record from before free play existed, but never one with a tier', () => {
    const { freeTier: _tier, ...older } = levelRecord;
    expect(gameSchema.validate(older)?.freeTier).toBeNull();
    expect(gameSchema.validate({ ...levelRecord, freeTier: 'easy' })).toBeNull();
  });

  it('refuses a record whose size the game does not have', () => {
    expect(gameSchema.validate({ ...levelRecord, size: 8 })).toBeNull();
    expect(gameSchema.validate({ ...levelRecord, size: 3 })).toBeNull();
  });
});

describe('a save play could not have produced (§11)', () => {
  it('resumes the real thing, signs and all', () => {
    expect(givenIndex).toBeGreaterThanOrEqual(0);
    expect(openIndex).toBeGreaterThanOrEqual(0);
    const resumed = toSession(levelRecord);
    expect(resumed?.level).toBe(1);
    expect(resumed?.constraints).toEqual(levelSession.constraints);
    expect(resumed?.history).toEqual([]);
    // A free board comes back with the tier a restart needs (§9).
    expect(toSession(freeRecord)?.freeTier).toBe('hard');
  });

  it('drops a solution that is not a Latin square', () => {
    // One cell copied from its row neighbour: that row now holds a digit twice
    // and is missing another (§3, rule 1).
    const solution = withCharacter(levelRecord.solution, 0, levelRecord.solution[1]!);
    expect(toSession({ ...levelRecord, solution })).toBeNull();
  });

  it('drops a sign that points against the solution', () => {
    // The strongest invariant this format has: generation reads the direction
    // off the solution, so a token pointing the other way never came from play.
    // Exactly one sign is turned around, by index — a regex replace without
    // /g reads like a sanitizer that missed the rest of the string, and both
    // CodeQL and the next reader are right to distrust it. One is the point
    // here: the smallest corruption the decoder has to catch.
    const at = levelRecord.constraints.search(/[<>]/);
    expect(at).toBeGreaterThanOrEqual(0);
    const flipped = withCharacter(
      levelRecord.constraints,
      at,
      levelRecord.constraints[at] === '<' ? '>' : '<',
    );
    expect(flipped).not.toBe(levelRecord.constraints);
    expect(toSession({ ...levelRecord, constraints: flipped })).toBeNull();
  });

  it('drops a sign between two squares that do not touch', () => {
    expect(toSession({ ...levelRecord, constraints: '0h<,0h>' })).toBeNull();
    expect(toSession({ ...levelRecord, constraints: '99h<' })).toBeNull();
    expect(toSession({ ...levelRecord, constraints: 'nonsense' })).toBeNull();
  });

  it('drops a board with no signs at all — that is a Latin square, not this game', () => {
    expect(toSession({ ...levelRecord, constraints: '' })).toBeNull();
  });

  it('drops a given that disagrees with the solution', () => {
    const givens = withCharacter(levelRecord.givens, givenIndex, otherDigit(givenIndex));
    expect(toSession({ ...levelRecord, givens })).toBeNull();
  });

  it('drops an entry written on top of a given', () => {
    const entries = withCharacter(levelRecord.entries, givenIndex, '1');
    expect(toSession({ ...levelRecord, entries })).toBeNull();
  });

  it('drops a note left under a written digit', () => {
    // Placing a digit clears the notes beneath it (§4), so a mask on a filled
    // cell is a state play cannot reach.
    const masks = levelRecord.notes.split(',');
    masks[givenIndex] = '1';
    expect(toSession({ ...levelRecord, notes: masks.join(',') })).toBeNull();
  });

  it('drops a note holding a digit this size has not got', () => {
    const masks = levelRecord.notes.split(',');
    // Bit 7 is digit 7, which a 4×4 board never offers (§1).
    masks[openIndex] = (1 << 6).toString(32);
    expect(toSession({ ...levelRecord, notes: masks.join(',') })).toBeNull();
  });

  it('drops a grid of the wrong length, and one with characters it never writes', () => {
    expect(toSession({ ...levelRecord, entries: levelRecord.entries.slice(1) })).toBeNull();
    expect(toSession({ ...levelRecord, solution: levelRecord.solution.slice(1) })).toBeNull();
    expect(
      toSession({ ...levelRecord, entries: withCharacter(levelRecord.entries, openIndex, '9') }),
    ).toBeNull();
    expect(toSession({ ...levelRecord, notes: levelRecord.notes.slice(2) })).toBeNull();
  });

  it('does not resume a game that is already finished', () => {
    // A solved board is a result screen, not a game to come back to.
    expect(toSession({ ...levelRecord, entries: levelRecord.solution })).toBeNull();
  });
});
