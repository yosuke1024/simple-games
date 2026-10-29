/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (real clicks and key presses only): finish the Quick Rules with
 * "Start Playing" (a ready board opens by itself; no storage dump was taken at
 * that point) and go Home; pick Fast, New Game, press ArrowRight and run straight
 * into the right wall (score 0); pick Normal, New Game, eat one food, then
 * into a wall; pick Slow, New Game, eat two foods, go Home (a suspended run —
 * RELEASED_EARLIER below was dumped here), press Resume on the Home, eat two
 * more foods, then into a wall (score 4); pick Slow again, New Game, eat two
 * foods, press ArrowUp while paused to choose the next heading, and go Home
 * (the suspended run in RELEASED, with `next`). The runs were stepped: a
 * heading chosen while paused, P to resume, a wait of N ticks and half a tick,
 * P to pause; the food and the head were read from the board's SVG to plan
 * the turns.
 *
 * Captured: all four keys — sn.saveGame, sn.stats, sn.flags, sn.prefs.
 * RELEASED is the dump at the end of the session; RELEASED_EARLIER holds the
 * sn.saveGame and sn.stats the same session wrote in the middle (the suspended
 * run without a `next`, and statistics that did not yet include the Slow run
 * finished later). Not captured: a full-board clear (`cleared` above 0 needs
 * 193 foods), so every `cleared` below is 0 and the cleared-needs-the-full-score
 * rule is not exercised by published data.
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { pendingHeading } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'sn.saveGame':
    '{"schemaVersion":1,"seed":"snake-mvtdz2z3-5ralv","speed":"slow","body":"3q3r3s3e30","food":50,"score":2,"ticks":11,"elapsedSeconds":2,"next":"up","savedAt":1793268857739}',
  'sn.stats':
    '{"schemaVersion":1,"slow":{"played":2,"bestScore":4,"cleared":0,"totalPlaySeconds":12},"normal":{"played":1,"bestScore":1,"cleared":0,"totalPlaySeconds":2},"fast":{"played":1,"bestScore":0,"cleared":0,"totalPlaySeconds":1}}',
  'sn.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'sn.prefs': '{"schemaVersion":1,"speed":"slow"}',
};

const RELEASED_EARLIER = {
  'sn.saveGame':
    '{"schemaVersion":1,"seed":"snake-mvtdyq5i-7ww3l","speed":"slow","body":"010f0t171l","food":121,"score":2,"ticks":17,"elapsedSeconds":4,"savedAt":1793268842121}',
  'sn.stats':
    '{"schemaVersion":1,"slow":{"played":1,"bestScore":0,"cleared":0,"totalPlaySeconds":4},"normal":{"played":1,"bestScore":1,"cleared":0,"totalPlaySeconds":2},"fast":{"played":1,"bestScore":0,"cleared":0,"totalPlaySeconds":1}}',
};

describe('records written by the published Snake build', () => {
  it('loads all four original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['sn.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['sn.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['sn.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['sn.saveGame']));
  });

  it('loads the earlier mid-session records too', async () => {
    const kv = createMemoryKV(RELEASED_EARLIER);
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED_EARLIER['sn.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED_EARLIER['sn.saveGame']));
  });

  it('reads the flags, the remembered speed and every statistic', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).speed).toBe('slow');
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      slow: { played: 2, bestScore: 4, cleared: 0, totalPlaySeconds: 12 },
      normal: { played: 1, bestScore: 1, cleared: 0, totalPlaySeconds: 2 },
      fast: { played: 1, bestScore: 0, cleared: 0, totalPlaySeconds: 1 },
    });
  });

  it('restores the suspended run paused, with the heading chosen while it was paused', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(session!.seed).toBe('snake-mvtdz2z3-5ralv');
    expect(session!.speed).toBe('slow');
    expect(session!.status).toBe('paused');
    // "3q3r3s3e30" is cells 134, 135, 136, 122 and 108, head first: the head at
    // row 9, column 8, and the tail at row 7, column 10 (14 cells a row).
    expect(session!.body).toEqual([134, 135, 136, 122, 108]);
    // Moving from the neck (9, 9) to the head (9, 8), the snake last moved left.
    expect(session!.direction).toBe('left');
    expect(session!.food).toBe(50);
    expect(session!.score).toBe(2);
    // Two foods eaten: length 3 + 2, and the third food drawn.
    expect(session!.body).toHaveLength(5);
    expect(session!.foodDraws).toBe(3);
    expect(session!.ticks).toBe(11);
    expect(session!.elapsedSeconds).toBe(2);
    expect(session!.crash).toBeNull();
    // `next: "up"` was chosen with ArrowUp while paused and comes back as a pending heading.
    expect(session!.queue).toEqual(['up']);
    expect(pendingHeading(session!)).toBe('up');
  });

  it('restores the earlier suspended run, which had no chosen heading', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED_EARLIER));
    expect(session).not.toBeNull();
    expect(session!.seed).toBe('snake-mvtdyq5i-7ww3l');
    expect(session!.speed).toBe('slow');
    expect(session!.status).toBe('paused');
    // "010f0t171l" is cells 1, 15, 29, 43 and 57: column 1, rows 0 to 4, head at the top.
    expect(session!.body).toEqual([1, 15, 29, 43, 57]);
    expect(session!.direction).toBe('up');
    expect(session!.food).toBe(121);
    expect(session!.score).toBe(2);
    expect(session!.ticks).toBe(17);
    expect(session!.elapsedSeconds).toBe(4);
    expect(session!.queue).toEqual([]);
    expect(pendingHeading(session!)).toBeNull();
  });

  it('does not book a suspended run into the best score before it ends', async () => {
    const stats = await loadRecord(statsSchema, createMemoryKV(RELEASED_EARLIER));
    const session = await loadSavedGame(createMemoryKV(RELEASED_EARLIER));
    expect(session!.score).toBe(2);
    expect(stats).toEqual({
      schemaVersion: 1,
      slow: { played: 1, bestScore: 0, cleared: 0, totalPlaySeconds: 4 },
      normal: { played: 1, bestScore: 1, cleared: 0, totalPlaySeconds: 2 },
      fast: { played: 1, bestScore: 0, cleared: 0, totalPlaySeconds: 1 },
    });
  });

  it('writes each restored run back byte for byte at its original save time', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(JSON.stringify(toPersisted(session!, 1793268857739))).toBe(RELEASED['sn.saveGame']);

    const earlier = await loadSavedGame(createMemoryKV(RELEASED_EARLIER));
    expect(earlier).not.toBeNull();
    expect(JSON.stringify(toPersisted(earlier!, 1793268842121))).toBe(
      RELEASED_EARLIER['sn.saveGame'],
    );
  });
});
