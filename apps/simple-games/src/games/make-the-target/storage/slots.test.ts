/**
 * The two saved-game slots (docs/MAKE_THE_TARGET_RULES.md §10). Both hold
 * the same record shape, so the KEY is what says which mode a record is — and
 * a record that disagrees with its key is corrupt data, not an instruction to
 * switch modes (src/test/savedGameSlots.test.ts).
 *
 * The second half is the fail-closed half: every check is the slot schema's
 * `validate`, which replays the stored solution and moves through the rules,
 * so a record play could not have produced comes back as nothing — and
 * `validate` never throws, whatever it is handed.
 */
import { describe, expect, it } from 'vitest';
import { canUndo, ELAPSED_SECONDS_MAX, SAVED_AT_MAX, undo, withElapsed } from '../game';
import {
  dailyGame,
  freeGame,
  MISS,
  play,
  problemAt,
  SAVED_AT,
  SOLVE,
  storedRecord,
} from '../ui/test-helpers';
import { soleSuspendedMode, toPersisted, toSession } from './gamePersistence';
import { dailyGameSchema, gameSchema, MAX_SEED_LENGTH, type PersistedGame } from './schemas';

const DAY = '2026-10-21';
const freeRecord = (): PersistedGame => toPersisted(play(freeGame(), 0, '+', 1), SAVED_AT)!;
const dailyRecord = (): PersistedGame => toPersisted(dailyGame(DAY), SAVED_AT)!;

describe('saved-game slots (§10)', () => {
  it('loads each record from its own slot, and round-trips the game in it', () => {
    expect(gameSchema.validate(freeRecord())?.mode).toBe('free');
    expect(dailyGameSchema.validate(dailyRecord())?.mode).toBe('daily');

    const played = withElapsed(play(freeGame(), 0, '+', 1, 2, '+', 3), 42);
    const back = toSession(gameSchema.validate(JSON.parse(storedRecord(played))));
    expect(back?.slots).toEqual(played.slots);
    expect(back?.moves).toEqual(played.moves);
    expect(back?.problem).toEqual(played.problem);
    expect(back?.elapsedSeconds).toBe(42);
    // The move list is the Undo history (§5): back to the numbers as dealt.
    const first = undo(undo(back!)!)!;
    expect(first.slots).toEqual([1, 2, 3, 4]);
    expect(canUndo(first)).toBe(false);
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord())).toBeNull();
    expect(dailyGameSchema.validate(freeRecord())).toBeNull();
  });

  it('refuses a Free Play record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...freeRecord(), dailyDate: DAY })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord(), dailyDate: null })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord(), dailyDate: '21/10/2026' })).toBeNull();
  });

  it('refuses a daily at any difficulty but Medium, a daily retry flag, another day’s seed', () => {
    expect(dailyGameSchema.validate({ ...dailyRecord(), difficulty: 'easy' })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord(), repeat: true })).toBeNull();
    expect(
      dailyGameSchema.validate({ ...dailyRecord(), seed: 'make-the-target-daily-2026-10-20' }),
    ).toBeNull();
    expect(dailyGameSchema.validate(dailyRecord())?.difficulty).toBe('medium');
  });

  it('keeps a Free Play retry of a solved problem a retry, through the save (§9)', () => {
    const record = { ...freeRecord(), repeat: true };
    expect(toSession(gameSchema.validate(record))?.repeat).toBe(true);
  });

  it('reads a game on the `missed` panel as a game to resume (§4)', () => {
    const missed = play(freeGame(), ...MISS);
    expect(missed.status).toBe('missed');
    const back = toSession(gameSchema.validate(toPersisted(missed, SAVED_AT)));
    expect(back?.status).toBe('missed');
    expect(undo(back!)?.status).toBe('playing');
  });

  it('answers a shortcut only when exactly one game is suspended (issue #113)', () => {
    const free = freeGame();
    const daily = dailyGame(DAY);
    const missed = play(freeGame(), ...MISS);
    const solved = play(freeGame(), ...SOLVE);
    expect(soleSuspendedMode({ free, daily: null })).toBe('free');
    expect(soleSuspendedMode({ free: null, daily })).toBe('daily');
    expect(soleSuspendedMode({ free: missed, daily: null })).toBe('free');
    expect(soleSuspendedMode({ free, daily })).toBeNull();
    expect(soleSuspendedMode({ free: null, daily: null })).toBeNull();
    expect(soleSuspendedMode({ free: solved, daily: null })).toBeNull();
  });
});

