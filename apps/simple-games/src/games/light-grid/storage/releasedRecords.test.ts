/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780)
 * with every non-localhost request aborted; its game assets were unchanged.
 *
 * UI steps (real clicks only — no storage writes, no calls into the game, no
 * clock mocking): finish Quick Rules (Next, Next, Start Playing, which starts
 * a 3x3 board straight away); tap cells 0 and 4, then clear the board by
 * tapping Hint and the cell it marks; press Undo on the result card (this
 * writes a `cleared: true` save back); return Home, which flushes the
 * suspended 3x3 board (RELEASED_AFTER_UNDO below is the storage at that
 * moment); choose 4 x 4 and confirm "Start a new game?"; tap three cells,
 * clear it with Hint, and leave by the result card's Home button; choose
 * 5 x 5, tap cells 12, 0, 24 and 7 with pauses, and return Home (RELEASED
 * below is the storage at the end).
 *
 * Captured: lg.flags, lg.stats, lg.prefs and lg.saveGame — all four declared
 * keys. The board cells in `PLAYED_3X3` / `PLAYED_5X5` are what the published
 * build drew in the DOM at the moment of each save (1 = lit, row by row), read
 * back by the script, so the seed -> board -> history chain is checked against
 * the published rendering rather than today's code. Not captured: a suspended
 * 4x4 board (its clear removes the one save slot, as published) and any
 * 4x4/5x5 save with `cleared: true` (the 3x3 one covers the flag).
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame } from './gamePersistence';
import {
  LG_STORAGE_KEYS,
  flagsSchema,
  gameSchema,
  prefsSchema,
  statsSchema,
  toPersisted,
} from './schemas';

/** Storage at the end of the capture: a suspended 5x5 board, after cleared 3x3 and 4x4 boards. */
const RELEASED = {
  'lg.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'lg.stats':
    '{"schemaVersion":1,"totalPlaySeconds":30,"boards":{"3":{"played":1,"completed":1,"best":7},"4":{"played":1,"completed":1,"best":10},"5":{"played":1,"completed":0,"best":null}}}',
  'lg.prefs': '{"schemaVersion":1,"size":5}',
  'lg.saveGame':
    '{"schemaVersion":1,"size":5,"seed":2209320965,"history":[12,0,24,7],"elapsedSeconds":9,"cleared":false,"savedAt":1793268942155}',
};

/** Storage the moment the 3x3 board was suspended after Undo from its clear. */
const RELEASED_AFTER_UNDO = {
  'lg.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'lg.stats':
    '{"schemaVersion":1,"totalPlaySeconds":12,"boards":{"3":{"played":1,"completed":1,"best":7},"4":{"played":0,"completed":0,"best":null},"5":{"played":0,"completed":0,"best":null}}}',
  'lg.prefs': '{"schemaVersion":1,"size":3}',
  'lg.saveGame':
    '{"schemaVersion":1,"size":3,"seed":1732516329,"history":[0,4,1,3,4,5],"elapsedSeconds":12,"cleared":true,"savedAt":1793268919444}',
};

/** The 3x3 board as the published build drew it (1 = lit), after 6 moves (Undo from the clear). */
const PLAYED_3X3 = '000010111';
/** The 5x5 board as the published build drew it (1 = lit), after 4 moves (16 lights on). */
const PLAYED_5X5 = '1011111110101011000101011';

describe('records written by the published Light Grid build', () => {
  it('declares exactly the four keys the build wrote', () => {
    expect(Object.values(LG_STORAGE_KEYS).sort()).toEqual(Object.keys(RELEASED).sort());
    expect(Object.keys(RELEASED_AFTER_UNDO).sort()).toEqual(Object.keys(RELEASED).sort());
  });

  it.each([
    ['at the end of the capture', RELEASED],
    ['right after Undo from a clear', RELEASED_AFTER_UNDO],
  ])('loads every record %s without replacing it with a default', async (_label, records) => {
    const kv = createMemoryKV({ ...records });
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(records['lg.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(records['lg.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(records['lg.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(records['lg.saveGame']));
  });

  it('reads the preference and every statistic as the build wrote them', async () => {
    const kv = createMemoryKV({ ...RELEASED });
    expect((await loadRecord(prefsSchema, kv)).size).toBe(5);
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.totalPlaySeconds).toBe(30);
    expect(stats.boards[3]).toEqual({ played: 1, completed: 1, best: 7 });
    expect(stats.boards[4]).toEqual({ played: 1, completed: 1, best: 10 });
    expect(stats.boards[5]).toEqual({ played: 1, completed: 0, best: null });
  });

  it('restores the suspended 5x5 board down to the lamp', async () => {
    const session = await loadSavedGame(createMemoryKV({ ...RELEASED }));
    expect(session).not.toBeNull();
    expect(session!.size).toBe(5);
    expect(session!.seed).toBe(2209320965);
    expect(session!.history).toEqual([12, 0, 24, 7]);
    expect(session!.elapsedSeconds).toBe(9);
    expect(session!.cleared).toBe(false);
    expect(session!.status).toBe('playing');
    expect(session!.board).toHaveLength(25);
    expect(session!.board.join('')).toBe(PLAYED_5X5);
  });

  it('restores the 3x3 board that was undone from its clear, still marked cleared', async () => {
    const session = await loadSavedGame(createMemoryKV({ ...RELEASED_AFTER_UNDO }));
    expect(session).not.toBeNull();
    expect(session!.size).toBe(3);
    expect(session!.seed).toBe(1732516329);
    expect(session!.history).toEqual([0, 4, 1, 3, 4, 5]);
    expect(session!.elapsedSeconds).toBe(12);
    // Finishing it again must not count a second clear (the stats record
    // above already holds completed: 1).
    expect(session!.cleared).toBe(true);
    expect(session!.status).toBe('playing');
    expect(session!.board).toHaveLength(9);
    expect(session!.board.join('')).toBe(PLAYED_3X3);
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const suspended = await loadSavedGame(createMemoryKV({ ...RELEASED }));
    expect(suspended).not.toBeNull();
    expect(JSON.stringify(toPersisted(suspended!, 1793268942155))).toBe(RELEASED['lg.saveGame']);

    const undone = await loadSavedGame(createMemoryKV({ ...RELEASED_AFTER_UNDO }));
    expect(undone).not.toBeNull();
    expect(JSON.stringify(toPersisted(undone!, 1793268919444))).toBe(
      RELEASED_AFTER_UNDO['lg.saveGame'],
    );
  });
});
