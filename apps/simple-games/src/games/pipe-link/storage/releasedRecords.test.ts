/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (all real clicks; no storage writes, no calls into the app). The
 * script read each board's tile labels off the screen, searched for the
 * arrangement in which every tile is lit, and turned the tiles by clicking
 * them:
 *   1. First visit: Quick Rules Next, Next, Start Playing (writes pn.flags
 *      and starts an Easy board). Solved it: 7 s.
 *   2. Home: Daily Challenge (today's board, 2026-10-29), solved: 8 s.
 *   3. Home: Medium. Seven tile clicks, Hint once, Undo once, three more
 *      clicks, then the Home arrow: the difficulty slot is suspended.
 *   4. Home: Daily Challenge again (the first run was already cleared, so it
 *      is a fresh run of today's board). Five tile clicks, Hint once, then
 *      the Home arrow: the daily slot is suspended too.
 *
 * All five declared keys were captured: pn.saveGame, pn.saveDaily, pn.stats,
 * pn.flags, pn.prefs. Nothing declared in keys.ts was left out. No Hard board
 * was started, so that stats row is still the empty one, and the stored
 * `bestSeconds: null` for Medium and Hard is a real "no clear yet".
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, loadRaw } from '../../../storage/repo';
import { encodeOrientations, encodeTypes, isSolved } from '../game';
import { loadSavedGames, toPersisted } from './gamePersistence';
import { dailyGameSchema, flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'pn.prefs': '{"schemaVersion":1,"difficulty":"medium"}',
  'pn.saveDaily':
    '{"schemaVersion":1,"mode":"daily","seed":"pipe-link-daily-2026-10-29","difficulty":"medium","dailyDate":"2026-10-29","width":7,"height":7,"types":"ltteeelseseteseeltttlettttlllslltleelttlllelleeel","source":25,"solution":"1113212000203002020131313202113132001132021303013","initial":"3122221130233011023210000200100121220310211323230","current":"3132221130233111023210001200100121230310211323330","hintCount":1,"elapsedSeconds":2,"savedAt":1793269060252}',
  'pn.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'pn.saveGame':
    '{"schemaVersion":1,"mode":"difficulty","seed":"pipe-link-medium-mvte3bou-5prn1","difficulty":"medium","dailyDate":null,"width":7,"height":7,"types":"lteleeletltseseltttsleltltslltlsteseellteeetletse","source":16,"solution":"1131312002013013031131202012133003002130301331313","initial":"1221301322202132313021213111012033132011330030211","current":"1222311323202102013021213212012033133011330030201","hintCount":1,"elapsedSeconds":5,"savedAt":1793269056538}',
  'pn.stats':
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":7,"bestSeconds":7},"medium":{"played":1,"solved":0,"totalPlaySeconds":5,"bestSeconds":null},"hard":{"played":0,"solved":0,"totalPlaySeconds":0,"bestSeconds":null},"daily":{"played":2,"totalPlaySeconds":10},"dailyTimes":{"2026-10-29":8}}',
};

/** The day the capture ran; the daily slot only survives on its own date. */
const CAPTURE_DAY = '2026-10-29';

const digits = (text: string): number[] => Array.from(text, Number);

describe('records written by the published Pipe Link build', () => {
  it('loads all five original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['pn.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['pn.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['pn.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['pn.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(JSON.parse(RELEASED['pn.saveDaily']));
  });

  it('reads every statistic, including the daily row and the cleared day', async () => {
    const stats = await loadRecord(statsSchema, createMemoryKV(RELEASED));
    expect(stats.easy).toEqual({ played: 1, solved: 1, totalPlaySeconds: 7, bestSeconds: 7 });
    expect(stats.medium).toEqual({ played: 1, solved: 0, totalPlaySeconds: 5, bestSeconds: null });
    expect(stats.hard).toEqual({ played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null });
    expect(stats.daily).toEqual({ played: 2, totalPlaySeconds: 10 });
    expect(stats.dailyTimes).toEqual({ [CAPTURE_DAY]: 8 });
  });

  it('restores the suspended Medium board and today’s suspended daily, side by side', async () => {
    const saved = await loadSavedGames(createMemoryKV(RELEASED), CAPTURE_DAY);

    const medium = saved.difficulty;
    expect(medium).not.toBeNull();
    expect(medium!.mode).toBe('difficulty');
    expect(medium!.seed).toBe('pipe-link-medium-mvte3bou-5prn1');
    expect(medium!.difficulty).toBe('medium');
    expect(medium!.dailyDate).toBeNull();
    expect(medium!.board.width).toBe(7);
    expect(medium!.board.height).toBe(7);
    expect(medium!.board.source).toBe(16);
    expect(encodeTypes(medium!.board.types)).toBe(
      'lteleeletltseseltttsleltltslltlsteseellteeetletse',
    );
    expect(medium!.board.types[0]).toBe('elbow');
    expect(medium!.board.types[1]).toBe('tee');
    expect(medium!.board.types[2]).toBe('end');
    expect(medium!.board.types[11]).toBe('straight');
    expect(medium!.initial).toEqual(digits('1221301322202132313021213111012033132011330030211'));
    expect(medium!.current).toEqual(digits('1222311323202102013021213212012033133011330030201'));
    expect(medium!.solution).toEqual(digits('1131312002013013031131202012133003002130301331313'));
    expect(medium!.status).toBe('playing');
    expect(medium!.hintCount).toBe(1);
    expect(medium!.elapsedSeconds).toBe(5);
    // The saved answer is a real solution of this board, and the board in play is not it.
    expect(isSolved(medium!.board, medium!.solution)).toBe(true);
    expect(isSolved(medium!.board, medium!.current)).toBe(false);
    // The undo history is deliberately not persisted (§6, §7).
    expect(medium!.history).toEqual([]);

    const daily = saved.daily;
    expect(daily).not.toBeNull();
    expect(daily!.mode).toBe('daily');
    expect(daily!.seed).toBe('pipe-link-daily-2026-10-29');
    expect(daily!.difficulty).toBe('medium');
    expect(daily!.dailyDate).toBe(CAPTURE_DAY);
    expect(daily!.board.width).toBe(7);
    expect(daily!.board.height).toBe(7);
    expect(daily!.board.source).toBe(25);
    expect(encodeTypes(daily!.board.types)).toBe(
      'ltteeelseseteseeltttlettttlllslltleelttlllelleeel',
    );
    expect(daily!.initial).toEqual(digits('3122221130233011023210000200100121220310211323230'));
    expect(daily!.current).toEqual(digits('3132221130233111023210001200100121230310211323330'));
    expect(daily!.solution).toEqual(digits('1113212000203002020131313202113132001132021303013'));
    expect(daily!.status).toBe('playing');
    expect(daily!.hintCount).toBe(1);
    expect(daily!.elapsedSeconds).toBe(2);
    expect(isSolved(daily!.board, daily!.solution)).toBe(true);
    expect(isSolved(daily!.board, daily!.current)).toBe(false);

    // The remembered difficulty is the last one chosen, independent of the slots.
    expect((await loadRecord(prefsSchema, createMemoryKV(RELEASED))).difficulty).toBe('medium');
  });

  it('writes each restored board back byte for byte at its original save time', async () => {
    const saved = await loadSavedGames(createMemoryKV(RELEASED), CAPTURE_DAY);
    expect(JSON.stringify(toPersisted(saved.difficulty!, 1793269056538))).toBe(
      RELEASED['pn.saveGame'],
    );
    expect(JSON.stringify(toPersisted(saved.daily!, 1793269060252))).toBe(RELEASED['pn.saveDaily']);
    // The orientation strings in the records are the encoder's, digit for digit.
    expect(encodeOrientations(saved.daily!.current)).toBe(
      '3132221130233111023210001200100121230310211323330',
    );
  });

  it('drops the published daily on any other day, and keeps the Medium board', async () => {
    const kv = createMemoryKV(RELEASED);
    const saved = await loadSavedGames(kv, '2026-10-30');
    expect(saved.daily).toBeNull();
    expect(saved.difficulty).not.toBeNull();
    expect(saved.difficulty!.seed).toBe('pipe-link-medium-mvte3bou-5prn1');
    expect(await loadRaw('pn.saveDaily', kv)).toBeNull();
    expect(await loadRaw('pn.saveGame', kv)).toBe(RELEASED['pn.saveGame']);
  });
});
