/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (real clicks on the peg, hole and menu buttons only): finish the
 * Quick Rules with "Start Playing" (an English board opens by itself); make four
 * jumps and go Home (RELEASED_ENGLISH_PARTIAL was dumped here); press the
 * English button ("Resume") and play the other 27 jumps to a perfect clear; press
 * Undo on the result card and go Home (RELEASED_ENGLISH_UNDONE_CLEAR was dumped
 * here: the game is back in play and marked cleared); press Triangle and "Start"
 * on the replace-the-game question, then play the last legal jump each time
 * until none is left (4 pegs left) and go Home; press Triangle again (nothing
 * suspended, so no question), make three jumps and go Home (the suspended
 * Triangle game in RELEASED; Triangle is also the last board chosen). The
 * 31-jump English solution was found by a depth-first search written for the
 * capture, not by the game.
 *
 * Captured: all four keys — pg.saveGame, pg.stats, pg.flags, pg.prefs.
 * RELEASED is the dump at the end of the session; the two RELEASED_ENGLISH_*
 * constants hold the pg.saveGame and pg.stats the same session wrote in the
 * middle, which is the only way to see an English save and a save with the
 * optional `cleared: true` (the game has one save slot, so the Triangle game
 * replaced them). Not captured: a Triangle perfect clear (`perfect` is 0 for
 * Triangle) and a one-peg-off-target ending.
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'pg.saveGame':
    '{"schemaVersion":1,"board":"triangle","start":4,"target":12,"jumps":[[11,4],[2,7],[9,2]],"elapsedSeconds":1,"savedAt":1793269266169}',
  'pg.stats':
    '{"schemaVersion":1,"english":{"played":1,"best":1,"perfect":1},"triangle":{"played":2,"best":4,"perfect":0},"totalPlaySeconds":14}',
  'pg.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'pg.prefs': '{"schemaVersion":1,"board":"triangle"}',
};

const RELEASED_ENGLISH_PARTIAL = {
  'pg.saveGame':
    '{"schemaVersion":1,"board":"english","start":16,"target":16,"jumps":[[4,16],[7,9],[0,8],[2,0]],"elapsedSeconds":1,"savedAt":1793269243634}',
  'pg.stats':
    '{"schemaVersion":1,"english":{"played":1,"best":null,"perfect":0},"triangle":{"played":0,"best":null,"perfect":0},"totalPlaySeconds":1}',
};

const RELEASED_ENGLISH_UNDONE_CLEAR = {
  'pg.saveGame':
    '{"schemaVersion":1,"board":"english","start":16,"target":16,"jumps":[[4,16],[7,9],[0,8],[2,0],[9,7],[6,8],[10,2],[12,10],[15,3],[0,8],[13,15],[15,3],[17,5],[2,10],[19,17],[17,5],[27,15],[20,22],[22,8],[3,15],[15,17],[24,10],[5,17],[26,24],[23,25],[32,24],[17,29],[30,32],[32,24],[25,23]],"elapsedSeconds":9,"cleared":true,"savedAt":1793269255738}',
  'pg.stats':
    '{"schemaVersion":1,"english":{"played":1,"best":1,"perfect":1},"triangle":{"played":0,"best":null,"perfect":0},"totalPlaySeconds":9}',
};

/** The numbers of the holes that hold no peg, in hole order. */
const emptyHoles = (pegs: readonly boolean[]): number[] =>
  pegs.flatMap((peg, hole) => (peg ? [] : [hole]));

