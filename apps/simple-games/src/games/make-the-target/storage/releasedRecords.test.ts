/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780)
 * with every non-localhost request aborted; its game assets were unchanged.
 *
 * UI steps (real taps only — no storage writes, no calls into the game, no
 * clock mocking; a separate planner read the numbers and target off the page
 * to choose which tiles to tap). Finish Quick Rules (Next, Next, Start
 * Playing, which deals an Easy problem — RELEASED_FRESH_EASY is the save at
 * that moment); solve it with tile, operator, tile taps and leave by the
 * result card's Home. Home > Medium: two merges, Home (a partial save), then
 * Resume, finish on a number that is not the target (the "That makes 15, not
 * 30." panel) and Home — the `missed` save. Home > Daily Challenge: solve it
 * (so `dailyTimes` gets today's entry), Retry same board on the result card,
 * one merge, Home (RELEASED_MISSED is the storage at that moment). Home > Hard,
 * confirm replacing the Medium problem, two merges, Home (RELEASED is the
 * storage at the end).
 *
 * Captured: all five declared keys — tg.flags, tg.prefs, tg.stats,
 * tg.saveGame and tg.saveDaily — with both slots filled in each of the two
 * states. The `DOM_*` constants are what the published build drew when each
 * save was written (the slots, the expression lines, the "missed" sentence),
 * read from the page by the script (the expression lines without the screen-reader text the
 * page appends to each), so the replay is checked against the
 * published rendering and not against today's serializer. The daily record
 * belongs to 2026-10-29, the day of the capture; the tests pass that date as
 * "today", because a daily from any other day is deleted on load by design.
 * Not captured: a Free Play retry of a solved problem (`repeat: true`) and a
 * save of a solved or shown-solution problem (none exists by design — the
 * slot is cleared when a problem ends).
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { OPERATOR_SYMBOLS, expressionLines, lastNumber, type MakeTheTargetSession } from '../game';
import { loadSavedGames, toPersisted } from './gamePersistence';
import {
  TG_STORAGE_KEYS,
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  prefsSchema,
  statsSchema,
} from './schemas';

/** The day of the capture; the daily records below are today's only on this date. */
const CAPTURE_DAY = '2026-10-29';

/** Storage at the end of the capture: a Hard problem two moves in, the daily retried one move in. */
const RELEASED = {
  'tg.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'tg.prefs': '{"schemaVersion":1,"difficulty":"hard"}',
  'tg.stats':
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":6,"bestSeconds":6},"medium":{"played":1,"solved":0,"totalPlaySeconds":12,"bestSeconds":null},"hard":{"played":1,"solved":0,"totalPlaySeconds":7,"bestSeconds":null},"daily":{"played":2,"totalPlaySeconds":11},"dailyTimes":{"2026-10-29":5}}',
  'tg.saveGame':
    '{"schemaVersion":1,"mode":"free","seed":"make-the-target-hard-mvtedetl-85w69","difficulty":"hard","dailyDate":null,"numbers":[2,3,3,7,15],"target":151,"solution":"2-03+14*11+0","moves":"0+11+2","repeat":false,"elapsedSeconds":7,"savedAt":1793269529918}',
  'tg.saveDaily':
    '{"schemaVersion":1,"mode":"daily","seed":"make-the-target-daily-2026-10-29","difficulty":"medium","dailyDate":"2026-10-29","numbers":[4,5,10,10],"target":44,"solution":"3*12-01-0","moves":"1*2","repeat":false,"elapsedSeconds":6,"savedAt":1793269520564}',
};
/**
 * Storage after the daily was retried and left (Home), while the Free Play slot held a
 * Medium problem on its `missed` panel: both slots filled at once, difficulty last chosen
 * Medium, no Hard problem started yet.
 */
const RELEASED_MISSED = {
  'tg.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'tg.prefs': '{"schemaVersion":1,"difficulty":"medium"}',
  'tg.stats':
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":6,"bestSeconds":6},"medium":{"played":1,"solved":0,"totalPlaySeconds":12,"bestSeconds":null},"hard":{"played":0,"solved":0,"totalPlaySeconds":0,"bestSeconds":null},"daily":{"played":2,"totalPlaySeconds":11},"dailyTimes":{"2026-10-29":5}}',
  'tg.saveGame':
    '{"schemaVersion":1,"mode":"free","seed":"make-the-target-medium-mvtecrux-6sezb","difficulty":"medium","dailyDate":null,"numbers":[1,1,3,3,7],"target":30,"solution":"4+23/00/12*1","moves":"0+11+22+33+4","repeat":false,"elapsedSeconds":12,"savedAt":1793269506401}',
  'tg.saveDaily':
    '{"schemaVersion":1,"mode":"daily","seed":"make-the-target-daily-2026-10-29","difficulty":"medium","dailyDate":"2026-10-29","numbers":[4,5,10,10],"target":44,"solution":"3*12-01-0","moves":"1*2","repeat":false,"elapsedSeconds":6,"savedAt":1793269520564}',
};
/** The first problem of the install, as dealt: Quick Rules start Easy, nothing played yet (`moves` is empty). */
const RELEASED_FRESH_EASY =
  '{"schemaVersion":1,"mode":"free","seed":"make-the-target-easy-mvtecl71-4y3ew","difficulty":"easy","dailyDate":null,"numbers":[2,3,4,9],"target":24,"solution":"3+12-01*0","moves":"","repeat":false,"elapsedSeconds":0,"savedAt":1793269483598}';

/** What the page showed when each of those saves was written. */
const DOM_FRESH_EASY = { slots: [2, 3, 4, 9], target: 24, lines: [] as string[] };
const DOM_HARD = { slots: [null, null, 8, 7, 15], target: 151, lines: ['2 + 3 = 5', '5 + 3 = 8'] };
const DOM_DAILY = { slots: [4, null, 50, 10], target: 44, lines: ['5 × 10 = 50'] };
const DOM_MISSED = {
  slots: [null, null, null, null, 15],
  target: 30,
  lines: ['1 + 1 = 2', '2 + 3 = 5', '5 + 3 = 8', '8 + 7 = 15'],
  panel: 'That makes 15, not 30.',
};

/** An expression line as the page wrote it: `left op right = result`, with the drawn operator. */
const linesOf = (session: MakeTheTargetSession) =>
  expressionLines(session).map(
    (line) => `${line.left} ${OPERATOR_SYMBOLS[line.op]} ${line.right} = ${line.result}`,
  );

const kvOf = (records: Record<string, string>) => createMemoryKV({ ...records });

describe('records written by the published Make the Target build', () => {
  it('declares exactly the five keys the build wrote', () => {
    for (const records of [RELEASED, RELEASED_MISSED]) {
      expect(Object.keys(records).sort()).toEqual(Object.values(TG_STORAGE_KEYS).sort());
    }
  });

  it.each([
    ['at the end of the capture', RELEASED],
    ['with a missed Free Play problem and a retried daily', RELEASED_MISSED],
  ])('loads every record %s without replacing it with a default', async (_label, records) => {
    const kv = kvOf(records);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(records['tg.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(records['tg.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(records['tg.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(records['tg.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(JSON.parse(records['tg.saveDaily']));
  });

  it('loads the first problem of the install, as dealt, with an empty move list', async () => {
    const kv = createMemoryKV({ [TG_STORAGE_KEYS.game]: RELEASED_FRESH_EASY });
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED_FRESH_EASY));
    const { free, daily } = await loadSavedGames(kv, CAPTURE_DAY);
    expect(daily).toBeNull();
    expect(free).not.toBeNull();
    expect(free!.mode).toBe('free');
    expect(free!.difficulty).toBe('easy');
    expect(free!.problem.numbers).toEqual(DOM_FRESH_EASY.slots);
    expect(free!.problem.target).toBe(DOM_FRESH_EASY.target);
    expect(free!.moves).toEqual([]);
    expect(free!.slots).toEqual(DOM_FRESH_EASY.slots);
    expect(free!.status).toBe('playing');
    expect(free!.elapsedSeconds).toBe(0);
  });

  it('reads the preference and every statistic as the build wrote them', async () => {
    const final = kvOf(RELEASED);
    expect((await loadRecord(prefsSchema, final)).difficulty).toBe('hard');
    expect(await loadRecord(statsSchema, final)).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 6, bestSeconds: 6 },
      medium: { played: 1, solved: 0, totalPlaySeconds: 12, bestSeconds: null },
      hard: { played: 1, solved: 0, totalPlaySeconds: 7, bestSeconds: null },
      // The daily was started twice (the solve and the retry) and cleared once.
      daily: { played: 2, totalPlaySeconds: 11 },
      dailyTimes: { [CAPTURE_DAY]: 5 },
    });

    const earlier = kvOf(RELEASED_MISSED);
    expect((await loadRecord(prefsSchema, earlier)).difficulty).toBe('medium');
    const stats = await loadRecord(statsSchema, earlier);
    expect(stats.hard).toEqual({ played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null });
    expect(stats.daily).toEqual({ played: 2, totalPlaySeconds: 11 });
    expect(stats.dailyTimes).toEqual({ [CAPTURE_DAY]: 5 });
  });

  it('restores the Hard problem two merges in and the retried daily one merge in', async () => {
    const { free, daily } = await loadSavedGames(kvOf(RELEASED), CAPTURE_DAY);

    expect(free).not.toBeNull();
    expect(free!.mode).toBe('free');
    expect(free!.difficulty).toBe('hard');
    expect(free!.seed).toBe('make-the-target-hard-mvtedetl-85w69');
    expect(free!.dailyDate).toBeNull();
    expect(free!.problem.numbers).toEqual([2, 3, 3, 7, 15]);
    expect(free!.problem.target).toBe(151);
    expect(free!.moves).toHaveLength(2);
    expect(free!.slots).toEqual(DOM_HARD.slots);
    expect(linesOf(free!)).toEqual(DOM_HARD.lines);
    expect(free!.status).toBe('playing');
    expect(free!.repeat).toBe(false);
    expect(free!.elapsedSeconds).toBe(7);

    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.difficulty).toBe('medium');
    expect(daily!.seed).toBe('make-the-target-daily-2026-10-29');
    expect(daily!.dailyDate).toBe(CAPTURE_DAY);
    expect(daily!.problem.numbers).toEqual([4, 5, 10, 10]);
    expect(daily!.problem.target).toBe(44);
    expect(daily!.moves).toHaveLength(1);
    expect(daily!.slots).toEqual(DOM_DAILY.slots);
    expect(linesOf(daily!)).toEqual(DOM_DAILY.lines);
    expect(daily!.status).toBe('playing');
    expect(daily!.repeat).toBe(false);
    expect(daily!.elapsedSeconds).toBe(6);
  });

  it('restores the Medium problem left on its missed panel', async () => {
    const { free, daily } = await loadSavedGames(kvOf(RELEASED_MISSED), CAPTURE_DAY);
    expect(daily).not.toBeNull();
    expect(daily!.slots).toEqual(DOM_DAILY.slots);

    expect(free).not.toBeNull();
    expect(free!.mode).toBe('free');
    expect(free!.difficulty).toBe('medium');
    expect(free!.seed).toBe('make-the-target-medium-mvtecrux-6sezb');
    expect(free!.problem.numbers).toEqual([1, 1, 3, 3, 7]);
    expect(free!.problem.target).toBe(DOM_MISSED.target);
    // Every merge made: four moves for five numbers, one number left and it is not the target.
    expect(free!.moves).toHaveLength(4);
    expect(free!.slots).toEqual(DOM_MISSED.slots);
    expect(lastNumber(free!.slots)).toBe(15);
    expect(DOM_MISSED.panel).toBe('That makes 15, not 30.');
    expect(linesOf(free!)).toEqual(DOM_MISSED.lines);
    expect(free!.status).toBe('missed');
    expect(free!.elapsedSeconds).toBe(12);
  });

  it('drops a daily from another day on load, as the published build did, and keeps Free Play', async () => {
    const kv = kvOf(RELEASED);
    const { free, daily } = await loadSavedGames(kv, '2026-10-30');
    expect(daily).toBeNull();
    expect(free).not.toBeNull();
    expect(free!.difficulty).toBe('hard');
    expect(await kv.get(TG_STORAGE_KEYS.dailyGame)).toBeNull();
    expect(await kv.get(TG_STORAGE_KEYS.game)).toBe(RELEASED['tg.saveGame']);
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const cases: [Record<string, string>, number, number][] = [
      [RELEASED, 1793269529918, 1793269520564],
      [RELEASED_MISSED, 1793269506401, 1793269520564],
    ];
    for (const [records, freeSavedAt, dailySavedAt] of cases) {
      const { free, daily } = await loadSavedGames(kvOf(records), CAPTURE_DAY);
      expect(free).not.toBeNull();
      expect(daily).not.toBeNull();
      expect(JSON.stringify(toPersisted(free!, freeSavedAt))).toBe(records['tg.saveGame']);
      expect(JSON.stringify(toPersisted(daily!, dailySavedAt))).toBe(records['tg.saveDaily']);
    }
    const fresh = await loadSavedGames(
      createMemoryKV({ [TG_STORAGE_KEYS.game]: RELEASED_FRESH_EASY }),
      CAPTURE_DAY,
    );
    expect(JSON.stringify(toPersisted(fresh.free!, 1793269483598))).toBe(RELEASED_FRESH_EASY);
  });
});
