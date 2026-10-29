/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (real clicks on the edge and menu buttons only): finish the Quick
 * Rules with "Start Playing" (an Easy 4x4 board opens by itself); tap in the
 * Easy loop and go Home; start Medium, tap in its loop, Home; start Hard, tap in
 * its loop, Home; open the Daily Challenge, tap in its loop, press "Retry same
 * board", tap six loop edges once (a line) and three edges that are not on the
 * loop twice (a cross), press Hint once and go Home (the suspended daily);
 * start a new Hard board, tap eight loop edges once and four non-loop edges
 * twice, press Hint twice (the second press was not counted: nothing had
 * changed since the first) and go Home (the suspended Free Play board; Hard is
 * also the last difficulty chosen). The loops were found by a depth-first
 * search written for the capture, which also confirmed that each board's clues
 * have exactly one loop; the clues were read from what the game itself stored.
 *
 * Captured: all five keys — lp.saveGame, lp.saveDaily, lp.stats, lp.flags,
 * lp.prefs. lp.stats holds three finished boards plus the cleared daily; the
 * daily also counts in the Medium row, so Medium shows three plays and two
 * clears. Not captured: a daily left over from an earlier day (a stale daily is
 * dropped on load and was not part of this session).
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { CROSS, LINE, UNKNOWN, cluesDigest, encodeClues } from '../game';
import { loadSavedGames, toPersisted } from './gamePersistence';
import { dailyGameSchema, flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'lp.saveGame':
    '{"schemaVersion":1,"mode":"difficulty","seed":"loop-puzzle-hard-mvte1cvt-9gayz","difficulty":"hard","dailyDate":null,"width":6,"height":6,"clues":"........3..0....3202.3...2..12.1.1..","cluesDigest":"lp1:28e14f98","marks":"XXXX....L.......L......L.L.L.LL.....L...............................................","hintCount":1,"elapsedSeconds":5,"savedAt":1793268965404}',
  'lp.saveDaily':
    '{"schemaVersion":1,"mode":"daily","seed":"loop-puzzle-daily-2026-10-29","difficulty":"medium","dailyDate":"2026-10-29","width":5,"height":5,"clues":"..3.3.....221...2.101100.","cluesDigest":"lp1:0de534a1","marks":"XXLXL...L..L..LL............................................","hintCount":1,"elapsedSeconds":4,"savedAt":1793268958728}',
  'lp.stats':
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":2,"bestSeconds":2},"medium":{"played":3,"solved":2,"totalPlaySeconds":11,"bestSeconds":3},"hard":{"played":2,"solved":1,"totalPlaySeconds":9,"bestSeconds":4},"dailyTimes":{"2026-10-29":4}}',
  'lp.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'lp.prefs': '{"schemaVersion":1,"difficulty":"hard"}',
};

/** The local day the daily above was played; `loadSavedGames` drops a daily from any other day. */
const TODAY = '2026-10-29';

/** The edge numbers carrying `mark` (docs/LOOP_PUZZLE_RULES.md §1 numbers the edges). */
const edgesWith = (marks: readonly number[], mark: number): number[] =>
  marks.flatMap((m, edge) => (m === mark ? [edge] : []));

