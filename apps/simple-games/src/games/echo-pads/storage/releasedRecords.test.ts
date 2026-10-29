/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (all real clicks; no storage writes, no calls into the app). The
 * script learned each sequence the way a player does — by watching which pad
 * lit during playback — and tapped it back:
 *   1. First visit: Quick Rules Next, Next, Start Playing (opens Level 1).
 *      Round 3 played at Normal; Pace -> Quick (writes ep.prefs); round 4
 *      played, then Listen again once, tapped back: Level 1 cleared.
 *   2. Next Level -> Level 2 (4 pads, length 5): round 3 cleared; round 4
 *      played and tapped wrong on the second pad: the run ends (a miss).
 *      Listen again once on the miss panel, then New sequence (attempt 1),
 *      round 3 cleared, Home arrow (suspends it at round 4).
 *   3. Home -> Levels -> Level 12 (6 pads, length 4), confirming the
 *      replacement of the suspended Level 2 run: cleared.
 *   4. Home -> Daily Challenge (2026-10-29, 6 pads, length 10): every round
 *      3..10 played and tapped back at Quick: cleared.
 *   5. Home -> Daily Challenge again (a fresh attempt): round 3 cleared,
 *      round 4 played and Listen again, then the Home arrow.
 *   6. Home -> the suggested Level 2 (attempt 2): round 3 cleared at Quick,
 *      Pace -> Calm, round 4 played, the first two pads tapped, Home arrow.
 *
 * All six declared keys were captured: ep.saveGame, ep.saveDaily,
 * ep.progress, ep.stats, ep.flags, ep.prefs. Nothing declared in keys.ts was
 * left out. The two suspended runs are the ones left at steps 5 and 6.
 *
 * Besides storage, the script noted which pads lit during playback (the
 * `ep-pad-lit` class, watched with a MutationObserver). Those pads are the
 * ground truth for "this seed still gives the sequence the player heard":
 *   level 2, attempt 2: round 3 = 1 3 3, round 4 = 1 3 3 2
 *   daily 2026-10-29, attempt 1: round 3 = 0 3 5, round 4 = 0 3 5 5
 * They are not storage records.
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRaw, loadRecord } from '../../../storage/repo';
import { LEVEL_COUNT, isUnlocked } from '../game';
import { loadSavedGames, soleSuspendedMode, toPersisted } from './gamePersistence';
import {
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  prefsSchema,
  progressSchema,
  statsSchema,
} from './schemas';

const RELEASED = {
  'ep.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'ep.progress':
    '{"schemaVersion":1,"cleared":[true,false,false,false,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false,false,false,false],"nextAttempt":[1,3,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],"daily":{"date":"2026-10-29","nextAttempt":2}}',
  'ep.saveGame':
    '{"schemaVersion":1,"mode":"level","level":2,"dailyDate":null,"attempt":2,"round":4,"inputStarted":true,"roundPlays":1,"replays":0,"pacesHeard":["quick","calm"],"elapsedSeconds":9,"savedAt":1793269502215}',
  'ep.prefs': '{"schemaVersion":1,"pace":"calm"}',
  'ep.stats':
    '{"schemaVersion":1,"rows":{"pads4":{"played":4,"cleared":1,"failed":1,"seconds":27},"pads6":{"played":1,"cleared":1,"failed":0,"seconds":6},"daily":{"played":2,"cleared":1,"failed":0,"seconds":46}},"dailyDates":["2026-10-29"]}',
  'ep.saveDaily':
    '{"schemaVersion":1,"mode":"daily","level":null,"dailyDate":"2026-10-29","attempt":1,"round":4,"inputStarted":false,"roundPlays":2,"replays":1,"pacesHeard":["quick"],"elapsedSeconds":8,"savedAt":1793269492188}',
};

/** The day the capture ran; the daily slot only survives on its own date. */
const CAPTURE_DAY = '2026-10-29';

