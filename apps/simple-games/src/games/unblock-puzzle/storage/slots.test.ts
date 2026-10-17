/**
 * The two saved-game slots and what loading them refuses
 * (docs/UNBLOCK_PUZZLE_RULES.md §11, §12).
 *
 * Both slots hold the same record shape, so the KEY is what says which mode a
 * record is — and a record that disagrees with its key is corrupt data, not an
 * instruction to change modes (src/test/savedGameSlots.test.ts).
 *
 * The second half is fail-closed: a record play could not have produced is
 * not resumed — not a board this game deals, a move list that does not
 * replay, a game already won, a daily that is not its date's board, or one
 * left over from another day. The slot then reads as empty, and the player
 * lands on the game's home with nothing started for them.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import {
  canonicalBoard,
  createDailySession,
  createFreeSession,
  decodeBoard,
  doSlide,
  doUndo,
  encodeBoard,
  encodeMoves,
  dailyPuzzle,
  moveCount,
  slideRange,
  solve,
  withElapsedSeconds,
  type Board,
  type UnblockSession,
} from '../game';
import {
  loadSavedGames,
  saveGame,
  soleSuspendedMode,
  toPersisted,
  toSession,
} from './gamePersistence';
import { UB_STORAGE_KEYS, dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

const SAVED_AT = 1_760_000_000_000;
const DAY = '2026-10-17';
const free = createFreeSession('easy', 'unblock-puzzle-easy-slots');
const daily = createDailySession(DAY);
const freeRecord = toPersisted(free, SAVED_AT);
const dailyRecord = toPersisted(daily, SAVED_AT);

/** The shortest way out of a session's dealt board, as slides. */
function solutionOf(session: UnblockSession) {
  const result = solve(session.start, 6000);
  if (result.status !== 'solved') throw new Error('a dealt board must solve');
  return result.solution;
}

/** A session with its first `count` solution moves played. */
function played(session: UnblockSession, count: number): UnblockSession {
  let current = session;
  for (const move of solutionOf(session).slice(0, count)) {
    current = doSlide(current, move.block, move.to)!;
  }
  return current;
}

/** A record as it would come back from storage: through JSON, then the slot's schema. */
const throughStore = (record: unknown, schema = gameSchema) =>
  schema.validate(JSON.parse(JSON.stringify(record)));

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(freeRecord)?.mode).toBe('free');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(toSession(gameSchema.validate(freeRecord))?.seed).toBe('unblock-puzzle-easy-slots');
    expect(toSession(dailyGameSchema.validate(dailyRecord))?.dailyDate).toBe(DAY);
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(freeRecord)).toBeNull();
  });

  it('refuses a Free Play record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...freeRecord, dailyDate: DAY })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
  });

  it('refuses a daily record at any difficulty but medium (§9, §12)', () => {
    expect(dailyGameSchema.validate({ ...dailyRecord, difficulty: 'easy' })).toBeNull();
    expect(dailyGameSchema.validate(dailyRecord)?.difficulty).toBe('medium');
  });

  it('keeps the two slots apart in the store, under ub. keys only', async () => {
    const kv = createMemoryKV({ 'br.saveGame': 'another game’s record' });
    await saveGame(played(free, 1), kv);
    await saveGame(daily, kv);
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.free?.seed).toBe(free.seed);
    expect(saved.daily?.seed).toBe(daily.seed);
    expect(soleSuspendedMode(saved)).toBeNull();
    expect(soleSuspendedMode({ ...saved, daily: null })).toBe('free');
    // Another game's record is never read, written or removed here.
    expect(await kv.get('br.saveGame')).toBe('another game’s record');
    expect(await kv.get(UB_STORAGE_KEYS.game)).not.toBeNull();
    expect(await kv.get(UB_STORAGE_KEYS.dailyGame)).not.toBeNull();
  });
});

