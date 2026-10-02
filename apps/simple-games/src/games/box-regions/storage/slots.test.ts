/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes.
 *
 * The second half is the fail-closed half of docs/BOX_REGIONS_RULES.md §11: a
 * record that play could not have produced is dropped rather than resumed.
 * Box Regions can be strict about that, because the answer travels with the
 * save — a solution that breaks a clue would leave the player with a board
 * that cannot be finished.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createDailySession, createDifficultySession, doDraw, regionCells } from '../game';
import { loadSavedGames, toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const difficultySession = createDifficultySession('easy', 'box-regions-easy-slots');
const difficultyRecord = toPersisted(difficultySession, SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-08-07'), SAVED_AT);

/** Replaces one character of a board string. */
const withCharacter = (board: string, index: number, character: string): string =>
  board.slice(0, index) + character + board.slice(index + 1);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(toSession(difficultyRecord)?.seed).toBe('box-regions-easy-slots');
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a difficulty record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...difficultyRecord, dailyDate: '2026-08-07' })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
  });

  it('refuses a daily record at any difficulty but medium (§9, §11)', () => {
    // A well-formed easy board wearing a date: every daily is medium, so this
    // cannot have come from play, and the slot drops it rather than resuming an
    // easy daily.
    const easyDaily = { ...difficultyRecord, mode: 'daily' as const, dailyDate: '2026-08-07' };
    expect(dailyGameSchema.validate(easyDaily)).toBeNull();
    expect(dailyGameSchema.validate(dailyRecord)?.difficulty).toBe('medium');
  });
});

describe('a save play could not have produced (§11)', () => {
  const box = regionCells(difficultySession.solution, 0);

  it('resumes the real thing, board included', () => {
    const played = doDraw(difficultySession, box[0]!, box[box.length - 1]!)!;
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

  it('drops an assignment with a box that holds another clue', () => {
    // Every cell given to region 0: a rectangle, but every clue inside it.
    const assignment = 'a'.repeat(difficultyRecord.assignment.length);
    expect(toSession({ ...difficultyRecord, assignment })).toBeNull();
  });

  it('drops an assignment whose box is not a rectangle, or misses its clue', () => {
    const clue = difficultySession.clues[0]!.index;
    // Region 0 on its clue and on a cell that does not touch it: not a rectangle.
    const far = clue === 0 ? difficultyRecord.assignment.length - 1 : 0;
    const ragged = withCharacter(withCharacter(difficultyRecord.assignment, clue, 'a'), far, 'a');
    expect(toSession({ ...difficultyRecord, assignment: ragged })).toBeNull();
    // Region 0 on a cell of its own that is not its clue, and nothing else.
    const off = box.find((cell) => cell !== clue);
    if (off !== undefined) {
      const missing = withCharacter(difficultyRecord.assignment, off, 'a');
      expect(toSession({ ...difficultyRecord, assignment: missing })).toBeNull();
    }
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

  it('drops clues out of range, of unknown kind, or sitting on one another', () => {
    const tooBig = difficultyRecord.clues.map((c, i) => (i === 0 ? { ...c, size: 13 } : c));
    expect(gameSchema.validate({ ...difficultyRecord, clues: tooBig })).toBeNull();
    const unknown = difficultyRecord.clues.map((c, i) => (i === 0 ? { ...c, kind: 'L' } : c));
    expect(gameSchema.validate({ ...difficultyRecord, clues: unknown })).toBeNull();
    const stacked = difficultyRecord.clues.map((c, i) =>
      i === 1 ? { ...c, index: difficultyRecord.clues[0]!.index } : c,
    );
    expect(gameSchema.validate({ ...difficultyRecord, clues: stacked })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, clues: [] })).toBeNull();
  });

  it('keeps a clue that says nothing: free with no number is a real clue (§2)', () => {
    const bare = difficultyRecord.clues.map((c, i) =>
      i === 0 ? { ...c, size: null, kind: 'free' } : c,
    );
    expect(gameSchema.validate({ ...difficultyRecord, clues: bare })).not.toBeNull();
  });

  it('drops a board whose size is not its difficulty’s', () => {
    expect(gameSchema.validate({ ...difficultyRecord, width: 6 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard' })).toBeNull();
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
