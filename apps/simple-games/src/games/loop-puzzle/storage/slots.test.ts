/**
 * The two saved-game slots (docs/LOOP_PUZZLE_RULES.md §12). Both hold the
 * same record shape, so the KEY is what says which mode a record is — and a
 * record that disagrees with its key is corrupt data, not an instruction to
 * change modes.
 *
 * The second half is the fail-closed half of §12: a record that play could
 * not have produced is dropped rather than resumed — truncated or mistyped
 * fields, a board of the wrong size, damaged clues (even into another
 * one-loop board), clues with no loop or two, a search that runs out, a
 * finished game, a daily from another day. Dropping means the default (no
 * game), never a fresh board in its place.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord } from '@/storage/repo';
import {
  CROSS,
  LINE,
  UNKNOWN,
  createDailySession,
  createDifficultySession,
  doCycle,
  encodeClues,
  restartSession,
  type LoopPuzzleSession,
  type Mark,
} from '../game';
import {
  loadSavedGames,
  saveGame,
  soleSuspendedMode,
  toPersisted,
  toSession,
} from './gamePersistence';
import { dailyGameSchema, gameSchema, LP_STORAGE_KEYS } from './schemas';

const SAVED_AT = 1_790_000_000_000;
const DAY = '2026-10-17';
const difficultySession = createDifficultySession('easy', 'loop-puzzle-easy-slots');
const dailySession = createDailySession(DAY);
const difficultyRecord = toPersisted(difficultySession, SAVED_AT);
const dailyRecord = toPersisted(dailySession, SAVED_AT);

/** Replaces one character of a string. */
const withCharacter = (text: string, index: number, character: string): string =>
  text.slice(0, index) + character + text.slice(index + 1);

/** The session with these marks written straight in (no history). */
const withMarks = (session: LoopPuzzleSession, marks: readonly Mark[]): LoopPuzzleSession => ({
  ...session,
  marks,
});

const firstLine = (session: LoopPuzzleSession): number => session.solution.indexOf(LINE);
const firstCross = (session: LoopPuzzleSession): number => session.solution.indexOf(CROSS);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(toSession(difficultyRecord)?.seed).toBe('loop-puzzle-easy-slots');
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a difficulty record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...difficultyRecord, dailyDate: DAY })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
  });

  it('refuses a daily at any difficulty but medium, and a date that is no day (§9, §12)', () => {
    const easyDaily = { ...difficultyRecord, mode: 'daily' as const, dailyDate: DAY };
    expect(dailyGameSchema.validate(easyDaily)).toBeNull();
    expect(dailyGameSchema.validate(dailyRecord)?.difficulty).toBe('medium');
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: '2026-02-30' })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: '17/10/2026' })).toBeNull();
  });

  it('writes each mode to its own key, and neither evicts the other', async () => {
    const kv = createMemoryKV();
    await saveGame(difficultySession, kv);
    await saveGame(dailySession, kv);
    expect(JSON.parse((await kv.get(LP_STORAGE_KEYS.game))!).mode).toBe('difficulty');
    expect(JSON.parse((await kv.get(LP_STORAGE_KEYS.dailyGame))!).mode).toBe('daily');
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.difficulty?.seed).toBe(difficultySession.seed);
    expect(saved.daily?.seed).toBe(dailySession.seed);
    // Two suspended games: a shortcut has no single answer (issue #113).
    expect(soleSuspendedMode(saved)).toBeNull();
    expect(soleSuspendedMode({ ...saved, daily: null })).toBe('difficulty');
  });
});