describe('a saved game comes back as it was (§11, §12)', () => {
  it('round-trips the dealt board, the moves, the counters and the clock', () => {
    const session = withElapsedSeconds({ ...played(free, 2), hintCount: 3 }, 41);
    const restored = toSession(throughStore(toPersisted(session, SAVED_AT)));
    expect(restored).not.toBeNull();
    expect(encodeBoard(restored!.start)).toBe(encodeBoard(session.start));
    expect(encodeBoard(restored!.board)).toBe(encodeBoard(session.board));
    expect(restored!.moves).toEqual(session.moves);
    expect(moveCount(restored!)).toBe(2);
    expect(restored!.minMoves).toBe(session.minMoves);
    expect(restored!.hintCount).toBe(3);
    expect(restored!.elapsedSeconds).toBe(41);
    expect(restored!.status).toBe('playing');
  });

  it('can still be undone move by move after the restore (§6)', () => {
    const session = played(free, 2);
    const restored = toSession(throughStore(toPersisted(session, SAVED_AT)))!;
    const once = doUndo(restored)!;
    expect(encodeBoard(once.board)).toBe(encodeBoard(played(free, 1).board));
    const twice = doUndo(once)!;
    expect(encodeBoard(twice.board)).toBe(encodeBoard(free.start));
    expect(doUndo(twice)).toBeNull();
  });

  it('writes the record the rules document names, and nothing else', () => {
    expect(Object.keys(freeRecord).sort()).toEqual(
      [
        'board',
        'dailyDate',
        'difficulty',
        'elapsedSeconds',
        'hintCount',
        'minMoves',
        'mode',
        'moves',
        'savedAt',
        'schemaVersion',
        'seed',
      ].sort(),
    );
    expect(freeRecord.board).toHaveLength(36);
    expect(toPersisted(played(free, 3), SAVED_AT).moves).toHaveLength(6);
  });
});

describe('a record play could not have produced is not resumed (§12)', () => {
  const session = played(free, 1);
  const record = toPersisted(session, SAVED_AT);
  const resumes = (value: unknown, schema = gameSchema) => toSession(throughStore(value, schema));

  it('resumes the real thing', () => {
    expect(resumes(record)).not.toBeNull();
  });

  it('drops a record of the wrong shape: types, ranges, versions, missing fields', () => {
    const broken: Record<string, unknown>[] = [
      { ...record, schemaVersion: 2 },
      { ...record, mode: 'level' },
      { ...record, seed: '' },
      { ...record, seed: 7 },
      { ...record, difficulty: 'extreme' },
      { ...record, minMoves: '5' },
      { ...record, minMoves: 0 },
      { ...record, minMoves: 4.5 },
      { ...record, hintCount: -1 },
      { ...record, hintCount: Number.NaN },
      { ...record, elapsedSeconds: 1.5 },
      { ...record, elapsedSeconds: Number.POSITIVE_INFINITY },
      { ...record, savedAt: null },
      { ...record, moves: 42 },
      { ...record, moves: `${record.moves}b` },
      { ...record, board: record.board.slice(1) },
      { ...record, board: null },
      { ...record, dailyDate: 'yesterday' },
    ];
    for (const key of Object.keys(record)) {
      const missing: Record<string, unknown> = { ...record };
      delete missing[key];
      broken.push(missing);
    }
    for (const value of broken) expect(resumes(value), JSON.stringify(value)).toBeNull();
    expect(gameSchema.validate(null)).toBeNull();
    expect(gameSchema.validate([record])).toBeNull();
    expect(gameSchema.validate('{"schemaVersion":1')).toBeNull();
  });

  it('drops a board that breaks §1: a stray letter, an overlap, a block on the target’s row', () => {
    const cells = [...record.board];
    const stray = [...cells];
    stray[cells.indexOf('.')] = '#';
    expect(resumes({ ...record, board: stray.join('') })).toBeNull();
    expect(resumes({ ...record, board: 'a'.repeat(36) })).toBeNull();
    // One more horizontal block on row 3, in canonical order: a board the
    // physics would allow and this game never deals (§1) — on the first of a
    // few dealt boards with two free cells side by side on that row.
    const pairOn = (board: string) =>
      [0, 1, 2, 3, 4].find((c) => board[12 + c] === '.' && board[13 + c] === '.');
    const roomy = Array.from({ length: 20 }, (_, k) =>
      toPersisted(createFreeSession('easy', `unblock-puzzle-easy-slots-row-${k}`), SAVED_AT),
    ).find((candidate) => pairOn(candidate.board) !== undefined);
    expect(roomy).toBeDefined();
    expect(resumes(roomy)).not.toBeNull();
    const start = decodeBoard(roomy!.board)!;
    const extra: Board = {
      blocks: [...start.blocks, { orientation: 'h', length: 2, lane: 2 }],
      positions: [...start.positions, pairOn(roomy!.board)!],
    };
    expect(resumes({ ...roomy, board: encodeBoard(canonicalBoard(extra)) })).toBeNull();
  });

  it('drops a legal board this game would not deal at that difficulty', () => {
    // A real hard board, recorded as an easy one.
    const hard = createFreeSession('hard', 'unblock-puzzle-hard-slots');
    const asEasy = { ...toPersisted(hard, SAVED_AT), difficulty: 'easy', seed: record.seed };
    expect(resumes(asEasy)).toBeNull();
    // The right board with a fewest-moves count it does not have.
    expect(resumes({ ...record, minMoves: record.minMoves + 1 })).toBeNull();
    // A Free Play seed that does not name the difficulty.
    expect(resumes({ ...record, seed: 'unblock-puzzle-hard-slots' })).toBeNull();
  });

  it('drops a board that starts at the exit', () => {
    const solvedStart = played(free, free.minMoves);
    expect(solvedStart.status).toBe('solved');
    const atExit = { ...record, board: encodeBoard(canonicalBoard(solvedStart.board)), moves: '' };
    expect(decodeBoard(atExit.board)).not.toBeNull();
    expect(resumes(atExit)).toBeNull();
  });

  it('drops a move list that does not replay', () => {
    const [first, second] = solutionOf(free);
    // A move the rules refuse: the target one cell past the free ones ahead of it.
    const reach = slideRange(free.start, 0).max;
    expect(reach).toBeLessThan(4);
    expect(resumes({ ...record, moves: `a${reach + 1}` })).toBeNull();
    // A block that does not exist.
    expect(resumes({ ...record, moves: 'z1' })).toBeNull();
    // The same block twice in a row: play merges those into one move (§4).
    const sameTwice = encodeMoves([first!, { block: first!.block, to: first!.to }]);
    expect(resumes({ ...record, moves: sameTwice })).toBeNull();
    // A cut-off list (the schema refuses an odd length outright).
    expect(resumes({ ...record, moves: encodeMoves([first!, second!]).slice(0, 3) })).toBeNull();
  });

  it('drops a game already won: a result is history, not something to resume', () => {
    const won = played(free, free.minMoves);
    expect(won.status).toBe('solved');
    expect(resumes(toPersisted(won, SAVED_AT))).toBeNull();
  });

  it('drops a daily whose seed or board is not its date’s', () => {
    // Another day's seed under this date.
    expect(
      resumes({ ...dailyRecord, seed: 'unblock-puzzle-daily-2026-10-16' }, dailyGameSchema),
    ).toBeNull();
    // Another day's board under this date, consistent in itself.
    const other = dailyPuzzle('2026-10-16');
    expect(
      resumes(
        { ...dailyRecord, board: encodeBoard(other.board), minMoves: other.minMoves },
        dailyGameSchema,
      ),
    ).toBeNull();
    // A date that is not a calendar date.
    expect(
      resumes(
        { ...dailyRecord, dailyDate: '2026-02-30', seed: 'unblock-puzzle-daily-2026-02-30' },
        dailyGameSchema,
      ),
    ).toBeNull();
  });
});

