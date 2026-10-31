/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (real key presses and clicks; no storage writes, no calls into the
 * app). The run is steered by holding and releasing the arrow keys; a script
 * read the canvas pixels (platform colour, the body) only to decide which
 * arrow to hold:
 *   1. First visit: Quick Rules Next, Next, Start Playing (writes bo.flags
 *      and opens a Normal run waiting for its first input).
 *   2. Normal run 1: climbed about 20 s (18 points), then the top bar's
 *      "Climb again" (the instant retry books the run so far).
 *   3. Normal run 2: climbed about 12 s (87 points), then the Home arrow
 *      while the run was still going (leaving books the climb).
 *   4. Home: picked the Wide width (writes bo.prefs), Start Climbing.
 *      Wide run 3: about 20 s (138 points), then "Climb again".
 *      Wide run 4: about 10 s (126 points), then the Home arrow.
 *
 * All three declared keys were captured: bo.stats, bo.flags, bo.prefs.
 * Bounce Up has no saved run and no daily on purpose (docs/BOUNCE_UP_RULES.md
 * §5), so there is no suspended-game record to freeze and no "to persisted"
 * function to round-trip. No run in this capture ended by the body falling
 * off the screen — every one was ended by the player (retry or Home) — so
 * the fall-ended path is not represented here (it books through the same
 * single booking path, so it writes the same record shape).
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { flagsSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'bo.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'bo.stats':
    '{"schemaVersion":1,"played":4,"best":{"normal":87,"wide":138},"total":{"normal":105,"wide":264},"totalPlaySeconds":92}',
  'bo.prefs': '{"schemaVersion":1,"width":"wide"}',
};

describe('records written by the published Bounce Up build', () => {
  it('loads all three original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['bo.flags']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['bo.stats']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['bo.prefs']));
  });

  it('reads every statistic: runs, the best and the sum per width, and the climbing seconds', async () => {
    const stats = await loadRecord(statsSchema, createMemoryKV(RELEASED));
    expect(stats.played).toBe(4);
    expect(stats.best).toEqual({ normal: 87, wide: 138 });
    // The sums are of every run's score: 18 + 87 on Normal, 138 + 126 on Wide.
    expect(stats.total).toEqual({ normal: 105, wide: 264 });
    expect(stats.totalPlaySeconds).toBe(92);
    // What play can produce (§5): the best run is one of the runs the sum covers.
    expect(stats.best.normal).toBeLessThanOrEqual(stats.total.normal);
    expect(stats.best.wide).toBeLessThanOrEqual(stats.total.wide);
  });

  it('reads the remembered width and the one-time flag', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(prefsSchema, kv)).width).toBe('wide');
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
  });

  it('reads each record back as exactly the string the published build wrote', async () => {
    // The validators rebuild the record from what they read; a field they
    // dropped, renamed or reordered would show here as a different string.
    const kv = createMemoryKV(RELEASED);
    expect(JSON.stringify(await loadRecord(flagsSchema, kv))).toBe(RELEASED['bo.flags']);
    expect(JSON.stringify(await loadRecord(statsSchema, kv))).toBe(RELEASED['bo.stats']);
    expect(JSON.stringify(await loadRecord(prefsSchema, kv))).toBe(RELEASED['bo.prefs']);
  });
});