describe('records written by the published Echo Pads build', () => {
  it('loads all six original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['ep.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['ep.prefs']));
    expect(await loadRecord(progressSchema, kv)).toEqual(JSON.parse(RELEASED['ep.progress']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['ep.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['ep.saveGame']));
    expect(await loadRecord(dailyGameSchema, kv)).toEqual(JSON.parse(RELEASED['ep.saveDaily']));
  });

  it('reads the progress: Level 1 and Level 12 cleared, attempts handed out, today’s daily', async () => {
    const progress = await loadRecord(progressSchema, createMemoryKV(RELEASED));
    expect(progress.cleared).toHaveLength(LEVEL_COUNT);
    expect(progress.cleared.flatMap((done, index) => (done ? [index + 1] : []))).toEqual([1, 12]);
    // Level 1 was run once, Level 2 three times (one miss, one replaced, one suspended),
    // Level 12 once.
    expect(progress.nextAttempt.slice(0, 3)).toEqual([1, 3, 0]);
    expect(progress.nextAttempt[11]).toBe(1);
    expect(progress.daily).toEqual({ date: CAPTURE_DAY, nextAttempt: 2 });
    // Level 2 is open because Level 1 is cleared; Level 3 is not.
    expect(isUnlocked(progress, 2)).toBe(true);
    expect(isUnlocked(progress, 3)).toBe(false);
    expect(isUnlocked(progress, 13)).toBe(true);
  });

  it('reads every statistics row, the cleared day, and the Pace', async () => {
    const kv = createMemoryKV(RELEASED);
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.rows.pads4).toEqual({ played: 4, cleared: 1, failed: 1, seconds: 27 });
    expect(stats.rows.pads6).toEqual({ played: 1, cleared: 1, failed: 0, seconds: 6 });
    expect(stats.rows.daily).toEqual({ played: 2, cleared: 1, failed: 0, seconds: 46 });
    expect(stats.dailyDates).toEqual([CAPTURE_DAY]);
    expect((await loadRecord(prefsSchema, kv)).pace).toBe('calm');
  });

  it('restores the suspended Level 2 run, left after its first tap of round 4', async () => {
    const progress = await loadRecord(progressSchema, createMemoryKV(RELEASED));
    const saved = await loadSavedGames(progress, createMemoryKV(RELEASED), CAPTURE_DAY);
    const run = saved.level;
    expect(run).not.toBeNull();
    expect(run!.mode).toBe('level');
    expect(run!.level).toBe(2);
    expect(run!.dailyDate).toBeNull();
    expect(run!.attempt).toBe(2);
    expect(run!.seed).toBe('echo-level-2-r2');
    expect(run!.padCount).toBe(4);
    expect(run!.target).toBe(5);
    // The seed gives the sequence the player heard on screen: 1 3 3 in round 3, 1 3 3 2 in round 4.
    expect(run!.sequence).toHaveLength(5);
    expect(run!.sequence.slice(0, 4)).toEqual([1, 3, 3, 2]);
    expect(run!.round).toBe(4);
    // Input had begun, so ▶ stays withheld and the pads are pressed again from the first.
    expect(run!.inputStarted).toBe(true);
    expect(run!.inputCount).toBe(0);
    expect(run!.status).toBe('awaiting-input');
    expect(run!.roundPlays).toBe(1);
    expect(run!.replays).toBe(0);
    expect(run!.pacesHeard).toEqual(['quick', 'calm']);
    expect(run!.failure).toBeNull();
    expect(run!.elapsedSeconds).toBe(9);
  });

  it('restores today’s suspended daily, left after hearing round 4 twice', async () => {
    const progress = await loadRecord(progressSchema, createMemoryKV(RELEASED));
    const saved = await loadSavedGames(progress, createMemoryKV(RELEASED), CAPTURE_DAY);
    const run = saved.daily;
    expect(run).not.toBeNull();
    expect(run!.mode).toBe('daily');
    expect(run!.level).toBeNull();
    expect(run!.dailyDate).toBe(CAPTURE_DAY);
    expect(run!.attempt).toBe(1);
    expect(run!.seed).toBe('echo-daily-2026-10-29-r1');
    expect(run!.padCount).toBe(6);
    expect(run!.target).toBe(10);
    // Round 3 heard 0 3 5, round 4 heard 0 3 5 5.
    expect(run!.sequence).toHaveLength(10);
    expect(run!.sequence.slice(0, 4)).toEqual([0, 3, 5, 5]);
    expect(run!.round).toBe(4);
    expect(run!.inputStarted).toBe(false);
    expect(run!.inputCount).toBe(0);
    expect(run!.status).toBe('awaiting-input');
    expect(run!.roundPlays).toBe(2);
    expect(run!.replays).toBe(1);
    expect(run!.pacesHeard).toEqual(['quick']);
    expect(run!.elapsedSeconds).toBe(8);

    // Two suspended runs, so a home-screen shortcut has no single answer (#113).
    expect(soleSuspendedMode(saved)).toBeNull();
  });

  it('writes each restored run back byte for byte at its original save time', async () => {
    const progress = await loadRecord(progressSchema, createMemoryKV(RELEASED));
    const saved = await loadSavedGames(progress, createMemoryKV(RELEASED), CAPTURE_DAY);
    expect(JSON.stringify(toPersisted(saved.level!, 1793269502215))).toBe(RELEASED['ep.saveGame']);
    expect(JSON.stringify(toPersisted(saved.daily!, 1793269492188))).toBe(RELEASED['ep.saveDaily']);
  });

  it('drops the published daily on any other day, and keeps the Level 2 run', async () => {
    const kv = createMemoryKV(RELEASED);
    const progress = await loadRecord(progressSchema, kv);
    const saved = await loadSavedGames(progress, kv, '2026-10-30');
    expect(saved.daily).toBeNull();
    expect(saved.level).not.toBeNull();
    expect(saved.level!.seed).toBe('echo-level-2-r2');
    expect(await loadRaw('ep.saveDaily', kv)).toBeNull();
    expect(await loadRaw('ep.saveGame', kv)).toBe(RELEASED['ep.saveGame']);
  });
});
