/**
 * The two saved-game slots (docs/PIPE_LINK_RULES.md §7). Both hold the same
 * record shape, so the KEY is what says which mode a record is — and a record
 * that disagrees with its key is corrupt data, not an instruction to change
 * modes.
 *
 * The second half is the fail-closed half: a record play could not have
 * produced is dropped rather than resumed, and nothing takes its place — the
 * player lands on the game's home. The schema's one check is everything
 * (§7): it reads the record through `fromRecord`, so a record it lets in is
 * one the game resumes, and Backup & Restore — which runs it — refuses what
 * the game would.
 */
import { describe, expect, it } from 'vitest';
import { createBackup } from '@/backup/export';
import { readBackup } from '@/backup/restore';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord } from '@/storage/repo';
import {
  createDailySession,
  createDifficultySession,
  turnTile,
  type PipeLinkSession,
} from '../game';
import {
  loadSavedGames,
  saveGame,
  soleSuspendedMode,
  toPersisted,
  toSession,
} from './gamePersistence';
import { PN_STORAGE_KEYS, dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

const SAVED_AT = 1_790_000_000_000;
const DAY = '2026-10-22';
const difficultySession = createDifficultySession('easy', 'pipe-link-easy-slots');
const difficultyRecord = toPersisted(difficultySession, SAVED_AT);
const dailySession = createDailySession(DAY);
const dailyRecord = toPersisted(dailySession, SAVED_AT);

/** Replaces one character of a string. */
const withCharacter = (text: string, index: number, character: string): string =>
  text.slice(0, index) + character + text.slice(index + 1);

/** The first cell whose tile is a straight, an end, … in the record. */
const firstOf = (record: PersistedGame, letter: string) => record.types.indexOf(letter);

/** Turns every tile to the answer, clockwise taps only, the way a player could. */
function solved(session: PipeLinkSession): PipeLinkSession {
  let current = session;
  for (let cell = 0; cell < session.solution.length; cell++) {
    while (current.status === 'playing' && current.current[cell] !== session.solution[cell]) {
      current = turnTile(current, cell, 'cw')!;
    }
  }
  return current;
}

describe('saved-game slots', () => {
  it('loads each record from its own slot, and round-trips the game in it', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    const played = turnTile(difficultySession, 3, 'cw')!;
    const restored = toSession(gameSchema.validate(toPersisted(played, SAVED_AT)));
    expect(restored?.seed).toBe('pipe-link-easy-slots');
    expect(restored?.board).toEqual(played.board);
    expect(restored?.solution).toEqual([...played.solution]);
    expect(restored?.initial).toEqual([...played.initial]);
    expect(restored?.current).toEqual([...played.current]);
    // The undo history is not saved (§6): a resumed board starts with none.
    expect(played.history).toHaveLength(1);
    expect(restored?.history).toEqual([]);
  });

  it('round-trips the daily too, with its date', () => {
    const restored = toSession(dailyGameSchema.validate(dailyRecord));
    expect(restored?.dailyDate).toBe(DAY);
    expect(restored?.difficulty).toBe('medium');
    expect(restored?.current).toEqual([...dailySession.current]);
  });

  it('keeps the counters a record carries', () => {
    const record = { ...difficultyRecord, hintCount: 3, elapsedSeconds: 125 };
    const restored = toSession(gameSchema.validate(record));
    expect(restored?.hintCount).toBe(3);
    expect(restored?.elapsedSeconds).toBe(125);
  });

  it('carries nothing a record holds beyond its fields', () => {
    const parsed = gameSchema.validate({ ...difficultyRecord, history: [{ cell: 0 }], extra: 1 });
    expect(parsed).toEqual(difficultyRecord);
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a difficulty record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...difficultyRecord, dailyDate: DAY })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: '22/10/2026' })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: '2026-02-30' })).toBeNull();
  });

  it('refuses a daily record at any difficulty but medium (§8)', () => {
    const easyDaily = { ...difficultyRecord, mode: 'daily' as const, dailyDate: DAY };
    expect(dailyGameSchema.validate(easyDaily)).toBeNull();
    expect(dailyGameSchema.validate(dailyRecord)?.difficulty).toBe('medium');
  });

  it('answers a shortcut only when exactly one game is suspended (issue #113)', () => {
    expect(soleSuspendedMode({ difficulty: difficultySession, daily: null })).toBe('difficulty');
    expect(soleSuspendedMode({ difficulty: null, daily: dailySession })).toBe('daily');
    expect(soleSuspendedMode({ difficulty: difficultySession, daily: dailySession })).toBeNull();
    expect(soleSuspendedMode({ difficulty: null, daily: null })).toBeNull();
  });
});

