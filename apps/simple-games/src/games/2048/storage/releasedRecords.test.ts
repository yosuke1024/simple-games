/**
 * The records a released build actually wrote, read by today's validators
 * (issue #170, docs/GAME_2048_RULES.md §10).
 *
 * 2048 has never migrated a record, so every stored key is still v1 and
 * nothing has forced the question yet. That is exactly why this file exists:
 * the day a schema here goes to v2, the only thing standing between a player
 * and a silently discarded board is a validator, and a validator is only
 * proven by data it did not generate itself. Building the payload from
 * `defaultValue()` would prove nothing — it would follow the schema wherever
 * the schema went.
 *
 * Provenance: played in the browser, in this repository's own web build; the
 * three strings below are what Capacitor Preferences held afterwards, copied
 * verbatim. The moves were dispatched by a script through the game's own
 * input handlers, so the records are the game's, not a fixture's. This game's
 * `game/` and `storage/` trees are byte-identical to v1.2.2 (verified with
 * `git rev-parse v1.2.2:.../games/2048/storage`), so what the shipped app
 * wrote is what these strings are.
 *
 * Do not regenerate them to make a change go green: a payload that has to be
 * rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { applyMove, createSession, encodeBoard, largestTile, type Direction } from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, gameSchema, statsSchema, TM_STORAGE_KEYS } from './schemas';

/** Capacitor Preferences, as it stood after two games in the browser. */
const RELEASED: Record<string, string> = {
  [TM_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [TM_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"played":2,"bestScore":552,"bestTile":64,"reached2048":0,"totalPlaySeconds":34}',
  [TM_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"seed":"2048-mtt6zuyf-9x5d8","board":"2130624045100210","score":552,' +
    '"spawnIndex":72,"reached2048":false,"moveCount":70,"elapsedSeconds":25,"savedAt":1788903593101}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      played: 2,
      bestScore: 552,
      bestTile: 64,
      reached2048: 0,
      totalPlaySeconds: 34,
    });
  });

  it('restores the suspended board down to the square', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();
    //   4  2  8  .
    //  64  4 16  .
    //  16 32  2  .
    //   .  4  2  .
    expect(encodeBoard(session!.board)).toBe('2130624045100210');
    expect(largestTile(session!.board)).toBe(64);
    expect(session!.seed).toBe('2048-mtt6zuyf-9x5d8');
    expect(session!.score).toBe(552);
    expect(session!.spawnIndex).toBe(72);
    expect(session!.moveCount).toBe(70);
    // The minutes on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(session!.elapsedSeconds).toBe(25);
    expect(session!.status).toBe('playing');
  });

  it('brings the board back without the moves that made it', async () => {
    // The undo history is deliberately not persisted (§10): a resumed game
    // starts from the position, not part-way through a path to it.
    const session = await loadSavedGame(released());
    expect(session!.history).toEqual([]);
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [TM_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [TM_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no board to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [TM_STORAGE_KEYS.game]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a board that does not decode rather than repairing it', async () => {
    // A shorter board string is not a smaller board — it is a record from
    // something that is not this game (§10).
    const kv = createMemoryKV({
      [TM_STORAGE_KEYS.game]: RELEASED[TM_STORAGE_KEYS.game]!.replace(
        '"2130624045100210"',
        '"213"',
      ),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('a suspended board comes back the way it was left', () => {
  const SEQUENCE: readonly Direction[] = ['left', 'up', 'right', 'down', 'left'];

  it('survives the round trip through storage', async () => {
    let session = createSession('2048-round-trip');
    for (const direction of SEQUENCE) {
      const outcome = applyMove(session, direction);
      expect(outcome, `${direction} did nothing`).not.toBeNull();
      session = outcome!.session;
    }

    const kv = createMemoryKV();
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);

    expect(restored).not.toBeNull();
    expect(encodeBoard(restored!.board)).toBe(encodeBoard(session.board));
    expect(restored!.score).toBe(session.score);
    expect(restored!.moveCount).toBe(SEQUENCE.length);
    // The spawn counter is what makes the next tile the one this game would
    // have dealt: a board restored with a reset counter is a reroll.
    expect(restored!.spawnIndex).toBe(session.spawnIndex);
    expect(restored!.reached2048).toBe(session.reached2048);
  });
});