describe('loading the slots (§9, §11)', () => {
  it('reads a truncated or unparsable record as an empty slot, without touching the other', async () => {
    const whole = JSON.stringify(dailyRecord);
    const kv = createMemoryKV({
      [UB_STORAGE_KEYS.game]: JSON.stringify(record()).slice(0, 40),
      [UB_STORAGE_KEYS.dailyGame]: whole,
    });
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.free).toBeNull();
    expect(saved.daily?.dailyDate).toBe(DAY);
  });

  it('drops a daily left over from another day, record and all, while the same day resumes', async () => {
    const stored = () =>
      createMemoryKV({ [UB_STORAGE_KEYS.dailyGame]: JSON.stringify(dailyRecord) });

    const sameDay = stored();
    expect((await loadSavedGames(sameDay, DAY)).daily?.dailyDate).toBe(DAY);
    expect(await sameDay.get(UB_STORAGE_KEYS.dailyGame)).not.toBeNull();

    const nextDay = stored();
    expect((await loadSavedGames(nextDay, '2026-10-18')).daily).toBeNull();
    expect(await nextDay.get(UB_STORAGE_KEYS.dailyGame)).toBeNull();
  });

  it('never throws, whatever the store holds', async () => {
    const values = ['', 'null', '[]', '"text"', '{"schemaVersion":1}', '{', '1e999'];
    for (const value of values) {
      const kv = createMemoryKV({
        [UB_STORAGE_KEYS.game]: value,
        [UB_STORAGE_KEYS.dailyGame]: value,
      });
      await expect(loadSavedGames(kv, DAY)).resolves.toEqual({ free: null, daily: null });
    }
  });
});

function record(): PersistedGame {
  return toPersisted(free, SAVED_AT);
}