describe('a record play could not have produced (§7)', () => {
  const load = async (raw: string) =>
    loadSavedGames(createMemoryKV({ [PN_STORAGE_KEYS.game]: raw }), DAY);

  it('drops truncated JSON and plain nonsense without a word, and starts nothing', async () => {
    const json = JSON.stringify(difficultyRecord);
    expect((await load(json.slice(0, json.length / 2))).difficulty).toBeNull();
    expect((await load('not json at all')).difficulty).toBeNull();
    expect((await load('null')).difficulty).toBeNull();
    expect((await load('[]')).difficulty).toBeNull();
    // The well-formed record next to them loads, so the drops above are drops.
    expect((await load(json)).difficulty?.seed).toBe('pipe-link-easy-slots');
  });

  it('drops fields of the wrong type or out of range', () => {
    const wrong: Partial<Record<keyof PersistedGame, unknown>>[] = [
      { schemaVersion: 2 },
      { mode: 'endless' },
      { seed: '' },
      { seed: 7 },
      { seed: 'x'.repeat(201) },
      { difficulty: 'expert' },
      { width: '5' },
      { height: 5.5 },
      { hintCount: -1 },
      { hintCount: 1.5 },
      { elapsedSeconds: 1e10 },
      { elapsedSeconds: '12' },
      { savedAt: null },
      { types: 42 },
      { solution: null },
      { current: ['0'] },
      { source: '12' },
      { source: 2.5 },
    ];
    for (const patch of wrong) {
      expect(gameSchema.validate({ ...difficultyRecord, ...patch }), JSON.stringify(patch)).toBe(
        null,
      );
    }
  });

  it('drops a board whose size is not its difficulty’s', () => {
    expect(gameSchema.validate({ ...difficultyRecord, width: 7 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard' })).toBeNull();
  });

  it('drops types of the wrong length, or letters it never writes — a cross included', () => {
    const { types } = difficultyRecord;
    expect(gameSchema.validate({ ...difficultyRecord, types: types.slice(1) })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, types: `${types}e` })).toBeNull();
    for (const letter of ['x', '+', 'E', '4']) {
      expect(
        gameSchema.validate({ ...difficultyRecord, types: withCharacter(types, 0, letter) }),
        letter,
      ).toBeNull();
    }
  });

  it('drops an orientation outside its tile’s period: a straight has two', () => {
    const straight = firstOf(difficultyRecord, 's');
    expect(straight).toBeGreaterThanOrEqual(0);
    for (const field of ['solution', 'initial', 'current'] as const) {
      expect(
        gameSchema.validate({
          ...difficultyRecord,
          [field]: withCharacter(difficultyRecord[field], straight, '2'),
        }),
        field,
      ).toBeNull();
    }
    expect(
      gameSchema.validate({
        ...difficultyRecord,
        current: withCharacter(difficultyRecord.current, 0, '4'),
      }),
    ).toBeNull();
  });

  it('drops a source off the board', () => {
    expect(gameSchema.validate({ ...difficultyRecord, source: 25 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, source: -1 })).toBeNull();
  });

  it('drops an answer that does not light the board, and types that are not the answer’s', () => {
    const { solution, types } = difficultyRecord;
    // One end turned away from its partner: the answer no longer wins (§2).
    const end = firstOf(difficultyRecord, 'e');
    const turned = String((Number(solution[end]) + 1) % 4);
    const broken = { ...difficultyRecord, solution: withCharacter(solution, end, turned) };
    expect(gameSchema.validate(broken)).toBeNull();
    expect(toSession(broken)).toBeNull();
    // An end swapped for a tee: the answer's pipes no longer meet.
    const swapped = { ...difficultyRecord, types: withCharacter(types, end, 't') };
    expect(gameSchema.validate(swapped)).toBeNull();
  });

  it('drops a finished game: a solved board is history, not a game to resume', async () => {
    const done = solved(difficultySession);
    expect(done.status).toBe('solved');
    const record = toPersisted(done, SAVED_AT);
    expect(gameSchema.validate(record)).toBeNull();
    expect(toSession(record)).toBeNull();
    expect((await load(JSON.stringify(record))).difficulty).toBeNull();
  });

  it('keeps a starting position the generator would not deal — scramble rules are not checked on load (§7)', () => {
    // Every tile but one already on its answer: well over the 60% rule.
    const near = difficultyRecord.solution.split('');
    const end = firstOf(difficultyRecord, 'e');
    near[end] = String((Number(near[end]) + 1) % 4);
    const record = { ...difficultyRecord, initial: near.join(''), current: near.join('') };
    expect(toSession(gameSchema.validate(record))?.current.join('')).toBe(near.join(''));
  });

  it('reads a corrupt slot as empty, and the other slot as it was', async () => {
    const kv = createMemoryKV({
      [PN_STORAGE_KEYS.game]: '{"schemaVersion":1,"mode":"difficulty"',
      [PN_STORAGE_KEYS.dailyGame]: JSON.stringify(dailyRecord),
    });
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.difficulty).toBeNull();
    expect(saved.daily?.dailyDate).toBe(DAY);
    expect(await loadRecord(gameSchema, kv)).toBeNull();
  });

  it('leaves a refused record on disk until the slot’s next write replaces it', async () => {
    const raw = JSON.stringify({ ...difficultyRecord, source: 99 });
    const kv = createMemoryKV({ [PN_STORAGE_KEYS.game]: raw });
    expect((await loadSavedGames(kv, DAY)).difficulty).toBeNull();
    expect(await kv.get(PN_STORAGE_KEYS.game)).toBe(raw);
    await saveGame(difficultySession, kv);
    expect((await loadSavedGames(kv, DAY)).difficulty?.seed).toBe('pipe-link-easy-slots');
  });
});

