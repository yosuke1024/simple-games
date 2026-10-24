/**
 * The two saved-game slots, end to end (docs/MAKE_THE_TARGET_RULES.md §5,
 * §8, §10): a game written by `saveGame` comes back as the same game — the
 * problem, the board, the whole Undo history and the clock — in its own slot;
 * anything that is not a game in play comes back as nothing; a daily from
 * another day is deleted on load. The replay that decides it is the schema's,
 * and the schema is what Backup & Restore runs, so a backup can neither carry
 * nor bring in a game this one refuses.
 */
import { describe, expect, it } from 'vitest';
import { createBackup } from '@/backup/export';
import { readBackup } from '@/backup/restore';
import { createMemoryKV } from '@/storage/kv';
import { restartSession, revealSolution, SAVED_AT_MAX, undo, withElapsed } from '../game';
import { dailyGame, freeGame, MISS, play, SAVED_AT, SOLVE, storedRecord } from '../ui/test-helpers';
import { clearSavedGame, loadSavedGames, saveGame, toPersisted } from './gamePersistence';
import { TG_STORAGE_KEYS } from './schemas';

const TODAY = '2026-10-21';

describe('saving and resuming (§10)', () => {
  it('gives back both games, each from its own slot, with the whole Undo history (§5)', async () => {
    const kv = createMemoryKV();
    const free = withElapsed(play(freeGame('medium'), 0, '+', 1, 2, '+', 3), 42);
    const daily = withElapsed(play(dailyGame(TODAY), 0, '*', 1), 7);
    await saveGame(free, kv);
    await saveGame(daily, kv);
    expect(JSON.parse((await kv.get(TG_STORAGE_KEYS.game))!).mode).toBe('free');
    expect(JSON.parse((await kv.get(TG_STORAGE_KEYS.dailyGame))!).mode).toBe('daily');

    const saved = await loadSavedGames(kv, TODAY);
    expect(saved.free?.slots).toEqual(free.slots);
    expect(saved.free?.moves).toEqual(free.moves);
    expect(saved.free?.difficulty).toBe('medium');
    expect(saved.free?.elapsedSeconds).toBe(42);
    expect(saved.daily?.slots).toEqual(daily.slots);
    expect(saved.daily?.dailyDate).toBe(TODAY);
    expect(saved.daily?.elapsedSeconds).toBe(7);
    // Undo reaches the numbers as dealt (§5).
    expect(undo(undo(saved.free!)!)?.slots).toEqual([1, 2, 3, 4]);
  });

  it('keeps nothing of the selection: a resumed game starts with nothing chosen (§10)', async () => {
    const kv = createMemoryKV();
    const chosen = play(freeGame(), 0, '+', 1, 2, '+');
    expect(chosen.selectedTile).toBe(2);
    await saveGame(chosen, kv);
    const back = (await loadSavedGames(kv, TODAY)).free!;
    expect(back.selectedTile).toBeNull();
    expect(back.selectedOperator).toBeNull();
    expect(back.moves).toHaveLength(1);
  });

  it('writes whole seconds and a savedAt in range, so what it writes it can always read', async () => {
    const kv = createMemoryKV();
    await saveGame(withElapsed(freeGame(), 12.7), kv);
    expect((await loadSavedGames(kv, TODAY)).free?.elapsedSeconds).toBe(12);
    expect(toPersisted(freeGame(), 1e300)?.savedAt).toBe(SAVED_AT_MAX);
    expect(toPersisted(freeGame(), -5)?.savedAt).toBe(0);
    expect(toPersisted(freeGame(), Number.NaN)?.savedAt).toBe(0);
  });

  it('never writes a finished problem, and clearing leaves the slot empty', async () => {
    const kv = createMemoryKV();
    const solved = play(freeGame(), ...SOLVE);
    expect(solved.status).toBe('solved');
    await saveGame(solved, kv);
    const revealed = revealSolution(play(freeGame(), ...MISS))!;
    expect(revealed.status).toBe('revealed');
    await saveGame(revealed, kv);
    expect(await kv.get(TG_STORAGE_KEYS.game)).toBeNull();

    await saveGame(freeGame(), kv);
    expect((await loadSavedGames(kv, TODAY)).free).not.toBeNull();
    await clearSavedGame('free', kv);
    expect(await kv.get(TG_STORAGE_KEYS.game)).toBeNull();
    expect((await loadSavedGames(kv, TODAY)).free).toBeNull();
  });

  it('writes a retry of a solved problem as one (§9)', async () => {
    const kv = createMemoryKV();
    const retry = restartSession(play(freeGame(), ...SOLVE))!;
    await saveGame(retry, kv);
    expect((await loadSavedGames(kv, TODAY)).free?.repeat).toBe(true);
  });

  it('deletes a daily from any day but today — before or after — and keeps today’s (§8)', async () => {
    for (const day of ['2026-10-20', '2026-10-22']) {
      const kv = createMemoryKV({
        [TG_STORAGE_KEYS.dailyGame]: storedRecord(dailyGame(day)),
        [TG_STORAGE_KEYS.game]: storedRecord(freeGame()),
      });
      const saved = await loadSavedGames(kv, TODAY);
      expect(saved.daily).toBeNull();
      expect(await kv.get(TG_STORAGE_KEYS.dailyGame)).toBeNull();
      // The Free Play slot is not touched.
      expect(saved.free).not.toBeNull();
    }
    const kv = createMemoryKV({ [TG_STORAGE_KEYS.dailyGame]: storedRecord(dailyGame(TODAY)) });
    expect((await loadSavedGames(kv, TODAY)).daily?.dailyDate).toBe(TODAY);
  });

  it('checks the date only on a daily the schema reads: a refused one stays, as any refused record (§10)', async () => {
    const refused = JSON.stringify({
      ...JSON.parse(storedRecord(dailyGame('2026-10-20'))),
      moves: '0+0',
    });
    const kv = createMemoryKV({ [TG_STORAGE_KEYS.dailyGame]: refused });
    expect((await loadSavedGames(kv, TODAY)).daily).toBeNull();
    expect(await kv.get(TG_STORAGE_KEYS.dailyGame)).toBe(refused);
    // Today's daily replaces it.
    await saveGame(dailyGame(TODAY), kv);
    expect((await loadSavedGames(kv, TODAY)).daily?.dailyDate).toBe(TODAY);
  });

  it('reads a damaged slot as nothing, and leaves it for the next save to replace', async () => {
    const raw = '{"schemaVersion":1,"mode":"fr';
    const kv = createMemoryKV({ [TG_STORAGE_KEYS.game]: raw });
    expect((await loadSavedGames(kv, TODAY)).free).toBeNull();
    // Not deleted (§10): the record stays as it was …
    expect(await kv.get(TG_STORAGE_KEYS.game)).toBe(raw);
    // … until a game is saved over it.
    await saveGame(freeGame(), kv);
    expect((await loadSavedGames(kv, TODAY)).free?.moves).toEqual([]);
  });

  it('touches no key but its own', async () => {
    const kv = createMemoryKV({ 'sc.saveGame': 'untouched', 'lp.saveDaily': 'untouched' });
    await saveGame(freeGame(), kv);
    await saveGame(dailyGame(TODAY), kv);
    await clearSavedGame('free', kv);
    await clearSavedGame('daily', kv);
    expect(await kv.get('sc.saveGame')).toBe('untouched');
    expect(await kv.get('lp.saveDaily')).toBe('untouched');
  });
});