describe('a record play could not have produced (§10「fail-closed の条件」)', () => {
  const good = freeRecord();
  const refused: [string, unknown][] = [
    ['not an object', 'tg'],
    ['an array', [good]],
    ['null', null],
    ['another schemaVersion', { ...good, schemaVersion: 2 }],
    ['another mode', { ...good, mode: 'endless' }],
    ['an empty seed', { ...good, seed: '' }],
    ['a seed too long to be one', { ...good, seed: `${good.seed}${'x'.repeat(MAX_SEED_LENGTH)}` }],
    ['another difficulty’s seed', { ...good, seed: 'make-the-target-hard-lq1x2-abc' }],
    ['a difficulty the game lacks', { ...good, difficulty: 'expert' }],
    ['six numbers (v1 deals none)', { ...good, numbers: [1, 2, 3, 4, 5, 6] }],
    ['numbers out of order', { ...good, numbers: [2, 1, 3, 4] }],
    ['a number out of the tier’s range', { ...good, numbers: [1, 2, 3, 14] }],
    ['a target outside the band', { ...good, target: 25 }],
    ['a solution that does not reach the target', { ...good, solution: '0+12+31+3' }],
    ['a solution of the wrong length', { ...good, solution: '0+12+3' }],
    ['an illegal move (1 − 2 is negative)', { ...good, moves: '0-1' }],
    ['a move on a used-up slot', { ...good, moves: '0+10+2' }],
    ['a move between a slot and itself', { ...good, moves: '1+1' }],
    ['a move to a slot off the board', { ...good, moves: '0+5' }],
    ['more moves than the problem has', { ...good, moves: '0+12+31*30+1' }],
    ['a board already solved', { ...good, moves: '0+12+31*3' }],
    ['a retry flag that is not a boolean', { ...good, repeat: 'yes' }],
    ['a negative clock', { ...good, elapsedSeconds: -1 }],
    ['a fractional clock', { ...good, elapsedSeconds: 1.5 }],
    ['a clock past its bound', { ...good, elapsedSeconds: ELAPSED_SECONDS_MAX + 1 }],
    ['a clock of 1e300', { ...good, elapsedSeconds: 1e300 }],
    ['a missing savedAt', { ...good, savedAt: undefined }],
    ['a savedAt of 1e300', { ...good, savedAt: 1e300 }],
    ['a savedAt past its bound', { ...good, savedAt: SAVED_AT_MAX + 1 }],
  ];

  it.each(refused)('drops %s', (_, record) => {
    expect(gameSchema.validate(record)).toBeNull();
  });

  it('reads the record those are variants of, and the bounds themselves', () => {
    expect(gameSchema.validate(good)).not.toBeNull();
    expect(
      gameSchema.validate({ ...good, elapsedSeconds: ELAPSED_SECONDS_MAX, savedAt: SAVED_AT_MAX }),
    ).not.toBeNull();
    // −0 is a stored zero; it reads back as 0.
    expect(gameSchema.validate({ ...good, elapsedSeconds: -0 })?.elapsedSeconds).toBe(0);
    // An unknown extra field is dropped, not refused.
    expect(gameSchema.validate({ ...good, extra: 1 })).not.toHaveProperty('extra');
  });

  it('never throws, not even on a getter that does, on any field', () => {
    for (const field of Object.keys(good)) {
      const hostile = Object.defineProperty({ ...good }, field, {
        get() {
          throw new Error('no');
        },
        enumerable: true,
      });
      for (const schema of [gameSchema, dailyGameSchema]) {
        expect(() => schema.validate(hostile), field).not.toThrow();
        expect(schema.validate(hostile), field).toBeNull();
      }
    }
    for (const field of Object.keys(good)) {
      for (const value of [undefined, null, NaN, Infinity, {}, [], 'x', -1, 1e300]) {
        expect(() => gameSchema.validate({ ...good, [field]: value })).not.toThrow();
      }
    }
  });

  it('hands back the record as the replay rebuilt it, so a shape-only variant cannot ride along', () => {
    const shaped = gameSchema.validate({ ...good, numbers: [...good.numbers] })!;
    expect(shaped).toEqual(good);
    expect(problemAt('easy').numbers).toEqual(shaped.numbers);
  });
});
