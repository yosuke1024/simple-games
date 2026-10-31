/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. It was served on
 * 127.0.0.1 by a Playwright harness (Chromium, 390x780, en-US) with every
 * non-localhost request aborted; game assets unchanged.
 * UI steps: finish the tutorial (Start Playing creates a run in the "ready" state); aim with
 * ArrowLeft/ArrowRight and press Start; clear stage 1 with the pointer (a script held the
 * pointer on the field and slid the ship under the lowest invader, reading positions from the
 * DOM, stepping aside from enemy shots); press Next stage, then Start; play stage 2 for about
 * nine seconds, press Pause and return Home so the suspended run is saved.
 * Captured: all three keys (iv.flags, iv.stats, iv.saveGame) as they stood at the end (the
 * run paused mid-stage 2). SAVED_READY, SAVED_BETWEEN and SAVED_STAGE_2_READY are iv.saveGame
 * as read from the same run at the ready screen before the first Start, on the "Formation
 * cleared" card, and on the stage 2 ready screen, before later play replaced them.
 * Not captured: iv.stats `cleared` stayed 0 (clearing all 20 stages was not attempted) and no
 * lost run was played. The game has no preferences key, so there is none to capture.
 * No storage writes, clock mocking, or game-internal calls created these records: the
 * harness only clicked, pressed keys and moved the pointer (a script read positions from the
 * DOM to decide where). Only the Web Preferences key prefix `CapacitorStorage.` is removed
 * below; payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { loadSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, statsSchema, toPersisted } from './schemas';

const RELEASED = {
  'iv.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'iv.stats':
    '{"schemaVersion":1,"played":1,"cleared":0,"bestScore":960,"bestStage":2,' +
    '"totalPlaySeconds":24}',
  'iv.saveGame':
    '{"schemaVersion":1,"session":{"status":"paused","started":true,"stage":2,"score":960,' +
    '"lives":3,"playerX":323.7909383285869,"enemies":[{"id":1,"x":132.6666666666664,"y":103},' +
    '{"id":2,"x":172.6666666666673,"y":103},{"id":3,"x":212.6666666666672,"y":103},{"id":4,' +
    '"x":252.66666666666723,"y":103},{"id":5,"x":292.6666666666677,"y":103},{"id":6,' +
    '"x":332.66666666666754,"y":103},{"id":8,"x":132.6666666666664,"y":135},{"id":9,' +
    '"x":172.6666666666673,"y":135},{"id":10,"x":212.6666666666672,"y":135},{"id":12,' +
    '"x":292.6666666666677,"y":135},{"id":15,"x":132.6666666666664,"y":167},{"id":16,' +
    '"x":172.6666666666673,"y":167},{"id":17,"x":212.6666666666672,"y":167},{"id":19,' +
    '"x":292.6666666666677,"y":167}],"bullets":[{"id":93,"x":263.6666666666669,' +
    '"y":283.80000000000035,"owner":"enemy"},{"id":99,"x":280.20000000000095,' +
    '"y":209.13333333333344,"owner":"enemy"},{"id":100,"x":323.7909383285869,"y":397,' +
    '"owner":"player"}],"covers":[{"id":0,"x":56,"y":367,"hp":2},{"id":1,"x":70,"y":367,"hp":1},' +
    '{"id":2,"x":84,"y":367,"hp":1},{"id":3,"x":56,"y":381,"hp":0},{"id":4,"x":84,"y":381,' +
    '"hp":1},{"id":5,"x":166,"y":367,"hp":2},{"id":6,"x":180,"y":367,"hp":0},{"id":7,"x":194,' +
    '"y":367,"hp":2},{"id":8,"x":166,"y":381,"hp":2},{"id":9,"x":194,"y":381,"hp":2},{"id":10,' +
    '"x":276,"y":367,"hp":1},{"id":11,"x":290,"y":367,"hp":2},{"id":12,"x":304,"y":367,"hp":2},' +
    '{"id":13,"x":276,"y":381,"hp":0},{"id":14,"x":304,"y":381,"hp":0}],"direction":1,' +
    '"fireTicks":8,"enemyFireTicks":33,"invulnerableTicks":0,"shotIndex":18,"nextBulletId":101,' +
    '"ticks":737,"elapsedSeconds":24},"savedAt":1793269046304}',
};