describe('a daily from any other day (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」)', () => {
  const stored = () => createMemoryKV({ [dailyGameSchema.key]: JSON.stringify(dailyRecord) });

  it('resumes on its own day, record kept', async () => {
    const sameDay = stored();
    expect((await loadSavedGames(sameDay, DAY)).daily?.dailyDate).toBe(DAY);
    expect(await sameDay.get(dailyGameSchema.key)).not.toBeNull();
  });

  it('is dropped at load once the day has passed, record and all', async () => {
    const nextDay = stored();
    expect((await loadSavedGames(nextDay, '2026-10-23')).daily).toBeNull();
    expect(await nextDay.get(dailyGameSchema.key)).toBeNull();
  });

  it('is dropped when it is dated ahead of today, too (§7)', async () => {
    const dayBefore = stored();
    expect((await loadSavedGames(dayBefore, '2026-10-21')).daily).toBeNull();
    expect(await dayBefore.get(dailyGameSchema.key)).toBeNull();
  });

  it('leaves the difficulty slot alone when it drops the daily', async () => {
    const kv = createMemoryKV({
      [gameSchema.key]: JSON.stringify(difficultyRecord),
      [dailyGameSchema.key]: JSON.stringify(dailyRecord),
    });
    const saved = await loadSavedGames(kv, '2026-10-30');
    expect(saved.daily).toBeNull();
    expect(saved.difficulty?.seed).toBe('pipe-link-easy-slots');
    expect(await kv.get(gameSchema.key)).not.toBeNull();
  });
});

describe('Backup & Restore refuses what the game refuses (§7)', () => {
  const file = (record: unknown) =>
    JSON.stringify({
      formatVersion: 1,
      createdAt: '2026-10-22T09:00:00.000Z',
      appVersion: '1.0.0',
      platform: 'web',
      data: { [PN_STORAGE_KEYS.game]: record },
    });
  const end = firstOf(difficultyRecord, 'e');
  const impossible: [string, PersistedGame][] = [
    [
      'an answer that does not light the board',
      {
        ...difficultyRecord,
        solution: withCharacter(
          difficultyRecord.solution,
          end,
          String((Number(difficultyRecord.solution[end]) + 1) % 4),
        ),
      },
    ],
    ['a source off the board', { ...difficultyRecord, source: 30 }],
    ['a finished game', toPersisted(solved(difficultySession), SAVED_AT)],
  ];

  it('refuses a backup holding a board play could not have produced, whole', async () => {
    expect((await readBackup(file(difficultyRecord))).ok).toBe(true);
    for (const [what, record] of impossible) {
      expect(await readBackup(file(record)), what).toEqual({ ok: false, problem: 'damaged' });
    }
  });

  it('leaves one lying on the device out of the next backup', async () => {
    const [, record] = impossible[0]!;
    const kv = createMemoryKV({
      [PN_STORAGE_KEYS.game]: JSON.stringify(record),
      [PN_STORAGE_KEYS.dailyGame]: JSON.stringify(dailyRecord),
    });
    const backup = await createBackup({ appVersion: '1.0.0', platform: 'web' }, kv);
    expect(Object.keys(backup.data)).toEqual([PN_STORAGE_KEYS.dailyGame]);
  });
});
