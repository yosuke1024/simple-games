/**
 * The records the web build actually wrote, read by today's validators
 * (docs/RELEASE_CHECKLIST.md §0, docs/MANCALA_RULES.md §8). Frozen at
 * graduation, 2026-10-02: Mancala was a web-beta title until then, and from
 * here on every stored shape changes by migration, never by reinterpretation.
 *
 * Why this file exists: the day a schema here goes to v2, the only thing
 * standing between a player and a silently discarded match is a validator,
 * and a validator is only proven by data it did not generate itself. Building
 * the payload from `defaultValue()` would prove nothing — it would follow the
 * schema wherever the schema went.
 *
 * Provenance: CAPTURED, not hand-built. On 2026-10-02 the published web build
 * (pixapps-landing 7e536db, built from simple-games 74b4e58) was served
 * locally with every external request blocked and played through its own UI
 * with real clicks: Quick Rules to the end, one Easy match played to a win
 * (the first move came from Quick Rules' "Start Playing"), the "CPU first"
 * preference chosen on the home screen, then a Normal match — CPU opening —
 * played five moves and left with the home button. The four strings below are
 * what Capacitor Preferences held for this game's keys afterwards, copied
 * verbatim (`mc.stats` already counts the Easy win, the Normal match that was
 * started, and the six seconds of the suspended one).
 *
 * Against 74b4e58, by tree/blob hash: `storage/schemas.ts`, `storage/keys.ts`,
 * `storage/gamePersistence.ts` and the whole `game/` tree are identical to
 * what is in this checkout — so what the published build wrote is what the
 * app will meet. Mancala has one slot and no daily, so the 2026-10-02 "daily
 * is today's one board" load change (which discards stale-date daily slots)
 * does not apply here and no date appears in any expectation below.
 *
 * Do not regenerate these strings to make a change go green: a payload that
 * has to be rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { applyCpuMove, applyPlayerMove, CPU, createSession, PLAYER, PLAYER_STORE } from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, gameSchema, MC_STORAGE_KEYS, prefsSchema, statsSchema } from './schemas';

/** Capacitor Preferences, as it stood after the session described above. */
const RELEASED: Record<string, string> = {
  [MC_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [MC_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"playerGoesFirst":false}',
  [MC_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"totalPlaySeconds":19,"easy":{"played":1,"wins":1,"losses":0,"draws":0},' +
    '"normal":{"played":1,"wins":0,"losses":0,"draws":0},"hard":{"played":0,"wins":0,"losses":0,"draws":0}}',
  [MC_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"seed":"mancala-muqq3pyg-3hlk9","difficulty":"normal","first":2,' +
    '"pits":[5,4,0,0,1,1,5,0,5,8,3,7,7,2],"toMove":1,"moveCount":10,"elapsedSeconds":6,' +
    '"savedAt":1790931050857}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the side preference, not the default in the shape of one', async () => {
    // The default is "player first" (true); the captured record chose the CPU.
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 1,
      playerGoesFirst: false,
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      totalPlaySeconds: 19,
      easy: { played: 1, wins: 1, losses: 0, draws: 0 },
      normal: { played: 1, wins: 0, losses: 0, draws: 0 },
      hard: { played: 0, wins: 0, losses: 0, draws: 0 },
    });
  });

  it('reads the suspended match field by field', async () => {
    expect(await loadRecord(gameSchema, released())).toEqual({
      schemaVersion: 1,
      seed: 'mancala-muqq3pyg-3hlk9',
      difficulty: 'normal',
      first: CPU,
      pits: [5, 4, 0, 0, 1, 1, 5, 0, 5, 8, 3, 7, 7, 2],
      toMove: PLAYER,
      moveCount: 10,
      elapsedSeconds: 6,
      savedAt: 1790931050857,
    });
  });

  it('restores the suspended match down to the seed in every pit', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();
    //  CPU store 2 | CPU pits (screen left to right) 7 7 3 8 5 0 | your pits 5 4 0 0 1 1 | your store 5
    expect(session!.pits).toEqual([5, 4, 0, 0, 1, 1, 5, 0, 5, 8, 3, 7, 7, 2]);
    expect(session!.pits[PLAYER_STORE]).toBe(5);
    expect(session!.pits.reduce((sum, count) => sum + count, 0)).toBe(48);
    expect(session!.seed).toBe('mancala-muqq3pyg-3hlk9');
    expect(session!.difficulty).toBe('normal');
    // The CPU opened and it is the player's turn: both are stored, because an
    // extra turn breaks the alternation and the board cannot say (§8).
    expect(session!.first).toBe(CPU);
    expect(session!.toMove).toBe(PLAYER);
    // The move count is half the CPU's draw (§4): dropping it changes its replies.
    expect(session!.moveCount).toBe(10);
    // The seconds on the clock are part of it: dropping them here is how a
    // resumed match quietly reports someone else's play time (issue #109).
    expect(session!.elapsedSeconds).toBe(6);
    expect(session!.status).toBe('playing');
  });

  it('brings the match back without the moves that made it', async () => {
    // The undo history and the last-move highlight are deliberately not
    // persisted (§8): a resumed match starts from the position.
    const session = await loadSavedGame(released());
    expect(session!.history).toEqual([]);
    expect(session!.lastMove).toBeNull();
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [MC_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preference default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [MC_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [MC_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no match to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [MC_STORAGE_KEYS.game]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a board that does not add up rather than repairing it', async () => {
    // Seeds are moved, never made or lost: a board of 49 could not have come
    // from play, so it is a record from something that is not this game (§8).
    const kv = createMemoryKV({
      [MC_STORAGE_KEYS.game]: RELEASED[MC_STORAGE_KEYS.game]!.replace(
        '[5,4,0,0,1,1,5,0,5,8,3,7,7,2]',
        '[6,4,0,0,1,1,5,0,5,8,3,7,7,2]',
      ),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('a suspended match comes back the way it was left', () => {
  it('survives the round trip through storage', async () => {
    // Pit 2 ends in the store (an extra turn), pit 0 sows on, and the CPU
    // answers: the stored turn has to be the one the match is actually in.
    let session = createSession('hard', PLAYER, 'mancala-round-trip');
    const afterExtra = applyPlayerMove(session, 2);
    expect(afterExtra, 'pit 2 did nothing').not.toBeNull();
    expect(afterExtra!.toMove).toBe(PLAYER);
    const afterSecond = applyPlayerMove(afterExtra!, 0);
    expect(afterSecond, 'pit 0 did nothing').not.toBeNull();
    const afterCpu = applyCpuMove(afterSecond!);
    expect(afterCpu, 'the CPU did not answer').not.toBeNull();
    session = { ...afterCpu!, elapsedSeconds: 42 };

    const kv = createMemoryKV();
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);

    expect(restored).not.toBeNull();
    expect(restored!.pits).toEqual(session.pits);
    expect(restored!.seed).toBe('mancala-round-trip');
    expect(restored!.difficulty).toBe('hard');
    expect(restored!.first).toBe(PLAYER);
    expect(restored!.toMove).toBe(session.toMove);
    expect(restored!.moveCount).toBe(session.moveCount);
    expect(restored!.elapsedSeconds).toBe(42);
    expect(restored!.status).toBe('playing');
  });

  it('survives the round trip of the other records', async () => {
    const kv = createMemoryKV();
    const stats = await loadRecord(statsSchema, released());
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    await saveRecord(prefsSchema, { schemaVersion: 1, playerGoesFirst: false }, kv);
    await saveRecord(statsSchema, stats, kv);

    expect(await loadRecord(flagsSchema, kv)).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(await loadRecord(prefsSchema, kv)).toEqual({ schemaVersion: 1, playerGoesFirst: false });
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);
  });
});