const SAVED_READY =
  '{"schemaVersion":1,"session":{"status":"ready","started":false,"stage":1,"score":0,' +
  '"lives":3,"playerX":180,"enemies":[{"id":0,"x":60,"y":55},{"id":1,"x":100,"y":55},{"id":2,' +
  '"x":140,"y":55},{"id":3,"x":180,"y":55},{"id":4,"x":220,"y":55},{"id":5,"x":260,"y":55},' +
  '{"id":6,"x":300,"y":55},{"id":7,"x":60,"y":87},{"id":8,"x":100,"y":87},{"id":9,"x":140,' +
  '"y":87},{"id":10,"x":180,"y":87},{"id":11,"x":220,"y":87},{"id":12,"x":260,"y":87},{"id":13,' +
  '"x":300,"y":87},{"id":14,"x":60,"y":119},{"id":15,"x":100,"y":119},{"id":16,"x":140,' +
  '"y":119},{"id":17,"x":180,"y":119},{"id":18,"x":220,"y":119},{"id":19,"x":260,"y":119},' +
  '{"id":20,"x":300,"y":119},{"id":21,"x":60,"y":151},{"id":22,"x":100,"y":151},{"id":23,' +
  '"x":140,"y":151},{"id":24,"x":180,"y":151},{"id":25,"x":220,"y":151},{"id":26,"x":260,' +
  '"y":151},{"id":27,"x":300,"y":151}],"bullets":[],"covers":[{"id":0,"x":56,"y":367,"hp":2},' +
  '{"id":1,"x":70,"y":367,"hp":2},{"id":2,"x":84,"y":367,"hp":2},{"id":3,"x":56,"y":381,' +
  '"hp":2},{"id":4,"x":84,"y":381,"hp":2},{"id":5,"x":166,"y":367,"hp":2},{"id":6,"x":180,' +
  '"y":367,"hp":2},{"id":7,"x":194,"y":367,"hp":2},{"id":8,"x":166,"y":381,"hp":2},{"id":9,' +
  '"x":194,"y":381,"hp":2},{"id":10,"x":276,"y":367,"hp":2},{"id":11,"x":290,"y":367,"hp":2},' +
  '{"id":12,"x":304,"y":367,"hp":2},{"id":13,"x":276,"y":381,"hp":2},{"id":14,"x":304,"y":381,' +
  '"hp":2}],"direction":1,"fireTicks":0,"enemyFireTicks":25,"invulnerableTicks":30,' +
  '"shotIndex":0,"nextBulletId":0,"ticks":0,"elapsedSeconds":0},"savedAt":1793269016371}';

const SAVED_BETWEEN =
  '{"schemaVersion":1,"session":{"status":"between","started":true,"stage":1,"score":700,' +
  '"lives":3,"playerX":185.35994426986153,"enemies":[],"bullets":[{"id":59,' +
  '"x":50.8833333333321,"y":251.6333333333331,"owner":"enemy"},{"id":61,"x":154.89159321909065,' +
  '"y":241,"owner":"player"},{"id":62,"x":170.52297640675636,"y":349,"owner":"player"}],' +
  '"covers":[{"id":0,"x":56,"y":367,"hp":2},{"id":1,"x":70,"y":367,"hp":1},{"id":2,"x":84,' +
  '"y":367,"hp":1},{"id":3,"x":56,"y":381,"hp":0},{"id":4,"x":84,"y":381,"hp":0},{"id":5,' +
  '"x":166,"y":367,"hp":0},{"id":6,"x":180,"y":367,"hp":0},{"id":7,"x":194,"y":367,"hp":2},' +
  '{"id":8,"x":166,"y":381,"hp":0},{"id":9,"x":194,"y":381,"hp":1},{"id":10,"x":276,"y":367,' +
  '"hp":2},{"id":11,"x":290,"y":367,"hp":0},{"id":12,"x":304,"y":367,"hp":1},{"id":13,"x":276,' +
  '"y":381,"hp":0},{"id":14,"x":304,"y":381,"hp":1}],"direction":1,"fireTicks":4,' +
  '"enemyFireTicks":11,"invulnerableTicks":0,"shotIndex":11,"nextBulletId":63,"ticks":465,' +
  '"elapsedSeconds":15},"savedAt":1793269033083}';