describe('the round trip (§12)', () => {
  it('keeps the clues, the marks and the counters, and re-derives the answer', () => {
    const played = doCycle(doCycle(doCycle(difficultySession, 0)!, 3)!, 3)!;
    const counted = { ...played, hintCount: 4, elapsedSeconds: 97 };
    const restored = toSession(toPersisted(counted, SAVED_AT))!;
    expect(restored.clues).toEqual([...counted.clues]);
    expect(restored.marks).toEqual([...counted.marks]);
    expect(restored.solution).toEqual([...counted.solution]);
    expect(restored.hintCount).toBe(4);
    expect(restored.elapsedSeconds).toBe(97);
    expect(restored.status).toBe('playing');
    // The undo history is never saved (§6).
    expect(restored.history).toEqual([]);
  });

  it('keeps the record minimal: no answer, no history, no status', () => {
    expect(Object.keys(difficultyRecord).sort()).toEqual(
      [
        'schemaVersion',
        'mode',
        'seed',
        'difficulty',
        'dailyDate',
        'width',
        'height',
        'clues',
        'cluesDigest',
        'marks',
        'hintCount',
        'elapsedSeconds',
        'savedAt',
      ].sort(),
    );
  });

  it('survives JSON, as the store holds it', async () => {
    const kv = createMemoryKV({ [LP_STORAGE_KEYS.game]: JSON.stringify(difficultyRecord) });
    expect(await loadRecord(gameSchema, kv)).toEqual(difficultyRecord);
  });

  it('resumes the board that was played even when it is not the seed’s board (§12)', () => {
    // The record keeps its clues so that a game in progress outlives a
    // generator change: the seed is not consulted, the clues are proven.
    const elsewhere = { ...difficultyRecord, seed: 'loop-puzzle-easy-other' };
    expect(toSession(elsewhere)?.clues).toEqual([...difficultySession.clues]);
    const retried = toPersisted(restartSession(dailySession), SAVED_AT);
    expect(toSession(retried)?.clues).toEqual([...dailySession.clues]);
  });
});

