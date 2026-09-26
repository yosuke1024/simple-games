/**
 * The two saved-game slots. Both hold the same record shape, so the KEY is
 * what says which mode a record is — and a record that disagrees with its key
 * is corrupt data, not an instruction to change modes. Loading one would send
 * a player who asked to resume their difficulty game into the daily slot: the
 * other game, or a blank screen where the other game isn't.
 *
 * The second half is the fail-closed half of §9: a record that play could not
 * have produced is dropped rather than resumed. Number Path can be strict
 * about that, because the answer travels with the save — a solution that is
 * not a road would leave the player with a board that cannot be finished.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createDifficultySession, doTap } from '../game';
import { toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema } from './schemas';

const SAVED_AT = 1_754_000_000_000;
const easy = createDifficultySession('easy', 'number-path-easy-slots');
const played = doTap(easy, easy.solution[1]!)!;
const difficultyRecord = toPersisted(played, SAVED_AT);
const dailyRecord = toPersisted(createDailySession('2026-09-26'), SAVED_AT);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(toSession(difficultyRecord)?.path).toEqual(played.path);
    expect(toSession(dailyRecord)?.dailyDate).toBe('2026-09-26');
  });

  it('refuses a record written for the other mode', () => {
    // Both records are what the game itself writes, and both are otherwise
    // perfectly valid. The only thing wrong is the slot they are sitting in.
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a board of the wrong size for its difficulty', () => {
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard' })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, width: 6 })).toBeNull();
  });

  it('refuses a daily record claiming a board size other than medium (§7)', () => {
    // Self-consistent as an easy board — buildable, its own valid solution and
    // path — so only the cross-check between the mode and the difficulty can
    // catch it: a daily is medium every day, and Retry rebuilds a daily from
    // `DAILY_DIFFICULTY` regardless of what a record claims (session.ts), so
    // letting this through would have it resume as one board and Retry into
    // another (§9 fail-closed).
    const easyDailyRecord = {
      ...difficultyRecord,
      mode: 'daily' as const,
      dailyDate: '2026-09-26',
    };
    expect(dailyGameSchema.validate(easyDailyRecord)).toBeNull();
  });
});

describe('a save play could not have produced (§9)', () => {
  it('resumes the real thing', () => {
    const session = toSession(difficultyRecord);
    expect(session?.seed).toBe('number-path-easy-slots');
    expect(session?.solution).toEqual(played.solution);
    expect(session?.history).toEqual([]);
  });

  it('drops a path that left the rules', () => {
    // A jump to the far end of the road, and a step through the first wall.
    const far = played.solution[played.solution.length - 1]!;
    expect(toSession({ ...difficultyRecord, path: [played.path[0]!, far] })).toBeNull();
    expect(toSession({ ...difficultyRecord, path: [played.path[1]!] })).toBeNull();
  });

  it('drops a solution that is not the road', () => {
    const solution = [...difficultyRecord.solution].reverse();
    expect(toSession({ ...difficultyRecord, solution })).toBeNull();
    expect(
      toSession({ ...difficultyRecord, solution: difficultyRecord.solution.slice(1) }),
    ).toBeNull();
  });

  it('drops a board whose numbers or walls do not build', () => {
    expect(
      toSession({ ...difficultyRecord, numbers: difficultyRecord.numbers.slice(1) }),
    ).toBeNull();
    expect(toSession({ ...difficultyRecord, walls: [...difficultyRecord.walls, 'zz'] })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, walls: ['h1', 5] })).toBeNull();
  });

  it('does not resume a board that is already solved', () => {
    expect(toSession({ ...difficultyRecord, path: [...difficultyRecord.solution] })).toBeNull();
  });
});