const SAVED_STAGE_2_READY =
  '{"schemaVersion":1,"session":{"status":"ready","started":true,"stage":2,"score":700,' +
  '"lives":3,"playerX":180,"enemies":[{"id":0,"x":60,"y":55},{"id":1,"x":100,"y":55},{"id":2,' +
  '"x":140,"y":55},{"id":3,"x":180,"y":55},{"id":4,"x":220,"y":55},{"id":5,"x":260,"y":55},' +
  '{"id":6,"x":300,"y":55},{"id":7,"x":60,"y":87},{"id":8,"x":100,"y":87},{"id":9,"x":140,' +
  '"y":87},{"id":10,"x":180,"y":87},{"id":11,"x":220,"y":87},{"id":12,"x":260,"y":87},{"id":13,' +
  '"x":300,"y":87},{"id":14,"x":60,"y":119},{"id":15,"x":100,"y":119},{"id":16,"x":140,' +
  '"y":119},{"id":17,"x":180,"y":119},{"id":18,"x":220,"y":119},{"id":19,"x":260,"y":119},' +
  '{"id":20,"x":300,"y":119},{"id":21,"x":60,"y":151},{"id":22,"x":100,"y":151},{"id":23,' +
  '"x":140,"y":151},{"id":24,"x":180,"y":151},{"id":25,"x":220,"y":151},{"id":26,"x":260,' +
  '"y":151},{"id":27,"x":300,"y":151}],"bullets":[],"covers":[{"id":0,"x":56,"y":367,"hp":2},' +
  '{"id":1,"x":70,"y":367,"hp":2},{"id":2,"x":84,"y":367,"hp":2},{"id":3,"x":56,"y":381,' +
  '"hp":2},{"id":4,"x":84,"y":381,"hp":2},{"id":5,"x":166,"y":367,"hp":2},{"id":6,"x":180,' +
  '"y":367,"hp":2},{"id":7,"x":194,"y":367,"hp":2},{"id":8,"x":166,"y":381,"hp":2},{"id":9,' +
  '"x":194,"y":381,"hp":2},{"id":10,"x":276,"y":367,"hp":2},{"id":11,"x":290,"y":367,"hp":2},' +
  '{"id":12,"x":304,"y":367,"hp":2},{"id":13,"x":276,"y":381,"hp":2},{"id":14,"x":304,"y":381,' +
  '"hp":2}],"direction":1,"fireTicks":0,"enemyFireTicks":25,"invulnerableTicks":30,' +
  '"shotIndex":11,"nextBulletId":63,"ticks":465,"elapsedSeconds":15},"savedAt":1793269035306}';

const SAVE_TIMES = {
  ready: 1793269016371,
  between: 1793269033083,
  stage2Ready: 1793269035306,
  paused: 1793269046304,
};

