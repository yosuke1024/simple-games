/**
 * The two saved-run slots and what loading them refuses
 * (docs/ECHO_PADS_RULES.md §8, §9). Tests ④ (a record goes out and comes
 * back as the same run), ⑤ (damaged and impossible records are refused) and
 * ⑩ (only `ep.` keys are touched).
 *
 * Both slots hold the same record shape, so the KEY is what says which mode a
 * record is — and a record that disagrees with its key is corrupt data, not
 * an instruction to change modes (src/test/savedGameSlots.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import {
  beginDailyRun,
  beginLevelRun,
  createDailySession,
  createLevelSession,
  emptyProgress,
  endPlayback,
  play,
  press,
  roundSequence,
  type EchoProgress,
  type EchoSession,
} from '../game';
import {
  agreesWithProgress,
  clearSavedGame,
  loadSavedGames,
  saveGame,
  soleSuspendedMode,
  toPersisted,
  toSession,
} from './gamePersistence';
import { dailyGameSchema, EP_STORAGE_KEYS, gameSchema, type PersistedGame } from './schemas';

const DAY = '2026-10-22';
const NEXT_DAY = '2026-10-23';
const PREVIOUS_DAY = '2026-10-21';

/** Progress after one run was begun at level 1 (attempt 0) and today's daily (attempt 0). */
function begunProgress(): EchoProgress {
  const level = beginLevelRun(emptyProgress(), 1)!;
  return beginDailyRun(level.progress, DAY).progress;
}

/** Heard round 3 once at Normal, then pressed its first pad: input has begun. */
function midInput(session: EchoSession): EchoSession {
  const heard = endPlayback(play(session, 'normal')!)!;
  return press(heard, roundSequence(heard)[0]!)!;
}

const level = midInput(createLevelSession(1, 0)!);
const daily = endPlayback(play(createDailySession(DAY, 0)!, 'quick')!)!;
const levelRecord = toPersisted(level, 1)!;
const dailyRecord = toPersisted(daily, 1)!;

describe('a saved run goes out and comes back (④)', () => {
  it('keeps the round boundary, the input flag and the counts — not the presses', () => {
    const back = toSession(gameSchema.validate(JSON.parse(JSON.stringify(levelRecord))))!;
    expect(back.round).toBe(3);
    expect(back.inputStarted).toBe(true);
    expect(back.inputCount).toBe(0); // decision 8 (B): pressed again from the start
    expect(back.roundPlays).toBe(1);
    expect(back.pacesHeard).toEqual(['normal']);
    expect(back.sequence).toEqual(level.sequence); // from the seed again
    expect(back.status).toBe('awaiting-input');
  });

  it('writes no record for a finished run', () => {
    const failed = press(
      endPlayback(play(createLevelSession(1, 0)!, 'normal')!)!,
      (level.sequence[0]! + 1) % 4,
    )!;
    expect(failed.status).toBe('failed');
    expect(toPersisted(failed, 1)).toBeNull();
  });

  it('drops stray fields and keeps exactly the record', () => {
    const parsed = gameSchema.validate({ ...levelRecord, stray: 'x', inputCount: 2 });
    expect(parsed).toEqual(levelRecord);
  });
});

describe('saved-run slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(levelRecord)?.mode).toBe('level');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
  });

  it('refuses a record written for the other mode', () => {
    expect(gameSchema.validate(dailyRecord)).toBeNull();
    expect(dailyGameSchema.validate(levelRecord)).toBeNull();
  });

  it('refuses a level record that claims a date, and a daily without one', () => {
    expect(gameSchema.validate({ ...levelRecord, dailyDate: DAY })).toBeNull();
    expect(dailyGameSchema.validate({ ...dailyRecord, dailyDate: null })).toBeNull();
  });

  it('keeps the two slots apart in the store, under ep. keys only (⑩)', async () => {
    const kv = createMemoryKV({ 'nr.saveGame': 'another game’s record' });
    await saveGame(level, kv);
    await saveGame(daily, kv);
    const saved = await loadSavedGames(begunProgress(), kv, DAY);
    expect(saved.level?.level).toBe(1);
    expect(saved.daily?.dailyDate).toBe(DAY);
    expect(soleSuspendedMode(saved)).toBeNull();
    expect(soleSuspendedMode({ ...saved, daily: null })).toBe('level');
    expect(soleSuspendedMode({ ...saved, level: null })).toBe('daily');
    expect(soleSuspendedMode({ level: null, daily: null })).toBeNull();
    expect(await kv.get('nr.saveGame')).toBe('another game’s record');
    expect(await kv.get(EP_STORAGE_KEYS.game)).not.toBeNull();
    expect(await kv.get(EP_STORAGE_KEYS.dailyGame)).not.toBeNull();
    await clearSavedGame('level', kv);
    expect(await kv.get(EP_STORAGE_KEYS.game)).toBeNull();
    expect(await kv.get(EP_STORAGE_KEYS.dailyGame)).not.toBeNull();
  });

  it('does not write a finished run over a suspended one', async () => {
    const kv = createMemoryKV();
    await saveGame(level, kv);
    const before = await kv.get(EP_STORAGE_KEYS.game);
    const cleared: EchoSession = { ...level, status: 'cleared' };
    await saveGame(cleared, kv);
    expect(await kv.get(EP_STORAGE_KEYS.game)).toBe(before);
  });
});

