/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780)
 * with every non-localhost request aborted; its game assets were unchanged.
 *
 * UI steps (real clicks only — no storage writes, no calls into the game, no
 * clock mocking): finish Quick Rules (Next, Next, Start Playing, which starts
 * a 6x6 board straight away); wait a few seconds; play that board to a clear
 * by clicking palette buttons; press Undo on the result card (this writes a
 * `cleared: true` save back); return Home, which flushes the suspended 6x6
 * board (RELEASED_AFTER_UNDO below is the storage at that moment); choose
 * 10 x 10 and confirm "Start a new game?" (replaces the suspended board);
 * click five palette buttons, wait, and return Home (RELEASED below is the
 * storage at the end).
 *
 * Captured: cf.flags, cf.stats, cf.prefs and cf.saveGame — all four declared
 * keys. The board cells in `PLAYED_6X6` / `PLAYED_10X10` are what the
 * published build drew in the DOM at the moment of each save (colour index per
 * tile, row by row), read back by the script, so the seed -> board -> history
 * chain is checked against the published rendering rather than today's code.
 * Not captured: a saved game with `cleared: false` for the 6x6 board (only one
 * slot exists, and the 10x10 board that replaced it is the `cleared: false`
 * case), and the 14x14 size (stats for it stay at their zero values).
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame } from './gamePersistence';
import {
  CF_STORAGE_KEYS,
  flagsSchema,
  gameSchema,
  prefsSchema,
  statsSchema,
  toPersisted,
} from './schemas';

/** Storage at the end of the capture: a suspended 10x10 board, after one cleared 6x6. */
const RELEASED = {
  'cf.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'cf.stats':
    '{"schemaVersion":1,"totalPlaySeconds":15,"boards":{"6":{"played":1,"completed":1,"best":11},"10":{"played":1,"completed":0,"best":null},"14":{"played":0,"completed":0,"best":null}}}',
  'cf.prefs': '{"schemaVersion":1,"size":10}',
  'cf.saveGame':
    '{"schemaVersion":1,"size":10,"seed":2737000022,"history":[0,5,3,4,0],"elapsedSeconds":6,"cleared":false,"savedAt":1793268659155}',
};

/** Storage the moment the 6x6 board was suspended after Undo from its clear. */
const RELEASED_AFTER_UNDO = {
  'cf.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'cf.stats':
    '{"schemaVersion":1,"totalPlaySeconds":9,"boards":{"6":{"played":1,"completed":1,"best":11},"10":{"played":0,"completed":0,"best":null},"14":{"played":0,"completed":0,"best":null}}}',
  'cf.prefs': '{"schemaVersion":1,"size":6}',
  'cf.saveGame':
    '{"schemaVersion":1,"size":6,"seed":1775567811,"history":[3,2,4,5,1,0,3,2,4,1],"elapsedSeconds":9,"cleared":true,"savedAt":1793268650755}',
};

/** The 6x6 board as the published build drew it (colour index per tile), 10 moves in. */
const PLAYED_6X6 = '111111111111111111111115111111111111';
/** The 10x10 board as the published build drew it, 5 moves in (22 of 100 connected). */
const PLAYED_10X10 =
  '0015213121000150421000002013240000004413010210221050013230540245013213521000321113004541151415143030';

describe('records written by the published Color Flood build', () => {
  it('declares exactly the four keys the build wrote', () => {
    expect(Object.values(CF_STORAGE_KEYS).sort()).toEqual(Object.keys(RELEASED).sort());
    expect(Object.keys(RELEASED_AFTER_UNDO).sort()).toEqual(Object.keys(RELEASED).sort());
  });

  it.each([
    ['at the end of the capture', RELEASED],
    ['right after Undo from a clear', RELEASED_AFTER_UNDO],
  ])('loads every record %s without replacing it with a default', async (_label, records) => {
    const kv = createMemoryKV({ ...records });
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(records['cf.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(records['cf.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(records['cf.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(records['cf.saveGame']));
  });

  it('reads the preference and every statistic as the build wrote them', async () => {
    const kv = createMemoryKV({ ...RELEASED });
    expect((await loadRecord(prefsSchema, kv)).size).toBe(10);
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.totalPlaySeconds).toBe(15);
    expect(stats.boards[6]).toEqual({ played: 1, completed: 1, best: 11 });
    expect(stats.boards[10]).toEqual({ played: 1, completed: 0, best: null });
    expect(stats.boards[14]).toEqual({ played: 0, completed: 0, best: null });
  });

  it('restores the suspended 10x10 board down to the tile', async () => {
    const session = await loadSavedGame(createMemoryKV({ ...RELEASED }));
    expect(session).not.toBeNull();
    expect(session!.size).toBe(10);
    expect(session!.seed).toBe(2737000022);
    expect(session!.history).toEqual([0, 5, 3, 4, 0]);
    expect(session!.elapsedSeconds).toBe(6);
    expect(session!.cleared).toBe(false);
    expect(session!.status).toBe('playing');
    expect(session!.board).toHaveLength(100);
    expect(session!.board.join('')).toBe(PLAYED_10X10);
  });

  it('restores the 6x6 board that was undone from its clear, still marked cleared', async () => {
    const session = await loadSavedGame(createMemoryKV({ ...RELEASED_AFTER_UNDO }));
    expect(session).not.toBeNull();
    expect(session!.size).toBe(6);
    expect(session!.seed).toBe(1775567811);
    expect(session!.history).toEqual([3, 2, 4, 5, 1, 0, 3, 2, 4, 1]);
    expect(session!.elapsedSeconds).toBe(9);
    // Finishing it again must not count a second clear (the stats record
    // above already holds completed: 1).
    expect(session!.cleared).toBe(true);
    expect(session!.status).toBe('playing');
    expect(session!.board).toHaveLength(36);
    expect(session!.board.join('')).toBe(PLAYED_6X6);
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const suspended = await loadSavedGame(createMemoryKV({ ...RELEASED }));
    expect(suspended).not.toBeNull();
    expect(JSON.stringify(toPersisted(suspended!, 1793268659155))).toBe(RELEASED['cf.saveGame']);

    const undone = await loadSavedGame(createMemoryKV({ ...RELEASED_AFTER_UNDO }));
    expect(undone).not.toBeNull();
    expect(JSON.stringify(toPersisted(undone!, 1793268650755))).toBe(
      RELEASED_AFTER_UNDO['cf.saveGame'],
    );
  });
});