describe('Backup & Restore refuses what the game refuses (§10「検証の置き場所」)', () => {
  const good = toPersisted(play(freeGame(), 0, '+', 1), SAVED_AT)!;
  const illegal = { ...good, moves: '0-1' };
  const notASolution = { ...good, solution: '0+12+31+3' };
  const finished = { ...good, moves: '0+12+31*3' };
  const notDealt = { ...good, numbers: [1, 2, 3, 4, 5, 6] };
  const file = (key: string, record: unknown) =>
    JSON.stringify({
      formatVersion: 1,
      createdAt: '2026-10-21T09:00:00.000Z',
      appVersion: '1.0.0',
      platform: 'web',
      data: { [key]: record },
    });

  it('refuses a backup holding a game play could not have produced, whole', async () => {
    expect((await readBackup(file(TG_STORAGE_KEYS.game, good))).ok).toBe(true);
    for (const record of [illegal, notASolution, finished, notDealt]) {
      expect(await readBackup(file(TG_STORAGE_KEYS.game, record))).toEqual({
        ok: false,
        problem: 'damaged',
      });
    }
    // A Free Play record under the daily's key is damage too.
    expect(await readBackup(file(TG_STORAGE_KEYS.dailyGame, good))).toEqual({
      ok: false,
      problem: 'damaged',
    });
  });

  it('leaves one lying on the device out of the next backup', async () => {
    const kv = createMemoryKV({
      [TG_STORAGE_KEYS.game]: JSON.stringify(illegal),
      [TG_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, difficulty: 'hard' }),
    });
    const backup = await createBackup({ appVersion: '1.0.0', platform: 'web' }, kv);
    expect(Object.keys(backup.data)).toEqual([TG_STORAGE_KEYS.prefs]);
  });
});
