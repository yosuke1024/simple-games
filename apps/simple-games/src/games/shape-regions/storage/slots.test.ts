/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their difficulty game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 *
 * The second half is the fail-closed half of §11: a record that play could not
 * have produced is dropped rather than resumed. Shape Regions can be strict
 * about that, because the answer travels with the save — a solution that
 * breaks a clue would leave the player with a board that cannot be finished.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createDifficultySession, doStroke, neighbors } from '../game';
import { toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const difficultySession = createDifficultySession('easy', 'shape-regions-easy-slots');
const difficultyRecord = toPersisted(difficultySession, SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);

/** Replaces one character of a board string. */
const withCharacter = (board: string, index: number, character: string): string =>
  board.slice(0, index) + character + board.slice(index + 1);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(toSession(difficultyRecord)?.seed).toBe('shape-regions-easy-slots');
  });

  it('refuses a record written for the other mode', () => {
    // Both records are what the game itself writes, and both are otherwise
    // perfectly valid. The only thing wrong is the slot they are sitting in.
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a difficulty record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...difficultyRecord, dailyDate: '2026-08-07' })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
  });
});

describe('a save play could not have produced (§11)', () => {
  const clue = difficultySession.clues[0]!;
  const ownCell = neighbors(clue.index, difficultySession.width, difficultySession.height).find(
    (cell) => difficultySession.solution[cell] === 0,
  )!;

  it('resumes the real thing, board included', () => {
    const played = doStroke(difficultySession, 0, [ownCell])!;
    const restored = toSession(toPersisted(played, SAVED_AT));
    expect(restored?.assignment).toEqual([...played.assignment]);
    expect(restored?.history).toEqual([]);
  });

  it('drops a solution that breaks its clues', () => {
    const swapped = difficultyRecord.solution[0] === 'a' ? 'b' : 'a';
    expect(
      toSession({
        ...difficultyRecord,
        solution: withCharacter(difficultyRecord.solution, 0, swapped),
      }),
    ).toBeNull();
  });

  it('drops an assignment with a clue cell out of its own region', () => {
    const other = clue.index === 0 ? 'b' : 'a';
    const assignment = withCharacter(difficultyRecord.assignment, clue.index, other);
    expect(toSession({ ...difficultyRecord, assignment })).toBeNull();
  });

  it('drops an assignment with a cell its clue cannot reach', () => {
    // A cell of region 0 nowhere near its clue.
    const far = difficultySession.solution.findIndex(
      (region, index) =>
        region === 0 &&
        !neighbors(clue.index, difficultySession.width, difficultySession.height).includes(index) &&
        index !== clue.index,
    );
    if (far === -1) return; // a two-cell region has no far cell to test with
    const assignment = withCharacter(difficultyRecord.assignment, far, 'a');
    expect(toSession({ ...difficultyRecord, assignment })).toBeNull();
  });

  it('drops a board of the wrong length, and one with characters it never writes', () => {
    expect(
      toSession({ ...difficultyRecord, assignment: difficultyRecord.assignment.slice(1) }),
    ).toBeNull();
    expect(
      toSession({
        ...difficultyRecord,
        assignment: withCharacter(difficultyRecord.assignment, 1, '1'),
      }),
    ).toBeNull();
  });

  it('drops clues that say nothing, or that sit on one another', () => {
    const silent = difficultyRecord.clues.map((c, i) =>
      i === 0 ? { ...c, size: null, shape: null } : c,
    );
    expect(gameSchema.validate({ ...difficultyRecord, clues: silent })).toBeNull();
    const stacked = difficultyRecord.clues.map((c, i) =>
      i === 1 ? { ...c, index: clue.index } : c,
    );
    expect(gameSchema.validate({ ...difficultyRecord, clues: stacked })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, clues: [] })).toBeNull();
  });

  it('drops a board whose size is not its difficulty’s', () => {
    expect(gameSchema.validate({ ...difficultyRecord, width: 6 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard' })).toBeNull();
  });
});
