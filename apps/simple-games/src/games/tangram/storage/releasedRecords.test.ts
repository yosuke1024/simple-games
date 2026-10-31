/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780)
 * with every non-localhost request aborted; its game assets were unchanged.
 *
 * UI steps (real mouse input only — taps on pieces to turn them, the Flip
 * button, and press-move-release drags from the tray onto the SVG board with
 * page.mouse; no storage writes, no calls into the game, no clock mocking. A
 * separate planner worked out where each piece had to be dropped from the
 * silhouette the page drew). Finish Quick Rules (Next, Next, Start Playing,
 * which deals Easy 1 — RELEASED_FRESH_EASY1 is the save at that moment);
 * drag all seven pieces into place (the figure completes; its slot is
 * cleared and `tn.progress` gets a best time); Next figure on the result card
 * (Easy 2); drag three pieces — the parallelogram flipped — and Home. Home >
 * Daily Challenge (today's Medium figure, with its two fixed pieces): drag
 * the other five (a `dailyTimes` entry is written), Retry same board on the
 * result card, drag two pieces and Home (RELEASED_EASY2 is the storage at
 * that moment). Home > Hard, confirm replacing Easy 2, drag three pieces,
 * Home (RELEASED is the storage at the end).
 *
 * Captured: all six declared keys — tn.flags, tn.prefs, tn.progress,
 * tn.stats, tn.saveGame and tn.saveDaily — with both slots filled. The
 * `DOM_*` constants are what the published build drew when each save was
 * written (each placed or fixed piece's vertices in silhouette units,
 * measured from the page's SVG polygons, and which pieces were still in the
 * tray), so the restored boards are checked against the published rendering
 * and not against today's serializer. Pivots are included: Easy 2's large
 * triangle 1 has a pivot (`pv`) that is not its `at`. The daily belongs to
 * 2026-10-29 (the day of the capture; the tests pass that date as "today",
 * because a daily from any other day is deleted on load by design) and is the
 * figure `tree`. Not captured: a Medium Free Play figure (the daily is the
 * Medium one that was played), a save with a piece turned in the tray and left
 * there (tray turns are not saved), and a save of a finished figure (none
 * exists by design).
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { poseVertices, ptToFloat, type PieceId, type TangramSession } from '../game';
import { loadSavedGames, toPersisted } from './gamePersistence';
import {
  TN_STORAGE_KEYS,
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  prefsSchema,
  progressSchema,
  statsSchema,
} from './schemas';

/** The day of the capture; the daily records below are today's only on this date. */
const CAPTURE_DAY = '2026-10-29';

/** Storage at the end of the capture: a Hard figure three pieces in, the daily retried two pieces in. */
const RELEASED = {
  'tn.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'tn.prefs': '{"schemaVersion":1,"tier":"hard"}',
  'tn.progress':
    '{"schemaVersion":1,"best":{"square":17},"last":{"easy":"triangle","hard":"mushroom"}}',
  'tn.stats':
    '{"schemaVersion":1,"easy":{"played":2,"solved":1,"totalPlaySeconds":29},"medium":{"played":0,"solved":0,"totalPlaySeconds":0},"hard":{"played":1,"solved":0,"totalPlaySeconds":12},"daily":{"played":2,"totalPlaySeconds":23},"dailyTimes":{"2026-10-29":13}}',
  'tn.saveGame':
    '{"schemaVersion":1,"mode":"free","tier":"hard","figure":"mushroom","dailyDate":null,"pieces":{"L1":{"r":1,"f":0,"at":[0,2,0,0],"pv":[0,2,0,0]},"L2":{"r":6,"f":0,"at":[0,4,4,0],"pv":[0,4,4,0]},"P":{"r":4,"f":0,"at":[4,4,2,0],"pv":[4,4,2,0]}},"elapsedSeconds":12,"savedAt":1793270388855}',
  'tn.saveDaily':
    '{"schemaVersion":1,"mode":"daily","tier":"medium","figure":"tree","dailyDate":"2026-10-29","pieces":{"L2":{"r":6,"f":0,"at":[0,3,4,3],"pv":[0,3,4,3]},"M":{"r":6,"f":0,"at":[0,3,0,3],"pv":[0,3,0,3]}},"elapsedSeconds":10,"savedAt":1793270375238}',
};
/**
 * Storage after the daily was retried and left (Home), while the Free Play slot held Easy 2 with
 * three pieces placed: both slots filled at once, no tier chosen on the home yet — so `tn.prefs`
 * does not exist at this point (it is written only when a tier button is pressed there).
 */
const RELEASED_EASY2 = {
  'tn.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'tn.progress': '{"schemaVersion":1,"best":{"square":17},"last":{"easy":"triangle"}}',
  'tn.stats':
    '{"schemaVersion":1,"easy":{"played":2,"solved":1,"totalPlaySeconds":29},"medium":{"played":0,"solved":0,"totalPlaySeconds":0},"hard":{"played":0,"solved":0,"totalPlaySeconds":0},"daily":{"played":2,"totalPlaySeconds":23},"dailyTimes":{"2026-10-29":13}}',
  'tn.saveGame':
    '{"schemaVersion":1,"mode":"free","tier":"easy","figure":"triangle","dailyDate":null,"pieces":{"L1":{"r":1,"f":0,"at":[0,2,0,2],"pv":[0,0,0,4]},"L2":{"r":7,"f":0,"at":[0,2,0,2],"pv":[0,2,0,2]},"P":{"r":1,"f":1,"at":[0,8,0,4],"pv":[0,8,0,4]}},"elapsedSeconds":12,"savedAt":1793270347821}',
  'tn.saveDaily':
    '{"schemaVersion":1,"mode":"daily","tier":"medium","figure":"tree","dailyDate":"2026-10-29","pieces":{"L2":{"r":6,"f":0,"at":[0,3,4,3],"pv":[0,3,4,3]},"M":{"r":6,"f":0,"at":[0,3,0,3],"pv":[0,3,0,3]}},"elapsedSeconds":10,"savedAt":1793270375238}',
};
/** The first figure of the install, as dealt: Quick Rules start Easy 1 and nothing is on the board (`pieces` is empty). */
const RELEASED_FRESH_EASY1 =
  '{"schemaVersion":1,"mode":"free","tier":"easy","figure":"square","dailyDate":null,"pieces":{},"elapsedSeconds":0,"savedAt":1793270316415}';

type Units = [number, number][];
interface DomBoard {
  /** Pieces dropped on the board by the player, with the vertices the page drew (silhouette units). */
  placed: Partial<Record<PieceId, Units>>;
  /** Medium's fixed pieces, drawn "fixed in place". */
  fixed: Partial<Record<PieceId, Units>>;
  /** Pieces the page still showed in the tray, unturned. */
  tray: PieceId[];
}

/** What the page drew when each of those saves was written. */
const DOM_EASY2: DomBoard = {
  placed: {
    L1: [
      [2.828, 2.828],
      [5.657, 5.657],
      [0, 5.657],
    ],
    L2: [
      [2.828, 2.828],
      [5.657, 0],
      [5.657, 5.657],
    ],
    P: [
      [11.314, 5.657],
      [9.899, 4.243],
      [7.071, 4.243],
      [8.485, 5.657],
    ],
  },
  fixed: {},
  tray: ['M', 'SQ', 'S1', 'S2'],
};
const DOM_TREE: DomBoard = {
  placed: {
    L2: [
      [4.243, 8.242],
      [4.243, 4.243],
      [8.242, 8.242],
    ],
    M: [
      [4.243, 4.242],
      [4.243, 1.414],
      [7.071, 4.242],
    ],
  },
  fixed: {
    L1: [
      [4.242, 8.242],
      [0.243, 8.242],
      [4.242, 4.243],
    ],
    P: [
      [2.828, 0],
      [4.242, 1.414],
      [4.242, 4.243],
      [2.828, 2.829],
    ],
  },
  tray: ['SQ', 'S1', 'S2'],
};
const DOM_MUSHROOM: DomBoard = {
  placed: {
    L1: [
      [2.828, 0],
      [5.657, 2.828],
      [0, 2.828],
    ],
    L2: [
      [5.657, 4],
      [5.657, 0],
      [9.656, 4],
    ],
    P: [
      [9.656, 2],
      [7.656, 2],
      [5.657, 0],
      [7.656, 0],
    ],
  },
  fixed: {},
  tray: ['M', 'SQ', 'S1', 'S2'],
};

const kvOf = (records: Record<string, string>) => createMemoryKV({ ...records });

/** The restored board agrees with the page: same vertices, same fixed pieces, same tray. */
function expectBoardAs(session: TangramSession, dom: DomBoard) {
  const onBoard = Object.keys(dom.placed).concat(Object.keys(dom.fixed)).sort();
  expect(Object.keys(session.board).sort()).toEqual(onBoard);
  for (const [id, units] of Object.entries({ ...dom.placed, ...dom.fixed })) {
    const vertices = poseVertices(id as PieceId, session.board[id as PieceId]!).map(ptToFloat);
    expect(vertices).toHaveLength(units.length);
    vertices.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(units[i]![0], 2);
      expect(y).toBeCloseTo(units[i]![1], 2);
    });
  }
  for (const id of Object.keys(dom.fixed)) {
    // A fixed piece pivots on its own vertex 0 and is never written to a record.
    expect(session.board[id as PieceId]!.pv).toEqual(session.board[id as PieceId]!.at);
  }
  for (const id of dom.tray) {
    expect(session.board[id as PieceId]).toBeUndefined();
    expect(session.tray[id as PieceId]).toEqual({ r: 0, f: 0 });
  }
}

