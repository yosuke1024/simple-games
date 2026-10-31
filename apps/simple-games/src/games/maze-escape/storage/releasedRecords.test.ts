/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. It was served on
 * 127.0.0.1 by a Playwright harness (Chromium, 390x780, en-US) with every
 * non-localhost request aborted; game assets unchanged.
 * UI steps: finish the tutorial (Start Playing begins a 5 x 5 maze); solve it by following
 * Hint (a script clicked Hint, read the hinted cell from the page, then pressed the arrow key
 * or the on-screen arrow); Undo on the result card (back to play with cleared:true); Home and
 * Resume the 5 x 5 from the home; finish it again; Home; start "7 x 7", follow Hint for three
 * moves, step one cell sideways and straight back, follow Hint for four more, return Home so
 * the suspended maze is saved.
 * Captured: all four keys (me.flags, me.prefs, me.stats, me.saveGame) as they stood at the
 * end. SAVED_AFTER_UNDO is me.saveGame as read right after the Undo on the solved 5 x 5
 * (cleared:true), from the same run, before the later play replaced it.
 * Not captured: nothing declared is missing. The 9 x 9 maze was never played, so its row in
 * me.stats is the untouched zero row.
 * No storage writes, clock mocking, or game-internal calls created these records: the
 * harness only clicked, pressed keys and moved the pointer (a script read positions from the
 * DOM to decide where). Only the Web Preferences key prefix `CapacitorStorage.` is removed
 * below; payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema, toPersisted } from './schemas';

const RELEASED = {
  'me.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'me.prefs': '{"schemaVersion":1,"size":7}',
  'me.stats':
    '{"schemaVersion":1,"totalPlaySeconds":26,"boards":{"5":{"played":1,"completed":1,"best":16},' +
    '"7":{"played":1,"completed":0,"best":null},"9":{"played":0,"completed":0,"best":null}}}',
  'me.saveGame':
    '{"schemaVersion":1,"size":7,"seed":2931040376,"history":[1,8,9,8,9,10,11,4,5],' +
    '"elapsedSeconds":11,"cleared":false,"savedAt":1793268504306}',
};

const SAVED_AFTER_UNDO =
  '{"schemaVersion":1,"size":5,"seed":3058811089,"history":[5,10,11,6,1,2,3,8,9,14,13,12,17,18,' +
  '23],"elapsedSeconds":14,"cleared":true,"savedAt":1793268486706}';

describe('records written by the published Maze Escape build', () => {
  it('loads every captured record without replacing it with a default', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['me.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['me.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['me.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['me.saveGame']));
    const undone = createMemoryKV({ 'me.saveGame': SAVED_AFTER_UNDO });
    expect(await loadRecord(gameSchema, undone)).toEqual(JSON.parse(SAVED_AFTER_UNDO));
  });

  it('reads the flag, the remembered size and every statistic the player earned', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).size).toBe(7);
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.totalPlaySeconds).toBe(26);
    expect(stats.boards[5]).toEqual({ played: 1, completed: 1, best: 16 });
    expect(stats.boards[7]).toEqual({ played: 1, completed: 0, best: null });
    expect(stats.boards[9]).toEqual({ played: 0, completed: 0, best: null });
  });

  it('restores the suspended 7 x 7 maze with its walk, detour included', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    // Restoring replays every step against the maze regenerated from the seed, so a
    // non-null result is the proof that today's generator still draws the player's maze.
    expect(session).not.toBeNull();
    expect(session!.size).toBe(7);
    expect(session!.seed).toBe(2931040376);
    expect(session!.history).toEqual([1, 8, 9, 8, 9, 10, 11, 4, 5]);
    expect(session!.position).toBe(5);
    expect(session!.board).toHaveLength(49);
    expect(session!.status).toBe('playing');
    expect(session!.cleared).toBe(false);
    expect(session!.elapsedSeconds).toBe(11);
  });

  it('restores a solved maze that was undone, keeping cleared', async () => {
    const session = await loadSavedGame(createMemoryKV({ 'me.saveGame': SAVED_AFTER_UNDO }));
    expect(session).not.toBeNull();
    expect(session!.size).toBe(5);
    expect(session!.seed).toBe(3058811089);
    expect(session!.history).toEqual([5, 10, 11, 6, 1, 2, 3, 8, 9, 14, 13, 12, 17, 18, 23]);
    // Cell 23 is next to the flag at cell 24.
    expect(session!.position).toBe(23);
    expect(session!.status).toBe('playing');
    expect(session!.cleared).toBe(true);
    expect(session!.elapsedSeconds).toBe(14);
  });

  it('writes the restored mazes back byte for byte at their original save times', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(JSON.stringify(toPersisted(session!, 1793268504306))).toBe(RELEASED['me.saveGame']);
    const undone = await loadSavedGame(createMemoryKV({ 'me.saveGame': SAVED_AFTER_UNDO }));
    expect(JSON.stringify(toPersisted(undone!, 1793268486706))).toBe(SAVED_AFTER_UNDO);
  });
});
