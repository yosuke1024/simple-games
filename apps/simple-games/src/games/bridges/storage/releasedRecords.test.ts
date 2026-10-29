/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (real clicks on the island and menu buttons only; Escape clears the
 * selection between islands): finish the Quick Rules with "Start Playing" (an
 * Easy 7x7 board opens by itself); build every bridge of that board (tap an
 * island, then its partner once or twice) and go Home; do the same on a Medium
 * and a Hard board; open the Daily Challenge, build it, press "Retry same
 * board", build the two double bridges and one single bridge, press Hint once
 * and go Home (the suspended daily); start a new Hard board, build two double
 * and two single bridges, press Hint once and go Home (the suspended Free Play
 * board; Hard is also the last difficulty chosen). Which islands to join was
 * read from the answer the game itself had stored for the board; that answer is
 * the board's only one, and the test below re-checks it against the rules.
 *
 * Captured: all five keys — bg.saveGame, bg.saveDaily, bg.stats, bg.flags,
 * bg.prefs. Unlike Unblock Puzzle and Loop Puzzle, Bridges keeps the daily in
 * its own statistics row (`daily`), not in Medium: bg.stats shows Medium with a
 * single play and `daily` with two (the first clear and the retry). Not
 * captured: a daily left over from an earlier day (a stale daily is dropped on
 * load and was not part of this session).
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { isSolved, type BridgesSession } from '../game';
import { loadSavedGames, toPersisted } from './gamePersistence';
import { dailyGameSchema, flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'bg.saveGame':
    '{"schemaVersion":1,"mode":"difficulty","seed":"bridges-hard-mvte4kv8-4eaph","difficulty":"hard","dailyDate":null,"width":10,"height":10,"board":"1.2...2..1........1.2...1.2.....3..4..4........1....2.1...1.3....3.3.2..........2.....3..2..........","solution":"0111011101100112111101111012","bridges":"0110000000000002000000000002","hintCount":1,"elapsedSeconds":4,"savedAt":1793269114222}',
  'bg.saveDaily':
    '{"schemaVersion":1,"mode":"daily","seed":"bridges-daily-2026-10-29","difficulty":"medium","dailyDate":"2026-10-29","width":9,"height":9,"board":".2.4.2.2.........1..........2..2.3.....2...1...........3.3..3.2..........1.2..1..","solution":"111211101210011111001","bridges":"100200000200000000000","hintCount":1,"elapsedSeconds":3,"savedAt":1793269109059}',
  'bg.stats':
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":3,"bestSeconds":3},"medium":{"played":1,"solved":1,"totalPlaySeconds":11,"bestSeconds":11},"hard":{"played":2,"solved":1,"totalPlaySeconds":11,"bestSeconds":7},"daily":{"played":2,"totalPlaySeconds":8},"dailyTimes":{"2026-10-29":5}}',
  'bg.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'bg.prefs': '{"schemaVersion":1,"difficulty":"hard"}',
};

/** The local day the daily above was played; `loadSavedGames` drops a daily from any other day. */
const TODAY = '2026-10-29';

/** How many bridges end at each island, summed over the edges that touch it. */
const bridgesAtEachIsland = (session: BridgesSession, bridges: readonly number[]): number[] => {
  const totals = session.islands.map(() => 0);
  session.graph.edges.forEach((edge, i) => {
    totals[edge.a] = totals[edge.a]! + bridges[i]!;
    totals[edge.b] = totals[edge.b]! + bridges[i]!;
  });
  return totals;
};

