/**
 * The two saved-game slots (docs/SUDOKU_6X6_RULES.md §11). Both hold the same
 * record shape, so the KEY is what says which mode a record is — and a record
 * that disagrees with its key is corrupt data, not an instruction to change
 * modes.
 *
 * The second half is the fail-closed list of §11, item by item: a record play
 * could not have produced is dropped rather than resumed.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createDailySession, createDifficultySession, placeDigit, toggleCellNote } from '../game';
import { loadSavedGames, toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema, prefsSchema, type PersistedGame } from './schemas';

const SAVED_AT = 1_754_000_000_000;

/** A difficulty game with one entry and one note on it. */
function playedRecord(): PersistedGame {
  let session = createDifficultySession('easy', 'sudoku-6x6-easy-slot');
  const empty = session.board.givens.findIndex((value) => value === 0);
  const other = session.board.givens.findIndex((value, index) => value === 0 && index > empty);
  session = placeDigit(session, empty, 1)!;
  session = toggleCellNote(session, other, 2)!;
  return toPersisted(session, SAVED_AT);
}

const difficultyRecord = playedRecord();
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);

/** Replaces one character of a board string. */
const withCharacter = (board: string, index: number, character: string): string =>
  board.slice(0, index) + character + board.slice(index + 1);

const givenIndex = difficultyRecord.givens.search(/[1-6]/);
const entryIndex = difficultyRecord.entries.search(/[1-6]/);

describe('saved-game slots', () => {
  it('loads each record from its own slot, entries and notes intact', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    const restored = toSession(gameSchema.validate(difficultyRecord))!;
    expect(restored.difficulty).toBe('easy');
    expect(restored.board.entries[entryIndex]).toBe(1);
    expect(restored.board.notes.filter((mask) => mask !== 0)).toEqual([0b10]);
    expect(restored.history).toEqual([]);
    expect(toSession(dailyRecord)?.dailyDate).toBe('2026-08-07');
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a daily without a date, a date on another tier, and a date on a difficulty board', () => {
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, difficulty: 'hard' })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, dailyDate: '2026-08-07' })).toBeNull();
  });
});

describe('a save play could not have produced (§11)', () => {
  const load = (record: PersistedGame) => toSession(gameSchema.validate(record));

  it('resumes the real thing', () => {
    expect(load(difficultyRecord)?.seed).toBe('sudoku-6x6-easy-slot');
  });

  it('drops boards that are not 36 characters', () => {
    expect(
      gameSchema.validate({ ...difficultyRecord, givens: difficultyRecord.givens.slice(1) }),
    ).toBeNull();
    expect(
      gameSchema.validate({ ...difficultyRecord, entries: `${difficultyRecord.entries}.` }),
    ).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, solution: '1'.repeat(35) })).toBeNull();
  });

  it('drops an answer that breaks §2', () => {
    const solution = withCharacter(difficultyRecord.solution, 0, difficultyRecord.solution[1]!);
    expect(load({ ...difficultyRecord, solution })).toBeNull();
  });

  it('drops clues that disagree with the answer', () => {
    const wrong = String((Number(difficultyRecord.givens[givenIndex]) % 6) + 1);
    expect(
      load({
        ...difficultyRecord,
        givens: withCharacter(difficultyRecord.givens, givenIndex, wrong),
      }),
    ).toBeNull();
  });

  it('drops an entry written over a clue', () => {
    expect(
      load({
        ...difficultyRecord,
        entries: withCharacter(difficultyRecord.entries, givenIndex, '1'),
      }),
    ).toBeNull();
  });

  it('drops notes out of range, of the wrong count, or on a filled cell', () => {
    const notes = [...difficultyRecord.notes];
    notes[0] = 64;
    expect(gameSchema.validate({ ...difficultyRecord, notes })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, notes: notes.slice(1) })).toBeNull();
    const onEntry = [...difficultyRecord.notes];
    onEntry[entryIndex] = 1;
    expect(load({ ...difficultyRecord, notes: onEntry })).toBeNull();
    const onGiven = [...difficultyRecord.notes];
    onGiven[givenIndex] = 1;
    expect(load({ ...difficultyRecord, notes: onGiven })).toBeNull();
  });

  it('drops characters the game never writes', () => {
    expect(
      load({ ...difficultyRecord, entries: withCharacter(difficultyRecord.entries, 0, '7') }),
    ).toBeNull();
    expect(
      load({ ...difficultyRecord, entries: withCharacter(difficultyRecord.entries, 0, '0') }),
    ).toBeNull();
  });
});

describe('preferences (§4, §9)', () => {
  it('starts at Easy with mistakes shown, and refuses a malformed record', () => {
    expect(prefsSchema.defaultValue()).toEqual({
      schemaVersion: 1,
      difficulty: 'easy',
      highlightMistakes: true,
    });
    expect(
      prefsSchema.validate({ schemaVersion: 1, difficulty: 'hard', highlightMistakes: false }),
    ).toEqual({
      schemaVersion: 1,
      difficulty: 'hard',
      highlightMistakes: false,
    });
    expect(
      prefsSchema.validate({ schemaVersion: 1, difficulty: 'expert', highlightMistakes: true }),
    ).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'easy' })).toBeNull();
  });
});

describe('a daily left over from another day (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」)', () => {
  it('is dropped at load, record and all, while the same day still resumes', async () => {
    const stored = () => createMemoryKV({ [dailyGameSchema.key]: JSON.stringify(dailyRecord) });

    const sameDay = stored();
    expect((await loadSavedGames(sameDay, '2026-08-07')).daily?.dailyDate).toBe('2026-08-07');
    expect(await sameDay.get(dailyGameSchema.key)).not.toBeNull();

    const nextDay = stored();
    expect((await loadSavedGames(nextDay, '2026-08-08')).daily).toBeNull();
    expect(await nextDay.get(dailyGameSchema.key)).toBeNull();
  });
});