describe('records written by the published Loop Puzzle build', () => {
  it('loads all five original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['lp.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['lp.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['lp.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['lp.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(JSON.parse(RELEASED['lp.saveDaily']));
  });

  it('reads the flags, the remembered difficulty and every statistic', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('hard');
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 2, bestSeconds: 2 },
      medium: { played: 3, solved: 2, totalPlaySeconds: 11, bestSeconds: 3 },
      hard: { played: 2, solved: 1, totalPlaySeconds: 9, bestSeconds: 4 },
      dailyTimes: { '2026-10-29': 4 },
    });
  });

  it('restores the suspended Hard Free Play board with its lines, crosses and hint', async () => {
    const { difficulty } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(difficulty).not.toBeNull();
    expect(difficulty!.mode).toBe('difficulty');
    expect(difficulty!.seed).toBe('loop-puzzle-hard-mvte1cvt-9gayz');
    expect(difficulty!.difficulty).toBe('hard');
    expect(difficulty!.dailyDate).toBeNull();
    expect(difficulty!.status).toBe('playing');
    expect(difficulty!.width).toBe(6);
    expect(difficulty!.height).toBe(6);
    expect(encodeClues(difficulty!.clues)).toBe('........3..0....3202.3...2..12.1.1..');
    expect(cluesDigest(difficulty!.clues)).toBe('lp1:28e14f98');
    // 6x6 has 2 * 36 + 6 + 6 = 84 edges.
    expect(difficulty!.marks).toHaveLength(84);
    expect(edgesWith(difficulty!.marks, LINE)).toEqual([8, 16, 23, 25, 27, 29, 30, 36]);
    expect(edgesWith(difficulty!.marks, CROSS)).toEqual([0, 1, 2, 3]);
    expect(edgesWith(difficulty!.marks, UNKNOWN)).toHaveLength(84 - 8 - 4);
    // The one loop these clues admit — found by the capture's own search, then
    // re-derived by the game on load.
    expect(edgesWith(difficulty!.solution, LINE)).toEqual([
      8, 16, 23, 25, 27, 29, 30, 36, 37, 38, 39, 40, 51, 52, 58, 59, 60, 61, 65, 66, 67, 69, 71, 75,
      77, 82,
    ]);
    // Every line the player wrote is on that loop and no cross is.
    for (const edge of edgesWith(difficulty!.marks, LINE)) {
      expect(difficulty!.solution[edge]).toBe(LINE);
    }
    for (const edge of edgesWith(difficulty!.marks, CROSS)) {
      expect(difficulty!.solution[edge]).not.toBe(LINE);
    }
    expect(difficulty!.hintCount).toBe(1);
    expect(difficulty!.elapsedSeconds).toBe(5);
  });

  it("restores the suspended daily as that date's board with its lines, crosses and hint", async () => {
    const { daily } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.seed).toBe('loop-puzzle-daily-2026-10-29');
    expect(daily!.difficulty).toBe('medium');
    expect(daily!.dailyDate).toBe('2026-10-29');
    expect(daily!.status).toBe('playing');
    expect(daily!.width).toBe(5);
    expect(daily!.height).toBe(5);
    expect(encodeClues(daily!.clues)).toBe('..3.3.....221...2.101100.');
    expect(cluesDigest(daily!.clues)).toBe('lp1:0de534a1');
    // 5x5 has 2 * 25 + 5 + 5 = 60 edges.
    expect(daily!.marks).toHaveLength(60);
    expect(edgesWith(daily!.marks, LINE)).toEqual([2, 4, 8, 11, 14, 15]);
    expect(edgesWith(daily!.marks, CROSS)).toEqual([0, 1, 3]);
    expect(edgesWith(daily!.solution, LINE)).toEqual([
      2, 4, 8, 11, 14, 15, 17, 18, 20, 21, 32, 33, 34, 35, 38, 41, 43, 46, 48, 50,
    ]);
    for (const edge of edgesWith(daily!.marks, LINE)) expect(daily!.solution[edge]).toBe(LINE);
    for (const edge of edgesWith(daily!.marks, CROSS)) {
      expect(daily!.solution[edge]).not.toBe(LINE);
    }
    expect(daily!.hintCount).toBe(1);
    expect(daily!.elapsedSeconds).toBe(4);
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const { difficulty, daily } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(difficulty).not.toBeNull();
    expect(daily).not.toBeNull();
    expect(JSON.stringify(toPersisted(difficulty!, 1793268965404))).toBe(RELEASED['lp.saveGame']);
    expect(JSON.stringify(toPersisted(daily!, 1793268958728))).toBe(RELEASED['lp.saveDaily']);
  });
});
