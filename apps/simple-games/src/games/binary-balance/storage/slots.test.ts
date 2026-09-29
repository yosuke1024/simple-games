/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their difficulty game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 *
 * The second half is the fail-closed list of docs/BINARY_BALANCE_RULES.md §11:
 * a record that play could not have produced is dropped rather than resumed.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createDifficultySession, doTap } from '../game';
import { toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const difficultyRecord = toPersisted(
  doTap(createDifficultySession('easy', 'binary-balance-easy-golden'), 0)!,
  SAVED_AT,
);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);

/** Replaces one character of a board string. */
const withCharacter = (board: string, index: number, character: string): string =>
  board.slice(0, index) + character + board.slice(index + 1);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(toSession(difficultyRecord)?.difficulty).toBe('easy');
    expect(toSession(dailyRecord)?.dailyDate).toBe('2026-08-07');
  });

  it('refuses a record written for the other mode', () => {
    // Both records are what the game itself writes, and both are otherwise
    // perfectly valid. The only thing wrong is the slot they are sitting in.
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a daily without a date, a dated record off medium, and any size but 6', () => {
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, difficulty: 'easy' })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, dailyDate: '2026-08-07' })).toBeNull();
    // Every tier is 6×6 (§1), so an 8 is not a record play produced at any of them.
    expect(gameSchema.validate({ ...difficultyRecord, size: 8 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard', size: 8 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard' })).not.toBeNull();
  });
});

describe('a save play could not have produced (§11)', () => {
  it('resumes the real thing', () => {
    expect(toSession(difficultyRecord)?.seed).toBe('binary-balance-easy-golden');
    expect(toSession(difficultyRecord)?.marks[0]).toBe(0);
  });

  it('drops links that name no edge, twice, or none at all', () => {
    expect(toSession({ ...difficultyRecord, links: '' })).toBeNull();
    expect(toSession({ ...difficultyRecord, links: 'h5=' })).toBeNull();
    expect(toSession({ ...difficultyRecord, links: 'v30x' })).toBeNull();
    expect(toSession({ ...difficultyRecord, links: `${difficultyRecord.links},h1=` })).toBeNull();
    expect(toSession({ ...difficultyRecord, links: 'h1?' })).toBeNull();
  });

  it('drops an answer that breaks a rule, and givens that disagree with it', () => {
    expect(
      toSession({ ...difficultyRecord, solution: '000111' + difficultyRecord.solution.slice(6) }),
    ).toBeNull();
    // Easy golden: h1 is '=', so saying × makes the stored answer break rule 3.
    expect(
      toSession({ ...difficultyRecord, links: difficultyRecord.links.replace('h1=', 'h1x') }),
    ).toBeNull();
    const given = difficultyRecord.givens.search(/[01]/);
    const flipped = difficultyRecord.givens[given] === '0' ? '1' : '0';
    expect(
      toSession({
        ...difficultyRecord,
        givens: withCharacter(difficultyRecord.givens, given, flipped),
      }),
    ).toBeNull();
  });

  it('drops marks over a given, of the wrong length, or with characters it never writes', () => {
    const given = difficultyRecord.givens.search(/[01]/);
    expect(
      toSession({ ...difficultyRecord, marks: withCharacter(difficultyRecord.marks, given, '1') }),
    ).toBeNull();
    expect(toSession({ ...difficultyRecord, marks: difficultyRecord.marks.slice(1) })).toBeNull();
    expect(
      toSession({ ...difficultyRecord, marks: withCharacter(difficultyRecord.marks, 1, 'x') }),
    ).toBeNull();
  });
});