describe('records written by the published Peg Solitaire build', () => {
  it('loads all four original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['pg.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['pg.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['pg.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['pg.saveGame']));
  });

  it('loads the two earlier mid-session English records too', async () => {
    for (const earlier of [RELEASED_ENGLISH_PARTIAL, RELEASED_ENGLISH_UNDONE_CLEAR]) {
      const kv = createMemoryKV(earlier);
      expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(earlier['pg.stats']));
      expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(earlier['pg.saveGame']));
    }
  });

  it('reads the flags, the remembered board and every statistic', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).board).toBe('triangle');
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      english: { played: 1, best: 1, perfect: 1 },
      triangle: { played: 2, best: 4, perfect: 0 },
      totalPlaySeconds: 14,
    });
  });

  it('restores the suspended Triangle game with the three jumps played on it', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    // Hole 4 is the middle of the third row (hole 5 in the rules' numbering, an inner hole);
    // the goal is hole 12, the middle of the bottom row (13 in the rules' numbering).
    expect(session!.problem).toEqual({ kind: 'triangle', start: 4, target: 12 });
    expect(session!.status).toBe('playing');
    expect(session!.outcome).toBeNull();
    expect(session!.cleared).toBe(false);
    expect(session!.elapsedSeconds).toBe(1);
    // 11 -> 4 over 7, 2 -> 7 over 4, 9 -> 2 over 5: a jump is [from, to] in the record.
    expect(session!.jumps).toEqual([
      { from: 11, over: 7, to: 4 },
      { from: 2, over: 4, to: 7 },
      { from: 9, over: 5, to: 2 },
    ]);
    // Start empty: {4}. After the jumps: 11 and 7 emptied and 4 filled; 2 and 4 emptied and 7
    // filled; 9 and 5 emptied and 2 filled. 15 holes, 4 empty, 11 pegs.
    expect(emptyHoles(session!.pegs)).toEqual([4, 5, 9, 11]);
  });

  it('restores the earlier English game after four jumps', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED_ENGLISH_PARTIAL));
    expect(session).not.toBeNull();
    expect(session!.problem).toEqual({ kind: 'english', start: 16, target: 16 });
    expect(session!.status).toBe('playing');
    expect(session!.cleared).toBe(false);
    expect(session!.elapsedSeconds).toBe(1);
    expect(session!.jumps).toEqual([
      { from: 4, over: 9, to: 16 },
      { from: 7, over: 8, to: 9 },
      { from: 0, over: 3, to: 8 },
      { from: 2, over: 1, to: 0 },
    ]);
    // The centre starts empty; the four jumps leave holes 1, 2, 3, 4 and 7 empty: 28 pegs.
    expect(emptyHoles(session!.pegs)).toEqual([1, 2, 3, 4, 7]);
    // Nothing is finished yet, so the statistics hold no best.
    const stats = await loadRecord(statsSchema, createMemoryKV(RELEASED_ENGLISH_PARTIAL));
    expect(stats.english).toEqual({ played: 1, best: null, perfect: 0 });
  });

  it('restores the earlier English game that was cleared and then taken back', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED_ENGLISH_UNDONE_CLEAR));
    expect(session).not.toBeNull();
    expect(session!.problem).toEqual({ kind: 'english', start: 16, target: 16 });
    // Back in play, with the clear remembered so it is not counted twice.
    expect(session!.status).toBe('playing');
    expect(session!.outcome).toBeNull();
    expect(session!.cleared).toBe(true);
    expect(session!.elapsedSeconds).toBe(9);
    // 31 jumps clear the board; the last one was undone.
    expect(session!.jumps).toHaveLength(30);
    expect(session!.jumps[0]).toEqual({ from: 4, over: 9, to: 16 });
    expect(session!.jumps[29]).toEqual({ from: 25, over: 24, to: 23 });
    // Two pegs left: 23 (just landed) and 28, which jumps up over it onto the centre.
    expect(session!.pegs.flatMap((peg, hole) => (peg ? [hole] : []))).toEqual([23, 28]);
    // The statistics already counted the one perfect clear.
    const stats = await loadRecord(statsSchema, createMemoryKV(RELEASED_ENGLISH_UNDONE_CLEAR));
    expect(stats.english).toEqual({ played: 1, best: 1, perfect: 1 });
    expect(stats.triangle).toEqual({ played: 0, best: null, perfect: 0 });
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const triangle = await loadSavedGame(createMemoryKV(RELEASED));
    expect(triangle).not.toBeNull();
    expect(JSON.stringify(toPersisted(triangle!, 1793269266169))).toBe(RELEASED['pg.saveGame']);

    const partial = await loadSavedGame(createMemoryKV(RELEASED_ENGLISH_PARTIAL));
    expect(partial).not.toBeNull();
    expect(JSON.stringify(toPersisted(partial!, 1793269243634))).toBe(
      RELEASED_ENGLISH_PARTIAL['pg.saveGame'],
    );

    const undone = await loadSavedGame(createMemoryKV(RELEASED_ENGLISH_UNDONE_CLEAR));
    expect(undone).not.toBeNull();
    expect(JSON.stringify(toPersisted(undone!, 1793269255738))).toBe(
      RELEASED_ENGLISH_UNDONE_CLEAR['pg.saveGame'],
    );
  });
});