describe('records written by the published Bridges build', () => {
  it('loads all five original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['bg.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['bg.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['bg.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['bg.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(JSON.parse(RELEASED['bg.saveDaily']));
  });

  it('reads the flags, the remembered difficulty and every statistic', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).difficulty).toBe('hard');
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 3, bestSeconds: 3 },
      medium: { played: 1, solved: 1, totalPlaySeconds: 11, bestSeconds: 11 },
      hard: { played: 2, solved: 1, totalPlaySeconds: 11, bestSeconds: 7 },
      daily: { played: 2, totalPlaySeconds: 8 },
      dailyTimes: { '2026-10-29': 5 },
    });
  });

  it('restores the suspended Hard Free Play board with the four bridged pairs built on it', async () => {
    const { difficulty } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(difficulty).not.toBeNull();
    expect(difficulty!.mode).toBe('difficulty');
    expect(difficulty!.seed).toBe('bridges-hard-mvte4kv8-4eaph');
    expect(difficulty!.difficulty).toBe('hard');
    expect(difficulty!.dailyDate).toBeNull();
    expect(difficulty!.status).toBe('playing');
    expect(difficulty!.width).toBe(10);
    expect(difficulty!.height).toBe(10);
    expect(difficulty!.islands.map((island) => island.value)).toEqual([
      1, 2, 2, 1, 1, 2, 1, 2, 3, 4, 4, 1, 2, 1, 1, 3, 3, 3, 2, 2, 3, 2,
    ]);
    expect(difficulty!.islands[0]).toEqual({ index: 0, value: 1 });
    expect(difficulty!.graph.edges).toHaveLength(28);
    expect(difficulty!.solution).toEqual(
      [...'0111011101100112111101111012'].map((digit) => Number(digit)),
    );
    // Edges 1, 2, 15 and 27 carry the bridges: single, single, double, double.
    expect(difficulty!.bridges).toEqual(
      [...'0110000000000002000000000002'].map((digit) => Number(digit)),
    );
    expect(difficulty!.graph.edges[15]).toMatchObject({ a: 9, b: 10, horizontal: true });
    expect(difficulty!.graph.edges[27]).toMatchObject({ a: 20, b: 21, horizontal: true });
    expect(isSolved(difficulty!.graph, difficulty!.bridges)).toBe(false);
    // The stored answer is a real one: every island ends with exactly its number of bridges.
    expect(isSolved(difficulty!.graph, difficulty!.solution)).toBe(true);
    expect(bridgesAtEachIsland(difficulty!, difficulty!.solution)).toEqual(
      difficulty!.islands.map((island) => island.value),
    );
    expect(difficulty!.hintCount).toBe(1);
    expect(difficulty!.elapsedSeconds).toBe(4);
  });

  it("restores the suspended daily as that date's board with the three bridged pairs built on it", async () => {
    const { daily } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.seed).toBe('bridges-daily-2026-10-29');
    expect(daily!.difficulty).toBe('medium');
    expect(daily!.dailyDate).toBe('2026-10-29');
    expect(daily!.status).toBe('playing');
    expect(daily!.width).toBe(9);
    expect(daily!.height).toBe(9);
    expect(daily!.islands.map((island) => island.value)).toEqual([
      2, 4, 2, 2, 1, 2, 2, 3, 2, 1, 3, 3, 3, 2, 1, 2, 1,
    ]);
    expect(daily!.islands[0]).toEqual({ index: 1, value: 2 });
    expect(daily!.graph.edges).toHaveLength(21);
    expect(daily!.solution).toEqual([...'111211101210011111001'].map((digit) => Number(digit)));
    // Edges 0, 3 and 9 carry the bridges: single, double, double.
    expect(daily!.bridges).toEqual([...'100200000200000000000'].map((digit) => Number(digit)));
    expect(daily!.graph.edges[0]).toMatchObject({ a: 0, b: 1, horizontal: true });
    expect(daily!.graph.edges[3]).toMatchObject({ a: 1, b: 8, horizontal: false });
    expect(daily!.graph.edges[9]).toMatchObject({ a: 6, b: 7, horizontal: true });
    expect(isSolved(daily!.graph, daily!.bridges)).toBe(false);
    expect(isSolved(daily!.graph, daily!.solution)).toBe(true);
    expect(bridgesAtEachIsland(daily!, daily!.solution)).toEqual(
      daily!.islands.map((island) => island.value),
    );
    expect(daily!.hintCount).toBe(1);
    expect(daily!.elapsedSeconds).toBe(3);
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const { difficulty, daily } = await loadSavedGames(createMemoryKV(RELEASED), TODAY);
    expect(difficulty).not.toBeNull();
    expect(daily).not.toBeNull();
    expect(JSON.stringify(toPersisted(difficulty!, 1793269114222))).toBe(RELEASED['bg.saveGame']);
    expect(JSON.stringify(toPersisted(daily!, 1793269109059))).toBe(RELEASED['bg.saveDaily']);
  });
});
