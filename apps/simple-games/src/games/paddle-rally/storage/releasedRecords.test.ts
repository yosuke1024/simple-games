/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. It was served on
 * 127.0.0.1 by a Playwright harness (Chromium, 390x780, en-US) with every
 * non-localhost request aborted; game assets unchanged.
 * UI steps: finish the tutorial (Start Playing begins an Easy game); play it to 5 points with
 * the pointer (a script held the pointer on the court and slid it under the ball, reading the
 * ball position from the DOM) and press Home on the result card; tap "Hard", leave the paddle
 * alone and press Space to serve each point until the CPU reaches 5, Home; tap "Normal",
 * leave the paddle alone for the first point (CPU 1), then play with the pointer until the
 * player had 2 points and the ball was in flight after a return, press the Pause button and
 * return Home so the suspended game is saved.
 * Captured: all four keys (pr.flags, pr.prefs, pr.stats, pr.saveGame) as they stood at the
 * end. The saved game is the Normal game paused mid-rally; the finished Easy and Hard games
 * left no save (a finished game clears it).
 * Not captured: nothing declared is missing. No save of an Easy or Hard game exists because
 * both were played to the end, which clears pr.saveGame.
 * No storage writes, clock mocking, or game-internal calls created these records: the
 * harness only clicked, pressed keys and moved the pointer (a script read positions from the
 * DOM to decide where). Only the Web Preferences key prefix `CapacitorStorage.` is removed
 * below; payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'pr.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'pr.prefs': '{"schemaVersion":1,"mode":"normal"}',
  'pr.stats':
    '{"schemaVersion":1,"totalPlaySeconds":63,"easy":{"played":1,"wins":1,"losses":0},' +
    '"normal":{"played":1,"wins":0,"losses":0},"hard":{"played":1,"wins":0,"losses":1}}',
  'pr.saveGame':
    '{"schemaVersion":1,"mode":"normal","status":"playing","player":160,"cpu":74.41199434184034,' +
    '"x":105.15734236569229,"y":279.99763060810966,"vx":189.72892999353445,' +
    '"vy":-111.36845659121126,"playerScore":2,"cpuScore":1,"rally":1,"serving":false,' +
    '"elapsedSeconds":28,"resultRecorded":false}',
};

describe('records written by the published Paddle Rally build', () => {
  it('loads every captured record without replacing it with a default', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['pr.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['pr.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['pr.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['pr.saveGame']));
  });

  it('reads the flag, the remembered mode and every statistic the player earned', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).mode).toBe('normal');
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.totalPlaySeconds).toBe(63);
    expect(stats.easy).toEqual({ played: 1, wins: 1, losses: 0 });
    expect(stats.normal).toEqual({ played: 1, wins: 0, losses: 0 });
    expect(stats.hard).toEqual({ played: 1, wins: 0, losses: 1 });
  });

  it('restores the Normal game paused mid-rally, ball and paddles where they were', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(session!.mode).toBe('normal');
    expect(session!.status).toBe('playing');
    expect(session!.playerScore).toBe(2);
    expect(session!.cpuScore).toBe(1);
    expect(session!.rally).toBe(1);
    expect(session!.serving).toBe(false);
    expect(session!.player).toBe(160);
    expect(session!.cpu).toBe(74.41199434184034);
    expect(session!.x).toBe(105.15734236569229);
    expect(session!.y).toBe(279.99763060810966);
    // Heading up the court (vy < 0) toward the CPU after the player's return.
    expect(session!.vx).toBe(189.72892999353445);
    expect(session!.vy).toBe(-111.36845659121126);
    expect(session!.elapsedSeconds).toBe(28);
    expect(session!.resultRecorded).toBe(false);
  });

  it('writes the restored game back byte for byte', async () => {
    // There is no separate "to persisted" function: the stored text is the session itself.
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    const out = createMemoryKV();
    await saveGame(session!, out);
    expect(await out.get('pr.saveGame')).toBe(RELEASED['pr.saveGame']);
  });
});