describe('records the rules cannot have written (⑤)', () => {
  const broken: [string, Partial<PersistedGame> | Record<string, unknown>][] = [
    ['an unknown schema version', { schemaVersion: 2 }],
    ['a level out of range', { level: 23 }],
    ['a round below 3', { round: 2 }],
    ['a round past the target', { round: 5 }],
    ['a negative attempt', { attempt: -1 }],
    ['a fractional attempt', { attempt: 0.5 }],
    ['input begun before any play', { roundPlays: 0, replays: 0, pacesHeard: [] }],
    ['an unknown pace', { pacesHeard: ['slow'] }],
    ['a repeated pace', { roundPlays: 2, replays: 1, pacesHeard: ['normal', 'normal'] }],
    ['a negative clock', { elapsedSeconds: -1 }],
    ['an infinite clock', { elapsedSeconds: Number.POSITIVE_INFINITY }],
    ['a missing savedAt', { savedAt: undefined }],
    ['a string for a boolean', { inputStarted: 'yes' }],
  ];
  it.each(broken)('refuses %s', (_name, patch) => {
    expect(gameSchema.validate({ ...levelRecord, ...patch })).toBeNull();
  });

  it('refuses text that is not a record at all', () => {
    for (const raw of [null, 3, 'x', [], {}]) expect(gameSchema.validate(raw)).toBeNull();
  });
});

describe('checks against ep.progress (§9)', () => {
  const progress = begunProgress();

  it('accepts an attempt already handed out at an open level', () => {
    expect(agreesWithProgress(level, progress, DAY)).toBe(true);
    expect(agreesWithProgress(daily, progress, DAY)).toBe(true);
  });

  it('refuses an attempt never handed out', () => {
    const later = createLevelSession(1, 1)!;
    expect(agreesWithProgress(later, progress, DAY)).toBe(false);
    expect(agreesWithProgress(createDailySession(DAY, 1)!, progress, DAY)).toBe(false);
  });

  it('refuses a level that is not open', () => {
    const locked = createLevelSession(2, 0)!;
    const handed = { ...progress, nextAttempt: progress.nextAttempt.map(() => 5) };
    expect(agreesWithProgress(locked, handed, DAY)).toBe(false);
  });

  it('reads a damaged or impossible record as an empty slot and leaves it in place', async () => {
    const text = JSON.stringify({ ...levelRecord, round: 99 });
    const kv = createMemoryKV({ [EP_STORAGE_KEYS.game]: text });
    const saved = await loadSavedGames(progress, kv, DAY);
    expect(saved.level).toBeNull();
    expect(await kv.get(EP_STORAGE_KEYS.game)).toBe(text);
  });

  it('reads a run the progress record never started as an empty slot', async () => {
    const kv = createMemoryKV();
    await saveGame(level, kv);
    const saved = await loadSavedGames(emptyProgress(), kv, DAY);
    expect(saved.level).toBeNull();
  });
});

describe('a daily from another day (§7)', () => {
  it.each([
    ['yesterday', NEXT_DAY],
    ['tomorrow, on a clock set back', PREVIOUS_DAY],
  ])('removes %s on load, record and all', async (_name, today) => {
    const kv = createMemoryKV();
    await saveGame(daily, kv);
    await saveGame(level, kv);
    const saved = await loadSavedGames(begunProgress(), kv, today);
    expect(saved.daily).toBeNull();
    expect(await kv.get(EP_STORAGE_KEYS.dailyGame)).toBeNull();
    expect(saved.level?.level).toBe(1);
  });

  it('reads the date before the shape: a stale damaged daily is removed too', async () => {
    const kv = createMemoryKV({
      [EP_STORAGE_KEYS.dailyGame]: JSON.stringify({ ...dailyRecord, round: 'damaged' }),
    });
    const saved = await loadSavedGames(begunProgress(), kv, NEXT_DAY);
    expect(saved.daily).toBeNull();
    expect(await kv.get(EP_STORAGE_KEYS.dailyGame)).toBeNull();
  });

  it('resumes today’s daily before input, with ▶ offered again', async () => {
    const kv = createMemoryKV();
    await saveGame(daily, kv);
    const saved = await loadSavedGames(begunProgress(), kv, DAY);
    expect(saved.daily?.status).toBe('awaiting-input');
    expect(saved.daily?.inputStarted).toBe(false);
    expect(soleSuspendedMode(saved)).toBe('daily');
  });
});
