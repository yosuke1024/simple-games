/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their difficulty game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 *
 * The second half is the fail-closed half of §11: a record that play could not
 * have produced is dropped rather than resumed. Crown Grid can be strict about
 * that, because the answer travels with the save — a solution that breaks the
 * rules would leave the player with a board that cannot be finished.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { createDailySession, createDifficultySession } from '../game';
import { loadSavedGames, toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const difficultyRecord = toPersisted(
  createDifficultySession('easy', 'crown-grid-easy-slot'),
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

  it('refuses a daily record without a date, and a size that is not the tier’s', () => {
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, size: 8 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'medium' })).toBeNull();
  });
});

describe('a save play could not have produced (§11)', () => {
  it('resumes the real thing', () => {
    expect(toSession(difficultyRecord)?.seed).toBe('crown-grid-easy-slot');
  });

  it('drops regions that are not N connected regions', () => {
    // Every cell in region a: five regions missing.
    expect(toSession({ ...difficultyRecord, regions: 'a'.repeat(36) })).toBeNull();
    // An unknown letter.
    expect(
      toSession({ ...difficultyRecord, regions: withCharacter(difficultyRecord.regions, 0, 'z') }),
    ).toBeNull();
  });

  it('drops an answer that breaks the rules', () => {
    // Repeating the first column in the second row uses a column twice.
    const solution = withCharacter(difficultyRecord.solution, 1, difficultyRecord.solution[0]!);
    expect(toSession({ ...difficultyRecord, solution })).toBeNull();
  });

  it('drops marks of the wrong length, and marks with characters it never writes', () => {
    expect(toSession({ ...difficultyRecord, marks: difficultyRecord.marks.slice(1) })).toBeNull();
    expect(
      toSession({ ...difficultyRecord, marks: withCharacter(difficultyRecord.marks, 0, '0') }),
    ).toBeNull();
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
