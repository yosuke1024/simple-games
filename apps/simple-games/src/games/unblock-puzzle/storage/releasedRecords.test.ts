/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (real pointer input only — mouse drags and clicks): finish the
 * three-page Quick Rules with "Start Playing" (an Easy Free Play board opens by
 * itself); drag that Easy board to a win and go Home; start Hard and drag it to
 * a win; open the Daily Challenge, drag it to a win, press "Retry same board",
 * slide two blocks and go Home (the suspended daily); start Medium, slide three
 * blocks, press Hint once and go Home (the suspended Free Play board; Medium is
 * also the last difficulty chosen). The slides were planned by a breadth-first
 * search written for the capture, not by the game.
 *
 * Captured: all five keys — ub.saveGame, ub.saveDaily, ub.stats, ub.flags,
 * ub.prefs. ub.stats holds three clears, each in its fewest moves: an Easy
 * board, a Hard board and the daily (counted in the Medium row, so Medium shows
 * three plays and one clear; the Free Play Medium board was not finished).
 * Not captured: a stats row where a board was
 * solved in more than its fewest moves (`optimal` below `solved`), because the
 * boards were solved with an optimal plan, and a second day's dailyMoves entry.
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { encodeBoard } from '../game';
import { loadSavedGames, toPersisted } from './gamePersistence';
import { dailyGameSchema, flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'ub.saveGame':
    '{"schemaVersion":1,"mode":"free","seed":"unblock-puzzle-medium-mvtebepy-5r3jb","difficulty":"medium","dailyDate":null,"board":"bccdd.b..eefaag.hf..g.hijjj..ikkllmm","minMoves":13,"moves":"f0i2j3","hintCount":1,"elapsedSeconds":4,"savedAt":1793269432572}',
  'ub.saveDaily':
    '{"schemaVersion":1,"mode":"daily","seed":"unblock-puzzle-daily-2026-10-29","difficulty":"medium","dailyDate":"2026-10-29","board":"bb..ccd..ef.daaef.d.gg....hijjkkhill","minMoves":13,"moves":"e0g3","hintCount":0,"elapsedSeconds":2,"savedAt":1793269427968}',
  'ub.stats':
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"optimal":1,"totalPlaySeconds":4,"bestSeconds":4},"medium":{"played":3,"solved":1,"optimal":1,"totalPlaySeconds":16,"bestSeconds":10},"hard":{"played":1,"solved":1,"optimal":1,"totalPlaySeconds":17,"bestSeconds":17},"dailyMoves":{"2026-10-29":13}}',
  'ub.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'ub.prefs': '{"schemaVersion":1,"difficulty":"medium"}',
};

/** The local day the daily above was played; `loadSavedGames` drops a daily from any other day. */
const TODAY = '2026-10-29';

describe('records written by the published Unblock Puzzle build', () => {
  it('loads all five original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['ub.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['ub.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['ub.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['ub.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(JSON.parse(RELEASED['ub.saveDaily']));
  });

  it('reads the flags, the remembered difficulty and every statistic', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('medium');
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, optimal: 1, totalPlaySeconds: 4, bestSeconds: 4 },
      medium: { played: 3, solved: 1, optimal: 1, totalPlaySeconds: 16, bestSeconds: 10 },
      hard: { played: 1, solved: 1, optimal: 1, totalPlaySeconds: 17, bestSeconds: 17 },
      dailyMoves: { '2026-10-29': 13 },
    });
  });

  it('restores the suspended Free Play board with the three slides played on it', async () => {
    const { free } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(free).not.toBeNull();
    expect(free!.mode).toBe('free');
    expect(free!.seed).toBe('unblock-puzzle-medium-mvtebepy-5r3jb');
    expect(free!.difficulty).toBe('medium');
    expect(free!.dailyDate).toBeNull();
    expect(free!.status).toBe('playing');
    expect(free!.minMoves).toBe(13);
    expect(free!.elapsedSeconds).toBe(4);
    expect(free!.hintCount).toBe(1);
    expect(encodeBoard(free!.start)).toBe('bccdd.b..eefaag.hf..g.hijjj..ikkllmm');
    // f up one, i up one, j right three: the block letter and the position it ends on.
    expect(free!.moves).toEqual([
      { block: 5, from: 1, to: 0 },
      { block: 8, from: 3, to: 2 },
      { block: 9, from: 0, to: 3 },
    ]);
    expect(encodeBoard(free!.board)).toBe(
      ['bccddf', 'b..eef', 'aag.hi', '..g.hi', '...jjj', 'kkllmm'].join(''),
    );
  });

  it("restores the suspended daily as that date's board with the two slides played on it", async () => {
    const { daily } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.seed).toBe('unblock-puzzle-daily-2026-10-29');
    expect(daily!.difficulty).toBe('medium');
    expect(daily!.dailyDate).toBe('2026-10-29');
    expect(daily!.status).toBe('playing');
    expect(daily!.minMoves).toBe(13);
    expect(daily!.elapsedSeconds).toBe(2);
    expect(daily!.hintCount).toBe(0);
    expect(encodeBoard(daily!.start)).toBe('bb..ccd..ef.daaef.d.gg....hijjkkhill');
    // e up one, g right one.
    expect(daily!.moves).toEqual([
      { block: 4, from: 1, to: 0 },
      { block: 6, from: 2, to: 3 },
    ]);
    expect(encodeBoard(daily!.board)).toBe(
      ['bb.ecc', 'd..ef.', 'daa.f.', 'd..gg.', '..hijj', 'kkhill'].join(''),
    );
    // The cleared daily in the statistics was that same board, cleared in its fewest moves.
    const stats = await loadRecord(statsSchema, createMemoryKV(RELEASED));
    expect(stats.dailyMoves['2026-10-29']).toBe(daily!.minMoves);
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const { free, daily } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(free).not.toBeNull();
    expect(daily).not.toBeNull();
    expect(JSON.stringify(toPersisted(free!, 1793269432572))).toBe(RELEASED['ub.saveGame']);
    expect(JSON.stringify(toPersisted(daily!, 1793269427968))).toBe(RELEASED['ub.saveDaily']);
  });
});
