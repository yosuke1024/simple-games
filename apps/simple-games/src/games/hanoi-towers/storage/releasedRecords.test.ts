/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. It was served on
 * 127.0.0.1 by a Playwright harness (Chromium, 390x780, en-US) with every
 * non-localhost request aborted; game assets unchanged.
 * UI steps: finish the tutorial (Start Playing begins a 3-disk board); solve it in the
 * minimum 7 moves by tapping peg then peg; press Undo on the result card (the board goes back
 * to play with cleared:true) and finish it again; Home; start "Disks: 4", make four moves,
 * return Home so the suspended board is saved.
 * Captured: all four keys (hn.flags, hn.prefs, hn.stats, hn.saveGame) as they stood at the
 * end. SAVED_AFTER_UNDO is hn.saveGame as read right after the Undo on the solved board
 * (cleared:true), from the same run, before the later moves replaced it.
 * Not captured: nothing declared is missing. The 5-disk board was never played, so its row
 * in hn.stats is the untouched zero row.
 * No storage writes, clock mocking, or game-internal calls created these records: the
 * harness only clicked, pressed keys and moved the pointer (a script read positions from the
 * DOM to decide where). Only the Web Preferences key prefix `CapacitorStorage.` is removed
 * below; payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { isSolved } from '../game';
import { loadSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema, toPersisted } from './schemas';

const RELEASED = {
  'hn.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'hn.prefs': '{"schemaVersion":1,"size":4}',
  'hn.stats':
    '{"schemaVersion":1,"totalPlaySeconds":15,"boards":{"3":{"played":1,"completed":1,"best":7},' +
    '"4":{"played":1,"completed":0,"best":null},"5":{"played":0,"completed":0,"best":null}}}',
  'hn.saveGame':
    '{"schemaVersion":1,"size":4,"seed":3217065499,"history":[1,2,5,1],"elapsedSeconds":7,' +
    '"cleared":false,"savedAt":1793268381156}',
};

const SAVED_AFTER_UNDO =
  '{"schemaVersion":1,"size":3,"seed":1236274815,"history":[2,1,7,2,3,5],"elapsedSeconds":8,' +
  '"cleared":true,"savedAt":1793268370407}';

describe('records written by the published Hanoi Towers build', () => {
  it('loads every captured record without replacing it with a default', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['hn.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['hn.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['hn.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['hn.saveGame']));
    const undone = createMemoryKV({ 'hn.saveGame': SAVED_AFTER_UNDO });
    expect(await loadRecord(gameSchema, undone)).toEqual(JSON.parse(SAVED_AFTER_UNDO));
  });

  it('reads the flag, the remembered board and every statistic the player earned', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).size).toBe(4);
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.totalPlaySeconds).toBe(15);
    expect(stats.boards[3]).toEqual({ played: 1, completed: 1, best: 7 });
    expect(stats.boards[4]).toEqual({ played: 1, completed: 0, best: null });
    expect(stats.boards[5]).toEqual({ played: 0, completed: 0, best: null });
  });

  it('restores the suspended 4-disk board disk by disk', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(session!.size).toBe(4);
    expect(session!.seed).toBe(3217065499);
    // 1 = peg 1 to 2, 2 = 1 to 3, 5 = 2 to 3, 1 = 1 to 2. Disks smallest first, each entry its peg.
    expect(session!.history).toEqual([1, 2, 5, 1]);
    expect(session!.board).toEqual([2, 2, 1, 0]);
    expect(isSolved(session!.board)).toBe(false);
    expect(session!.status).toBe('playing');
    expect(session!.cleared).toBe(false);
    expect(session!.elapsedSeconds).toBe(7);
  });

  it('restores a solved board that was undone, keeping cleared', async () => {
    const session = await loadSavedGame(createMemoryKV({ 'hn.saveGame': SAVED_AFTER_UNDO }));
    expect(session).not.toBeNull();
    expect(session!.size).toBe(3);
    expect(session!.seed).toBe(1236274815);
    expect(session!.history).toEqual([2, 1, 7, 2, 3, 5]);
    // One move from solved: the smallest disk is still on peg 1.
    expect(session!.board).toEqual([0, 2, 2]);
    expect(session!.status).toBe('playing');
    expect(session!.cleared).toBe(true);
    expect(session!.elapsedSeconds).toBe(8);
  });

  it('writes the restored boards back byte for byte at their original save times', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(JSON.stringify(toPersisted(session!, 1793268381156))).toBe(RELEASED['hn.saveGame']);
    const undone = await loadSavedGame(createMemoryKV({ 'hn.saveGame': SAVED_AFTER_UNDO }));
    expect(JSON.stringify(toPersisted(undone!, 1793268370407))).toBe(SAVED_AFTER_UNDO);
  });
});
