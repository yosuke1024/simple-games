/**
 * The two saved-game slots and what loading them refuses
 * (docs/TANGRAM_RULES.md §8「2 スロット」).
 *
 * Both slots hold the same record shape, so the KEY is what says which mode a
 * record is — and a record that disagrees with its key is corrupt data, not an
 * instruction to change modes (src/test/savedGameSlots.test.ts).
 *
 * The daily slot holds today's figure or nothing: a record dated any other
 * day — yesterday, or tomorrow on a clock set back — is removed on load, and
 * its date is read before anything else about it (§8: 日付は形の検証より先に見る).
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import {
  createDailySession,
  createSession,
  dailyFigure,
  figureById,
  placePiece,
  type Placement,
  type TangramSession,
} from '../game';
import { addDays } from '../game/test-dates';
import {
  loadSavedGames,
  saveGame,
  soleSuspendedMode,
  toPersisted,
  toSession,
} from './gamePersistence';
import { dailyGameSchema, gameSchema, TN_STORAGE_KEYS } from './schemas';

const SAVED_AT = 1_792_500_000_000;
const DAY = '2026-10-21';
const square = figureById('square')!;
const at0 = (figure: typeof square, id: 'L1' | 'S1'): Placement => ({
  ...figure.solution[id],
  pv: figure.solution[id].at,
});

const free: TangramSession = placePiece(createSession(square), 'L1', at0(square, 'L1'))!;
const daily: TangramSession = placePiece(
  createDailySession(DAY)!,
  'S1',
  at0(dailyFigure(DAY)!, 'S1'),
)!;
const freeRecord = toPersisted(free, SAVED_AT);
const dailyRecord = toPersisted(daily, SAVED_AT);

describe('saved-game slots', () => {
  it('loads each record from its own slot', () => {
    expect(gameSchema.validate(freeRecord)?.mode).toBe('free');
    expect(dailyGameSchema.validate(dailyRecord)?.mode).toBe('daily');
    expect(toSession(gameSchema.validate(freeRecord))?.figure.id).toBe('square');
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

  it('keeps the two slots apart in the store, under tn. keys only', async () => {
    const kv = createMemoryKV({ 'ub.saveGame': 'another game’s record' });
    await saveGame(free, kv);
    await saveGame(daily, kv);
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.free?.figure.id).toBe('square');
    expect(saved.daily?.dailyDate).toBe(DAY);
    expect(soleSuspendedMode(saved)).toBeNull();
    expect(soleSuspendedMode({ ...saved, daily: null })).toBe('free');
    expect(soleSuspendedMode({ ...saved, free: null })).toBe('daily');
    expect(soleSuspendedMode({ free: null, daily: null })).toBeNull();
    // Another game's record is never read, written or removed here.
    expect(await kv.get('ub.saveGame')).toBe('another game’s record');
    expect(await kv.get(TN_STORAGE_KEYS.game)).not.toBeNull();
    expect(await kv.get(TN_STORAGE_KEYS.dailyGame)).not.toBeNull();
  });
});

describe('a daily from another day (§6, §8)', () => {
  it.each([
    ['yesterday', -1],
    ['tomorrow, on a clock set back', 1],
  ])('removes %s on load, record and all', async (_name, delta) => {
    const kv = createMemoryKV();
    await saveGame(daily, kv);
    await saveGame(free, kv);
    const saved = await loadSavedGames(kv, addDays(DAY, delta));
    expect(saved.daily).toBeNull();
    expect(await kv.get(TN_STORAGE_KEYS.dailyGame)).toBeNull();
    // The Free Play slot is not touched.
    expect(saved.free?.figure.id).toBe('square');
  });

  it('reads the date before the shape: a stale daily is removed even when it is damaged', async () => {
    const kv = createMemoryKV({
      [TN_STORAGE_KEYS.dailyGame]: JSON.stringify({ ...dailyRecord, pieces: 'damaged' }),
    });
    const saved = await loadSavedGames(kv, addDays(DAY, 1));
    expect(saved.daily).toBeNull();
    expect(await kv.get(TN_STORAGE_KEYS.dailyGame)).toBeNull();
  });

  it('keeps a damaged record of today in place, read as empty (§8)', async () => {
    const text = JSON.stringify({ ...dailyRecord, pieces: 'damaged' });
    const kv = createMemoryKV({ [TN_STORAGE_KEYS.dailyGame]: text });
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.daily).toBeNull();
    expect(await kv.get(TN_STORAGE_KEYS.dailyGame)).toBe(text);
  });

  it('resumes today’s daily as it was', async () => {
    const kv = createMemoryKV();
    await saveGame(daily, kv);
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.daily?.board).toEqual(daily.board);
    expect(soleSuspendedMode(saved)).toBe('daily');
  });
});