describe('a save play could not have produced (§12)', () => {
  it('drops truncated and mistyped records', async () => {
    const kv = createMemoryKV({
      [LP_STORAGE_KEYS.game]: JSON.stringify(difficultyRecord).slice(0, 40),
      [LP_STORAGE_KEYS.dailyGame]: '{"schemaVersion":1,',
    });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
    for (const broken of [
      { ...difficultyRecord, schemaVersion: 2 },
      { ...difficultyRecord, mode: 'endless' },
      { ...difficultyRecord, seed: '' },
      { ...difficultyRecord, seed: 7 },
      { ...difficultyRecord, difficulty: 'expert' },
      { ...difficultyRecord, width: '4' },
      { ...difficultyRecord, clues: [...difficultyRecord.clues] },
      { ...difficultyRecord, marks: null },
      { ...difficultyRecord, cluesDigest: undefined },
      { ...difficultyRecord, hintCount: -1 },
      { ...difficultyRecord, hintCount: 1.5 },
      { ...difficultyRecord, elapsedSeconds: Number.NaN },
      { ...difficultyRecord, elapsedSeconds: 2e9 },
      { ...difficultyRecord, savedAt: 'yesterday' },
      null,
      [],
      'lp',
    ]) {
      expect(gameSchema.validate(broken)).toBeNull();
    }
  });

  it('drops a board whose size is not its difficulty’s', () => {
    expect(gameSchema.validate({ ...difficultyRecord, width: 5 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard' })).toBeNull();
    expect(
      gameSchema.validate({ ...difficultyRecord, clues: difficultyRecord.clues.slice(1) }),
    ).toBeNull();
    expect(
      gameSchema.validate({ ...difficultyRecord, marks: `${difficultyRecord.marks}.` }),
    ).toBeNull();
  });

  it('drops characters the game never writes — a 4 among them (§2)', () => {
    const clueAt = difficultyRecord.clues.search(/[0-3]/);
    expect(
      gameSchema.validate({
        ...difficultyRecord,
        clues: withCharacter(difficultyRecord.clues, clueAt, '4'),
      }),
    ).toBeNull();
    expect(
      gameSchema.validate({
        ...difficultyRecord,
        clues: withCharacter(difficultyRecord.clues, 0, 'x'),
      }),
    ).toBeNull();
    expect(
      gameSchema.validate({
        ...difficultyRecord,
        marks: withCharacter(difficultyRecord.marks, 0, 'l'),
      }),
    ).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, cluesDigest: 'lp1:XYZ' })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, cluesDigest: 'lp2:00000000' })).toBeNull();
  });

  it('drops clues that do not match their digest — damage, even into a valid shape', () => {
    // Clear one clue: still well-formed, still the right length, but not the
    // clues the digest was written for.
    const at = difficultyRecord.clues.search(/[0-3]/);
    const damaged = { ...difficultyRecord, clues: withCharacter(difficultyRecord.clues, at, '.') };
    expect(gameSchema.validate(damaged)).not.toBeNull();
    expect(toSession(damaged)).toBeNull();
  });

  it('drops clues with no loop, or with more than one, even under a matching digest', () => {
    const empty = toPersisted(
      { ...difficultySession, clues: difficultySession.clues.map(() => null) },
      SAVED_AT,
    );
    const zeros = toPersisted(
      { ...difficultySession, clues: difficultySession.clues.map(() => 0) },
      SAVED_AT,
    );
    // Both are structurally fine — the schema does not search …
    expect(gameSchema.validate(empty)).not.toBeNull();
    expect(gameSchema.validate(zeros)).not.toBeNull();
    // … and the load proves them wrong: many loops, and none at all.
    expect(toSession(empty)).toBeNull();
    expect(toSession(zeros)).toBeNull();
    expect(encodeClues(difficultySession.clues)).toBe(difficultyRecord.clues);
  });

  it('drops a finished game: it is history, not something to resume (§12)', () => {
    const solved = withMarks(difficultySession, difficultySession.solution);
    expect(toSession(toPersisted(solved, SAVED_AT))).toBeNull();
    // X marks are notes: the answer's lines alone, crosses or not, are a win too.
    const linesOnly = difficultySession.solution.map((mark) => (mark === LINE ? LINE : UNKNOWN));
    expect(toSession(toPersisted(withMarks(difficultySession, linesOnly), SAVED_AT))).toBeNull();
  });

  it('keeps marks that break a rule: every combination is reachable by tapping (§12)', () => {
    const wrong = [...difficultySession.marks];
    wrong[firstCross(difficultySession)] = LINE;
    wrong[firstLine(difficultySession)] = CROSS;
    const restored = toSession(toPersisted(withMarks(difficultySession, wrong), SAVED_AT));
    expect(restored?.marks).toEqual(wrong);
  });

  it('lands on nothing rather than a fresh board: the loader returns no game', async () => {
    const kv = createMemoryKV({
      [LP_STORAGE_KEYS.game]: '{not json',
      [LP_STORAGE_KEYS.dailyGame]: JSON.stringify({ ...dailyRecord, cluesDigest: 'lp1:00000000' }),
    });
    expect(await loadSavedGames(kv, DAY)).toEqual({ difficulty: null, daily: null });
  });
});

describe('a daily left over from another day (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」)', () => {
  it('is dropped at load, record and all, while the same day still resumes', async () => {
    const stored = () => createMemoryKV({ [dailyGameSchema.key]: JSON.stringify(dailyRecord) });

    const sameDay = stored();
    expect((await loadSavedGames(sameDay, DAY)).daily?.dailyDate).toBe(DAY);
    expect(await sameDay.get(dailyGameSchema.key)).not.toBeNull();

    const nextDay = stored();
    expect((await loadSavedGames(nextDay, '2026-10-18')).daily).toBeNull();
    expect(await nextDay.get(dailyGameSchema.key)).toBeNull();
  });

  it('leaves the free-play slot alone while it drops the old daily', async () => {
    const kv = createMemoryKV({
      [gameSchema.key]: JSON.stringify(difficultyRecord),
      [dailyGameSchema.key]: JSON.stringify(dailyRecord),
    });
    const saved = await loadSavedGames(kv, '2026-10-20');
    expect(saved.daily).toBeNull();
    expect(saved.difficulty?.seed).toBe(difficultySession.seed);
    expect(await kv.get(gameSchema.key)).not.toBeNull();
  });
});
