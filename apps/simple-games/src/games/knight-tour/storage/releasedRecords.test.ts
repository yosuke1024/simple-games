/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. It was served on
 * 127.0.0.1 by a Playwright harness (Chromium, 390x780, en-US) with every
 * non-localhost request aborted; game assets unchanged.
 * UI steps: finish the tutorial (Start Playing begins a 5 x 5 tour); click the squares of a
 * complete tour (a script planned the route from the start square it read off the board, one
 * click per square) to win; press Undo on the result card (back to play with resultRecorded:true
 * and 24 squares) and click the last square again; Home; start "6 x 6", make nine moves, Home;
 * tap "8 x 8" and confirm Start over the suspended 6 x 6; make twelve moves (one of them
 * undone and replayed), return Home so the suspended tour is saved.
 * Captured: all four keys (kt.flags, kt.prefs, kt.stats, kt.saveGame) as they stood at the
 * end. SAVED_AFTER_UNDO and SAVED_SIX are kt.saveGame as read right after the Undo on the won
 * 5 x 5 and right after the 6 x 6 was suspended, from the same run, before later play
 * replaced them.
 * Not captured: a loss. This build has no losing end state (a session is only "playing" or
 * "won"), so `losses` is 0 on every board and no record with a loss exists to freeze.
 * No storage writes, clock mocking, or game-internal calls created these records: the
 * harness only clicked squares and buttons (a script read positions from the DOM to decide
 * where). Only the Web Preferences key prefix `CapacitorStorage.` is removed
 * below; payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { legalMoves } from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'kt.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'kt.prefs': '{"schemaVersion":1,"mode":8}',
  'kt.stats':
    '{"5":{"played":1,"wins":1,"losses":0},"6":{"played":1,"wins":0,"losses":0},"8":{"played":1,' +
    '"wins":0,"losses":0},"schemaVersion":1,"totalPlaySeconds":30}',
  'kt.saveGame':
    '{"schemaVersion":1,"seed":1028989518,"mode":8,"path":[46,63,53,47,62,52,58,48,33,16,1,11,5],' +
    '"status":"playing","elapsedSeconds":12,"resultRecorded":false}',
};

const SAVED_AFTER_UNDO =
  '{"schemaVersion":1,"seed":3333531381,"mode":5,"path":[12,1,8,19,22,15,6,3,14,23,16,5,2,9,18,' +
  '21,10,7,0,11,20,17,24,13],"status":"playing","elapsedSeconds":9,"resultRecorded":true}';

const SAVED_SIX =
  '{"schemaVersion":1,"seed":4171079125,"mode":6,"path":[21,29,33,25,12,1,9,5,16,3],' +
  '"status":"playing","elapsedSeconds":9,"resultRecorded":false}';

describe('records written by the published Knight’s Tour build', () => {
  it('loads every captured record without replacing it with a default', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['kt.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['kt.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['kt.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['kt.saveGame']));
    for (const raw of [SAVED_AFTER_UNDO, SAVED_SIX]) {
      const kv2 = createMemoryKV({ 'kt.saveGame': raw });
      expect(await loadRecord(gameSchema, kv2)).toEqual(JSON.parse(raw));
    }
  });

  it('reads the flag, the remembered mode and every statistic the player earned', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).mode).toBe(8);
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.totalPlaySeconds).toBe(30);
    expect(stats[5]).toEqual({ played: 1, wins: 1, losses: 0 });
    expect(stats[6]).toEqual({ played: 1, wins: 0, losses: 0 });
    expect(stats[8]).toEqual({ played: 1, wins: 0, losses: 0 });
  });

  it('restores the suspended 8 x 8 tour square by square', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    // Restoring replays the path from the first square of the route the seed picks, so a
    // non-null result proves today's tour tables and transforms still start where it started.
    expect(session).not.toBeNull();
    expect(session!.mode).toBe(8);
    expect(session!.seed).toBe(1028989518);
    expect(session!.path).toEqual([46, 63, 53, 47, 62, 52, 58, 48, 33, 16, 1, 11, 5]);
    expect(session!.status).toBe('playing');
    expect(session!.elapsedSeconds).toBe(12);
    expect(session!.resultRecorded).toBe(false);
    expect(legalMoves(session!).length).toBeGreaterThan(0);
  });

  it('restores a won tour that was undone, one square from the end', async () => {
    const session = await loadSavedGame(createMemoryKV({ 'kt.saveGame': SAVED_AFTER_UNDO }));
    expect(session).not.toBeNull();
    expect(session!.mode).toBe(5);
    expect(session!.seed).toBe(3333531381);
    expect(session!.path).toHaveLength(24);
    expect(session!.path.slice(0, 3)).toEqual([12, 1, 8]);
    expect(session!.status).toBe('playing');
    expect(session!.resultRecorded).toBe(true);
    expect(session!.elapsedSeconds).toBe(9);
    // The one unvisited square is the one the player clicked to finish.
    expect(legalMoves(session!)).toEqual([4]);
  });

  it('restores the suspended 6 x 6 tour', async () => {
    const session = await loadSavedGame(createMemoryKV({ 'kt.saveGame': SAVED_SIX }));
    expect(session).not.toBeNull();
    expect(session!.mode).toBe(6);
    expect(session!.seed).toBe(4171079125);
    expect(session!.path).toEqual([21, 29, 33, 25, 12, 1, 9, 5, 16, 3]);
    expect(session!.elapsedSeconds).toBe(9);
    expect(session!.resultRecorded).toBe(false);
  });

  it('writes each restored tour back byte for byte', async () => {
    // This game keeps no save time: the stored text is the session itself.
    for (const raw of [RELEASED['kt.saveGame'], SAVED_AFTER_UNDO, SAVED_SIX]) {
      const session = await loadSavedGame(createMemoryKV({ 'kt.saveGame': raw }));
      expect(session).not.toBeNull();
      const out = createMemoryKV();
      await saveGame(session!, out);
      expect(await out.get('kt.saveGame')).toBe(raw);
    }
  });
});
