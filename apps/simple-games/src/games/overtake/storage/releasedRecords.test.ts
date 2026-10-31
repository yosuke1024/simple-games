/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (real key presses and clicks; no storage writes, no calls into the
 * app). The car was driven with the held arrow keys (left / right steer,
 * down brakes), which work in both control forms; a script read the canvas
 * pixels (traffic colour, the car) only to decide which key to hold:
 *   1. First visit: Quick Rules Next, Next, Start Playing (writes ot.flags
 *      and opens Level 1, waiting for the start; Drag is the default form).
 *   2. Level 1: Space to start, driven to the line: 1st place, 0 bumps —
 *      "Level 1 cleared" (writes ot.progress, highestUnlocked 2).
 *   3. Next Level -> Level 2: driven to the line, 1st place, 0 bumps
 *      (highestUnlocked 3).
 *   4. Next Level -> Level 3: started, driven about 12 s, then the Home
 *      arrow while the race was still on (leaving books the seconds).
 *   5. Home: Controls -> Buttons (writes ot.prefs), Play (Level 3); about
 *      8 s, then the top-bar retry; about 8 s more, then the Home arrow.
 *   Five races were started in all, so played is 5.
 *
 * All four declared keys were captured: ot.progress, ot.stats, ot.flags,
 * ot.prefs. Overtake has no saved race and no daily on purpose
 * (docs/OVERTAKE_RULES.md §9), so there is no suspended-game record to freeze
 * and no "to persisted" function to round-trip. The drag mapping is a
 * constant, not a stored choice, so ot.prefs only ever holds Drag or Buttons.
 * Only Levels 1-2 were won, so a frontier past 3 and the "all cleared" value
 * 101 are not represented here.
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { CONTROLS, DEFAULT_CONTROLS, clearedCount, isUnlocked, playableLevel } from '../game';
import { flagsSchema, prefsSchema, progressSchema, statsSchema } from './schemas';

const RELEASED = {
  'ot.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'ot.stats': '{"schemaVersion":1,"played":5,"totalPlaySeconds":104}',
  'ot.prefs': '{"schemaVersion":1,"controls":"buttons"}',
  'ot.progress': '{"schemaVersion":1,"highestUnlocked":3}',
};

describe('records written by the published Overtake build', () => {
  it('loads all four original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['ot.flags']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['ot.stats']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['ot.prefs']));
    expect(await loadRecord(progressSchema, kv)).toEqual(JSON.parse(RELEASED['ot.progress']));
  });

  it('reads the frontier: Levels 1 and 2 were won, so Play opens Level 3', async () => {
    const progress = await loadRecord(progressSchema, createMemoryKV(RELEASED));
    expect(progress.highestUnlocked).toBe(3);
    expect(playableLevel(progress.highestUnlocked)).toBe(3);
    expect(clearedCount(progress.highestUnlocked)).toBe(2);
    expect(isUnlocked(progress.highestUnlocked, 3)).toBe(true);
    expect(isUnlocked(progress.highestUnlocked, 4)).toBe(false);
  });

  it('reads the counts, and the remembered controls apart from the default', async () => {
    const kv = createMemoryKV(RELEASED);
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.played).toBe(5);
    expect(stats.totalPlaySeconds).toBe(104);
    // Buttons is the player's choice here; the default is Drag.
    expect(DEFAULT_CONTROLS).toBe('drag');
    expect(CONTROLS).toContain('buttons');
    expect((await loadRecord(prefsSchema, kv)).controls).toBe('buttons');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
  });

  it('reads each record back as exactly the string the published build wrote', async () => {
    // The validators rebuild the record from what they read; a field they
    // dropped, renamed or reordered would show here as a different string.
    const kv = createMemoryKV(RELEASED);
    expect(JSON.stringify(await loadRecord(flagsSchema, kv))).toBe(RELEASED['ot.flags']);
    expect(JSON.stringify(await loadRecord(statsSchema, kv))).toBe(RELEASED['ot.stats']);
    expect(JSON.stringify(await loadRecord(prefsSchema, kv))).toBe(RELEASED['ot.prefs']);
    expect(JSON.stringify(await loadRecord(progressSchema, kv))).toBe(RELEASED['ot.progress']);
  });
});
