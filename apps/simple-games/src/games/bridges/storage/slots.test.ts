/**
 * The two saved-game slots (docs/BRIDGES_RULES.md §10). Both hold the same
 * record shape, so the KEY is what says which mode a record is — and a record
 * that disagrees with its key is corrupt data, not an instruction to change
 * modes.
 *
 * The second half is the fail-closed half: a record play could not have
 * produced is dropped rather than resumed, and nothing takes its place — the
 * player lands on the game's home. The schema validator checks shape (it also
 * runs for backups); `toSession` — `fromRecord` — checks meaning, including
 * the bounded re-proof that the answer is the board's only one.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord } from '@/storage/repo';
import {
  createDailySession,
  createDifficultySession,
  doConnect,
  doCycle,
  encodeBridges,
  factsOf,
  type BridgesSession,
} from '../game';
import { loadSavedGames, soleSuspendedMode, toPersisted, toSession } from './gamePersistence';
import { BG_STORAGE_KEYS, dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

const SAVED_AT = 1_790_000_000_000;
const DAY = '2026-10-17';
const difficultySession = createDifficultySession('easy', 'bridges-easy-slots');
const difficultyRecord = toPersisted(difficultySession, SAVED_AT);
const dailySession = createDailySession(DAY);
const dailyRecord = toPersisted(dailySession, SAVED_AT);

/** Replaces one character of a string. */
const withCharacter = (text: string, index: number, character: string): string =>
  text.slice(0, index) + character + text.slice(index + 1);

/** Builds the whole answer, the way a player's taps would. */
function solved(session: BridgesSession): BridgesSession {
  let current = session;
  session.solution.forEach((count, edge) => {
    for (let tap = 0; tap < count; tap++) current = doCycle(current, edge) ?? current;
  });
  return current;
}

/** The first edge of the answer with a bridge on it, and its two islands. */
const firstAnswerEdge = (session: BridgesSession) => {
  const edge = session.solution.findIndex((count) => count > 0);
  return { edge, ...session.graph.edges[edge]! };
};

/** Two crossing edges, both built: a board the rules cannot hold (§2). */
function crossingDigits(session: BridgesSession): string | null {
  const { crossings } = session.graph;
  const edge = crossings.findIndex((list) => list.length > 0);
  if (edge === -1) return null;
  const digits = new Array<number>(session.graph.edges.length).fill(0);
  digits[edge] = 1;
  digits[crossings[edge]![0]!] = 1;
  return encodeBridges(digits);
}

