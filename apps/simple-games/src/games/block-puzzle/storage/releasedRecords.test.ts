/**
 * The records a released build actually wrote, read by today's validators
 * (issue #170, docs/BLOCK_PUZZLE_RULES.md §10).
 *
 * Block Puzzle has never migrated a record, so every stored key is still v1
 * and nothing has forced the question yet. That is exactly why this file
 * exists: the day a schema here goes to v2, the only thing standing between a
 * player and a silently discarded board is a validator, and a validator is
 * only proven by data it did not generate itself. Building the payload from
 * `defaultValue()` would prove nothing — it would follow the schema wherever
 * the schema went.
 *
 * Provenance: played in the browser, in this repository's own web build; the
 * three strings below are what Capacitor Preferences held afterwards, copied
 * verbatim. The pieces were placed by a script through the game's own tray and
 * board controls, so the records are the game's, not a fixture's. This game's
 * `game/` and `storage/` trees are byte-identical to v1.2.2 (verified with
 * `git rev-parse v1.2.2:.../games/block-puzzle/storage`), so what the shipped
 * app wrote is what these strings are.
 *
 * Do not regenerate them to make a change go green: a payload that has to be
 * rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  BOARD_SIZE,
  createSession,
  encodeBoard,
  encodeTray,
  placePiece,
  TRAY_SIZE,
  type BlockSession,
} from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { BP_STORAGE_KEYS, flagsSchema, gameSchema, statsSchema } from './schemas';

/** Capacitor Preferences, as it stood after two games in the browser. */
const RELEASED: Record<string, string> = {
  [BP_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [BP_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"played":2,"bestScore":106,"linesCleared":3,"totalPlaySeconds":34}',
  [BP_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"seed":"block-mtt7255a-5aanr",' +
    '"board":"1011001011110111111111001110010000000000100000000000000000000000",' +
    '"tray":"3ch","score":58,"batchIndex":4,"linesCleared":2,"elapsedSeconds":31,' +
    '"savedAt":1788903705422}',
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
      bestScore: 106,
      linesCleared: 3,
      totalPlaySeconds: 34,
    });
  });

  it('restores the suspended board down to the square', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();
    //   # . # # . . # .
    //   # # # # . # # #
    //   # # # # # # . .
    //   # # # . . # . .
    //   . . . . . . . .
    //   # . . . . . . .
    //   . . . . . . . .
    //   . . . . . . . .
    expect(encodeBoard(session!.board)).toBe(
      '1011001011110111111111001110010000000000100000000000000000000000',
    );
    expect(session!.seed).toBe('block-mtt7255a-5aanr');
    expect(session!.score).toBe(58);
    expect(session!.linesCleared).toBe(2);
    // The minutes on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(session!.elapsedSeconds).toBe(31);
    expect(session!.status).toBe('playing');
  });

  it('offers the same three pieces it was offering', async () => {
    // The tray is the position too (§10). A record that came back with a
    // fresh batch would be a reroll dressed up as a resume — and the refill
    // counter is what keeps the *next* batch the one this game would deal.
    const session = await loadSavedGame(released());
    expect(encodeTray(session!.tray)).toBe('3ch');
    expect(session!.batchIndex).toBe(4);
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
    const kv = createMemoryKV({ [BP_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BP_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no board to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BP_STORAGE_KEYS.game]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a tray that does not decode rather than repairing it', async () => {
    // Three slots, one character each: anything else is a record from
    // something that is not this game (§10).
    const kv = createMemoryKV({
      [BP_STORAGE_KEYS.game]: RELEASED[BP_STORAGE_KEYS.game]!.replace('"3ch"', '"3c"'),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('a suspended board comes back the way it was left', () => {
  it('survives the round trip through storage', async () => {
    // Two pieces down, wherever they legally go: the point is the round
    // trip, not which square they land on.
    const placeSomewhere = (current: BlockSession): BlockSession | null => {
      for (let slot = 0; slot < TRAY_SIZE; slot++) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          for (let col = 0; col < BOARD_SIZE; col++) {
            const next = placePiece(current, slot, row, col);
            if (next !== null) return next;
          }
        }
      }
      return null;
    };

    let session = createSession('block-golden');
    for (let move = 0; move < 2; move++) {
      const next = placeSomewhere(session);
      expect(next, 'no legal placement on an all-but-empty board').not.toBeNull();
      session = next!;
    }

    const kv = createMemoryKV();
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);

    expect(restored).not.toBeNull();
    expect(encodeBoard(restored!.board)).toBe(encodeBoard(session.board));
    expect(encodeTray(restored!.tray)).toBe(encodeTray(session.tray));
    expect(restored!.score).toBe(session.score);
    expect(restored!.batchIndex).toBe(session.batchIndex);
    expect(restored!.linesCleared).toBe(session.linesCleared);
  });
});