describe('records written by the published Tangram build', () => {
  it('declares the six keys the build wrote (tn.prefs only once a tier button was pressed)', () => {
    expect(Object.keys(RELEASED).sort()).toEqual(Object.values(TN_STORAGE_KEYS).sort());
    expect(Object.keys(RELEASED_EASY2).sort()).toEqual(
      Object.values(TN_STORAGE_KEYS)
        .filter((key) => key !== TN_STORAGE_KEYS.prefs)
        .sort(),
    );
  });

  it('loads every record at the end of the capture without replacing it with a default', async () => {
    const kv = kvOf(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['tn.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['tn.prefs']));
    expect(await loadRecord(progressSchema, kv)).toEqual(JSON.parse(RELEASED['tn.progress']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['tn.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['tn.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(JSON.parse(RELEASED['tn.saveDaily']));
  });

  it('loads every record from the Easy 2 moment without replacing it with a default', async () => {
    const kv = kvOf(RELEASED_EASY2);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED_EASY2['tn.flags']));
    expect(await loadRecord(progressSchema, kv)).toEqual(JSON.parse(RELEASED_EASY2['tn.progress']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED_EASY2['tn.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED_EASY2['tn.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(
      JSON.parse(RELEASED_EASY2['tn.saveDaily']),
    );
  });

  it('reads the preference, the progress and every statistic as the build wrote them', async () => {
    const kv = kvOf(RELEASED);
    expect((await loadRecord(prefsSchema, kv)).tier).toBe('hard');
    expect(await loadRecord(progressSchema, kv)).toEqual({
      schemaVersion: 1,
      best: { square: 17 },
      last: { easy: 'triangle', hard: 'mushroom' },
    });
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      easy: { played: 2, solved: 1, totalPlaySeconds: 29 },
      medium: { played: 0, solved: 0, totalPlaySeconds: 0 },
      hard: { played: 1, solved: 0, totalPlaySeconds: 12 },
      // The daily was started twice (the solve and the retry) and completed once;
      // it never writes `last.medium` into the progress record.
      daily: { played: 2, totalPlaySeconds: 23 },
      dailyTimes: { [CAPTURE_DAY]: 13 },
    });

    const earlier = kvOf(RELEASED_EASY2);
    expect(await loadRecord(progressSchema, earlier)).toEqual({
      schemaVersion: 1,
      best: { square: 17 },
      last: { easy: 'triangle' },
    });
    const stats = await loadRecord(statsSchema, earlier);
    expect(stats.hard).toEqual({ played: 0, solved: 0, totalPlaySeconds: 0 });
    expect(stats.daily).toEqual({ played: 2, totalPlaySeconds: 23 });
  });

  it('restores the first figure of the install with every piece in the tray', async () => {
    const kv = createMemoryKV({ [TN_STORAGE_KEYS.game]: RELEASED_FRESH_EASY1 });
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED_FRESH_EASY1));
    const { free, daily } = await loadSavedGames(kv, CAPTURE_DAY);
    expect(daily).toBeNull();
    expect(free).not.toBeNull();
    expect(free!.figure.id).toBe('square');
    expect(free!.figure.tier).toBe('easy');
    expect(free!.mode).toBe('free');
    expect(free!.board).toEqual({});
    expect(free!.status).toBe('playing');
    expect(free!.elapsedSeconds).toBe(0);
    expect(free!.history).toEqual([]);
  });

  it('restores the Hard figure three pieces in and the retried daily two pieces in', async () => {
    const { free, daily } = await loadSavedGames(kvOf(RELEASED), CAPTURE_DAY);

    expect(free).not.toBeNull();
    expect(free!.mode).toBe('free');
    expect(free!.figure.id).toBe('mushroom');
    expect(free!.figure.tier).toBe('hard');
    expect(free!.dailyDate).toBeNull();
    expect(free!.board.L1).toEqual({ r: 1, f: 0, at: [0, 2, 0, 0], pv: [0, 2, 0, 0] });
    expect(free!.board.L2).toEqual({ r: 6, f: 0, at: [0, 4, 4, 0], pv: [0, 4, 4, 0] });
    expect(free!.board.P).toEqual({ r: 4, f: 0, at: [4, 4, 2, 0], pv: [4, 4, 2, 0] });
    expect(free!.status).toBe('playing');
    expect(free!.elapsedSeconds).toBe(12);
    // The undo history is not saved (docs/TANGRAM_RULES.md §3, §8).
    expect(free!.history).toEqual([]);
    expectBoardAs(free!, DOM_MUSHROOM);

    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.figure.id).toBe('tree');
    expect(daily!.figure.tier).toBe('medium');
    expect(daily!.dailyDate).toBe(CAPTURE_DAY);
    expect(daily!.board.L2).toEqual({ r: 6, f: 0, at: [0, 3, 4, 3], pv: [0, 3, 4, 3] });
    expect(daily!.board.M).toEqual({ r: 6, f: 0, at: [0, 3, 0, 3], pv: [0, 3, 0, 3] });
    expect(daily!.status).toBe('playing');
    expect(daily!.elapsedSeconds).toBe(10);
    expect(daily!.history).toEqual([]);
    expectBoardAs(daily!, DOM_TREE);
  });

  it('restores Easy 2 with its flipped parallelogram and a pivot that is not the piece origin', async () => {
    const { free, daily } = await loadSavedGames(kvOf(RELEASED_EASY2), CAPTURE_DAY);

    expect(free).not.toBeNull();
    expect(free!.figure.id).toBe('triangle');
    expect(free!.figure.tier).toBe('easy');
    expect(free!.board.L1).toEqual({ r: 1, f: 0, at: [0, 2, 0, 2], pv: [0, 0, 0, 4] });
    expect(free!.board.L2).toEqual({ r: 7, f: 0, at: [0, 2, 0, 2], pv: [0, 2, 0, 2] });
    expect(free!.board.P).toEqual({ r: 1, f: 1, at: [0, 8, 0, 4], pv: [0, 8, 0, 4] });
    expect(free!.elapsedSeconds).toBe(12);
    expectBoardAs(free!, DOM_EASY2);

    // The daily slot is independent of Free Play and the same record in both states.
    expect(daily).not.toBeNull();
    expect(daily!.figure.id).toBe('tree');
    expectBoardAs(daily!, DOM_TREE);
  });

  it('drops a daily from another day on load, as the published build did, and keeps Free Play', async () => {
    const kv = kvOf(RELEASED);
    const { free, daily } = await loadSavedGames(kv, '2026-10-30');
    expect(daily).toBeNull();
    expect(free).not.toBeNull();
    expect(free!.figure.id).toBe('mushroom');
    expect(await kv.get(TN_STORAGE_KEYS.dailyGame)).toBeNull();
    expect(await kv.get(TN_STORAGE_KEYS.game)).toBe(RELEASED['tn.saveGame']);
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const cases: [Record<string, string>, number, number][] = [
      [RELEASED, 1793270388855, 1793270375238],
      [RELEASED_EASY2, 1793270347821, 1793270375238],
    ];
    for (const [records, freeSavedAt, dailySavedAt] of cases) {
      const { free, daily } = await loadSavedGames(kvOf(records), CAPTURE_DAY);
      expect(free).not.toBeNull();
      expect(daily).not.toBeNull();
      expect(JSON.stringify(toPersisted(free!, freeSavedAt))).toBe(records['tn.saveGame']);
      expect(JSON.stringify(toPersisted(daily!, dailySavedAt))).toBe(records['tn.saveDaily']);
    }
    const fresh = await loadSavedGames(
      createMemoryKV({ [TN_STORAGE_KEYS.game]: RELEASED_FRESH_EASY1 }),
      CAPTURE_DAY,
    );
    expect(JSON.stringify(toPersisted(fresh.free!, 1793270316415))).toBe(RELEASED_FRESH_EASY1);
  });
});