describe('records written by the published Invaders build', () => {
  it('loads every captured record without replacing it with a default', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['iv.flags']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['iv.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['iv.saveGame']));
    for (const raw of [SAVED_READY, SAVED_BETWEEN, SAVED_STAGE_2_READY]) {
      const other = createMemoryKV({ 'iv.saveGame': raw });
      expect(await loadRecord(gameSchema, other)).toEqual(JSON.parse(raw));
    }
  });

  it('reads the flag and every statistic the player earned', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      played: 1,
      cleared: 0,
      bestScore: 960,
      bestStage: 2,
      totalPlaySeconds: 24,
    });
  });

  it('restores the run paused mid-stage 2 with its formation, shots and cover', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(session!.status).toBe('paused');
    expect(session!.started).toBe(true);
    expect(session!.stage).toBe(2);
    expect(session!.score).toBe(960);
    expect(session!.lives).toBe(3);
    expect(session!.playerX).toBe(323.7909383285869);
    expect(session!.ticks).toBe(737);
    expect(session!.elapsedSeconds).toBe(24);
    expect(session!.enemies.map((enemy) => enemy.id)).toEqual([
      1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 17, 19,
    ]);
    expect(session!.enemies[0]).toEqual({ id: 1, x: 132.6666666666664, y: 103 });
    expect(session!.bullets).toEqual([
      { id: 93, x: 263.6666666666669, y: 283.80000000000035, owner: 'enemy' },
      { id: 99, x: 280.20000000000095, y: 209.13333333333344, owner: 'enemy' },
      { id: 100, x: 323.7909383285869, y: 397, owner: 'player' },
    ]);
    expect(session!.covers.map((brick) => brick.hp)).toEqual([
      2, 1, 1, 0, 1, 2, 0, 2, 2, 2, 1, 2, 2, 0, 0,
    ]);
    expect(session!.direction).toBe(1);
    expect(session!.shotIndex).toBe(18);
    expect(session!.nextBulletId).toBe(101);
  });

  it('restores the ready screen before the first Start', async () => {
    const session = await loadSavedGame(createMemoryKV({ 'iv.saveGame': SAVED_READY }));
    expect(session).not.toBeNull();
    expect(session!.status).toBe('ready');
    expect(session!.started).toBe(false);
    expect(session!.stage).toBe(1);
    expect(session!.score).toBe(0);
    expect(session!.lives).toBe(3);
    expect(session!.enemies).toHaveLength(28);
    expect(session!.bullets).toEqual([]);
    expect(session!.ticks).toBe(0);
  });

  it('restores the "formation cleared" card between stage 1 and 2', async () => {
    const session = await loadSavedGame(createMemoryKV({ 'iv.saveGame': SAVED_BETWEEN }));
    expect(session).not.toBeNull();
    expect(session!.status).toBe('between');
    expect(session!.started).toBe(true);
    expect(session!.stage).toBe(1);
    expect(session!.score).toBe(700);
    expect(session!.enemies).toEqual([]);
    expect(session!.bullets.map((bullet) => bullet.id)).toEqual([59, 61, 62]);
    expect(session!.playerX).toBe(185.35994426986153);
    expect(session!.ticks).toBe(465);
    expect(session!.elapsedSeconds).toBe(15);
  });

  it('restores the stage 2 ready screen with repaired cover and the carried score', async () => {
    const session = await loadSavedGame(createMemoryKV({ 'iv.saveGame': SAVED_STAGE_2_READY }));
    expect(session).not.toBeNull();
    expect(session!.status).toBe('ready');
    expect(session!.started).toBe(true);
    expect(session!.stage).toBe(2);
    expect(session!.score).toBe(700);
    expect(session!.enemies).toHaveLength(28);
    expect(session!.covers.every((brick) => brick.hp === 2)).toBe(true);
    expect(session!.ticks).toBe(465);
    expect(session!.shotIndex).toBe(11);
  });

  it('writes each restored run back at its original save time', async () => {
    // restore() lists `direction` before `enemies`, the build listed it after `covers`, so the
    // text is compared as data rather than byte for byte.
    const cases = [
      [RELEASED['iv.saveGame'], SAVE_TIMES.paused],
      [SAVED_READY, SAVE_TIMES.ready],
      [SAVED_BETWEEN, SAVE_TIMES.between],
      [SAVED_STAGE_2_READY, SAVE_TIMES.stage2Ready],
    ] as const;
    for (const [raw, savedAt] of cases) {
      const session = await loadSavedGame(createMemoryKV({ 'iv.saveGame': raw }));
      expect(session).not.toBeNull();
      expect(JSON.parse(JSON.stringify(toPersisted(session!, savedAt)))).toEqual(JSON.parse(raw));
    }
  });
});