describe('saved-game slots', () => {
  it('loads each record from its own slot, and round-trips the game in it', () => {
    expect(gameSchema.validate(difficultyRecord)?.mode).toBe('difficulty');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    const { a, b } = firstAnswerEdge(difficultySession);
    const played = doConnect(difficultySession, a, b)!;
    const restored = toSession(gameSchema.validate(toPersisted(played, SAVED_AT)));
    expect(restored?.seed).toBe('bridges-easy-slots');
    expect(restored?.islands).toEqual(played.islands);
    expect(restored?.solution).toEqual([...played.solution]);
    expect(restored?.bridges).toEqual([...played.bridges]);
    // The undo history is not saved (§9): a resumed board starts with none.
    expect(restored?.history).toEqual([]);
  });

  it('keeps the counters a record carries', () => {
    const record = { ...difficultyRecord, hintCount: 3, elapsedSeconds: 125 };
    const restored = toSession(gameSchema.validate(record));
    expect(restored?.hintCount).toBe(3);
    expect(restored?.elapsedSeconds).toBe(125);
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(difficultyRecord)).toBeNull();
  });

  it('refuses a difficulty record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...difficultyRecord, dailyDate: DAY })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: '17/10/2026' })).toBeNull();
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

describe('a record play could not have produced (§10)', () => {
  const load = async (raw: string) =>
    loadSavedGames(createMemoryKV({ [BG_STORAGE_KEYS.game]: raw }), DAY);

  it('drops truncated JSON and plain nonsense without a word, and starts nothing', async () => {
    const json = JSON.stringify(difficultyRecord);
    expect((await load(json.slice(0, json.length / 2))).difficulty).toBeNull();
    expect((await load('not json at all')).difficulty).toBeNull();
    expect((await load('null')).difficulty).toBeNull();
    expect((await load('[]')).difficulty).toBeNull();
    // The well-formed record next to them loads, so the drops above are drops.
    expect((await load(json)).difficulty?.seed).toBe('bridges-easy-slots');
  });

  it('drops fields of the wrong type or out of range', () => {
    const wrong: Partial<Record<keyof PersistedGame, unknown>>[] = [
      { schemaVersion: 2 },
      { mode: 'endless' },
      { seed: '' },
      { seed: 7 },
      { seed: 'x'.repeat(201) },
      { difficulty: 'expert' },
      { width: '7' },
      { height: 7.5 },
      { hintCount: -1 },
      { hintCount: 1.5 },
      { elapsedSeconds: 1e10 },
      { elapsedSeconds: '12' },
      { savedAt: null },
      { board: 42 },
      { solution: null },
      { bridges: ['0'] },
    ];
    for (const patch of wrong) {
      expect(gameSchema.validate({ ...difficultyRecord, ...patch }), JSON.stringify(patch)).toBe(
        null,
      );
    }
  });

  it('drops a board whose size is not its difficulty’s', () => {
    expect(gameSchema.validate({ ...difficultyRecord, width: 9 })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, difficulty: 'hard' })).toBeNull();
  });

  it('drops a board of the wrong length, or with characters it never writes', () => {
    const { board } = difficultyRecord;
    expect(gameSchema.validate({ ...difficultyRecord, board: board.slice(1) })).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, board: `${board}.` })).toBeNull();
    const water = board.indexOf('.');
    expect(
      gameSchema.validate({ ...difficultyRecord, board: withCharacter(board, water, '9') }),
    ).toBeNull();
    expect(
      gameSchema.validate({ ...difficultyRecord, board: withCharacter(board, water, '0') }),
    ).toBeNull();
    expect(
      gameSchema.validate({ ...difficultyRecord, board: withCharacter(board, water, 'x') }),
    ).toBeNull();
  });

  it('drops digit strings with a digit past two, or of lengths that disagree', () => {
    const { solution, bridges } = difficultyRecord;
    expect(
      gameSchema.validate({ ...difficultyRecord, bridges: withCharacter(bridges, 0, '3') }),
    ).toBeNull();
    expect(gameSchema.validate({ ...difficultyRecord, solution: `${solution}0` })).toBeNull();
    // Same length as each other, but not the board's edge count: shape passes,
    // meaning does not.
    const longer = { ...difficultyRecord, solution: `${solution}0`, bridges: `${bridges}0` };
    expect(gameSchema.validate(longer)).not.toBeNull();
    expect(toSession(gameSchema.validate(longer))).toBeNull();
  });

  it('drops an impossible board: islands side by side, or a number nothing could carry', () => {
    const { board, width } = difficultyRecord;
    const island = board.search(/[1-8]/);
    // An island beside the first one (either side that is on the board).
    const beside = island % width === width - 1 ? island - 1 : island + 1;
    const crowded = withCharacter(board, beside, '1');
    expect(toSession({ ...difficultyRecord, board: crowded })).toBeNull();
    // The first island asks for eight bridges: it cannot see four partners.
    const greedy = withCharacter(board, island, '8');
    expect(toSession({ ...difficultyRecord, board: greedy })).toBeNull();
  });

  it('drops an answer that does not win on its board', () => {
    const { solution } = difficultyRecord;
    const edge = solution.search(/[12]/);
    const broken = withCharacter(solution, edge, solution[edge] === '1' ? '2' : '1');
    expect(toSession({ ...difficultyRecord, solution: broken })).toBeNull();
  });

  it('drops bridges the board cannot hold: two crossing bridges', () => {
    // A board with a crossing in it; the slot test does not care which.
    let session = difficultySession;
    for (let n = 0; crossingDigits(session) === null && n < 50; n++) {
      session = createDifficultySession('medium', `bridges-medium-slots-${n}`);
    }
    const digits = crossingDigits(session);
    expect(digits).not.toBeNull();
    const record = toPersisted(session, SAVED_AT);
    expect(toSession({ ...record, bridges: digits! })).toBeNull();
  });

  it('keeps a board with an island over its number — play makes those (§4)', () => {
    // A 1 given two bridges: legal to build, past its number.
    const one = difficultySession.islands.findIndex(
      (island, ordinal) =>
        island.value === 1 && difficultySession.graph.islandEdges[ordinal]!.length > 0,
    );
    const edge = difficultySession.graph.islandEdges[one]![0]!;
    const over = doCycle(doCycle(difficultySession, edge)!, edge)!;
    expect(factsOf(over).states[one]).toBe('over');
    const restored = toSession(gameSchema.validate(toPersisted(over, SAVED_AT)));
    expect(restored?.bridges[edge]).toBe(2);
    expect(restored && factsOf(restored).states[one]).toBe('over');
  });

  it('drops a finished game: a solved board is history, not a game to resume', async () => {
    const done = solved(difficultySession);
    expect(done.status).toBe('solved');
    const record = toPersisted(done, SAVED_AT);
    expect(gameSchema.validate(record)).not.toBeNull();
    expect(toSession(gameSchema.validate(record))).toBeNull();
    expect((await load(JSON.stringify(record))).difficulty).toBeNull();
  });

  it('reads a corrupt slot as empty, and the other slot as it was', async () => {
    const kv = createMemoryKV({
      [BG_STORAGE_KEYS.game]: '{"schemaVersion":1,"mode":"difficulty"',
      [BG_STORAGE_KEYS.dailyGame]: JSON.stringify(dailyRecord),
    });
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.difficulty).toBeNull();
    expect(saved.daily?.dailyDate).toBe(DAY);
    // The schema alone already says so, record by record.
    expect(await loadRecord(gameSchema, kv)).toBeNull();
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
    expect((await loadSavedGames(nextDay, '2026-10-18')).daily).toBeNull();
    expect(await nextDay.get(dailyGameSchema.key)).toBeNull();
  });

  it('is dropped when it is dated ahead of today, too (§8)', async () => {
    const dayBefore = stored();
    expect((await loadSavedGames(dayBefore, '2026-10-16')).daily).toBeNull();
    expect(await dayBefore.get(dailyGameSchema.key)).toBeNull();
  });

  it('leaves the difficulty slot alone when it drops the daily', async () => {
    const kv = createMemoryKV({
      [gameSchema.key]: JSON.stringify(difficultyRecord),
      [dailyGameSchema.key]: JSON.stringify(dailyRecord),
    });
    const saved = await loadSavedGames(kv, '2026-10-20');
    expect(saved.daily).toBeNull();
    expect(saved.difficulty?.seed).toBe('bridges-easy-slots');
    expect(await kv.get(gameSchema.key)).not.toBeNull();
  });
});
