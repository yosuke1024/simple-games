/**
 * The records a released build actually wrote, read by today's validators
 * (RELEASE_CHECKLIST §0, docs/DOTS_AND_BOXES_RULES.md §8).
 *
 * Frozen at graduation (2026-10-02), when this title moved from the web
 * beta into the app. From then on these records change only by migration: a
 * payload that has to be rewritten to go green is a payload existing players
 * cannot load either, so do not regenerate them. Building a payload from
 * `defaultValue()` would prove nothing — it would follow the schema wherever
 * the schema went; a validator is only proven by data it did not generate.
 *
 * Provenance: played in the published web build (pixapps-landing 7e536db,
 * built from simple-games 74b4e58), in a headless browser with every
 * external request blocked, through the game's own buttons — nothing was
 * written to storage by hand. The strings below are what Capacitor
 * Preferences held afterwards, copied verbatim; every key in `keys.ts` was
 * written by play:
 *   - flags: Quick Rules finished;
 *   - stats: a won and a lost 3×3 match, then a 4×4 match started;
 *   - prefs: "CPU first" chosen, then the 4×4 board;
 *   - saveGame: that 4×4 match, CPU opened, left mid-play through the Home
 *     button after 24 lines (the CPU had closed five boxes).
 * Nothing here is hand-built.
 *
 * Against 74b4e58, `storage/schemas.ts`, `storage/keys.ts`,
 * `storage/gamePersistence.ts` and the whole `game/` tree are byte-identical
 * to today's (compared with `git rev-parse 74b4e58:<path> HEAD:<path>`), so
 * what the web build wrote is what the app's code reads. The game has no
 * daily mode, so no record here depends on the date.
 *
 * Not covered by a captured record: schemaVersion 1 prefs and saves (the web
 * build writes v2; the v1 migration is pinned by the schema's own tests), and
 * a drawn match.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { applyPlayerMove, CPU, openEdges, PLAYER } from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { DB_STORAGE_KEYS, flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

/** Capacitor Preferences, as it stood after the three matches in the browser. */
const RELEASED: Record<string, string> = {
  [DB_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [DB_STORAGE_KEYS.prefs]: '{"schemaVersion":2,"size":"medium","playerGoesFirst":false}',
  [DB_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"totalPlaySeconds":29,' +
    '"small":{"played":2,"wins":1,"losses":1,"draws":0},' +
    '"medium":{"played":1,"wins":0,"losses":0,"draws":0},' +
    '"large":{"played":0,"wins":0,"losses":0,"draws":0}}',
  [DB_STORAGE_KEYS.game]:
    '{"schemaVersion":2,"size":"medium","seed":"dots-and-boxes-muqq7b5y-7pv0k","first":2,' +
    '"edges":"0220220210222021002102101210110022120000","boxes":".c..c..c..cc....",' +
    '"toMove":1,"moveCount":24,"elapsedSeconds":13,"savedAt":1790931225278}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the preferences: the board last picked and the side chosen', async () => {
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 2,
      size: 'medium',
      playerGoesFirst: false,
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      totalPlaySeconds: 29,
      small: { played: 2, wins: 1, losses: 1, draws: 0 },
      medium: { played: 1, wins: 0, losses: 0, draws: 0 },
      large: { played: 0, wins: 0, losses: 0, draws: 0 },
    });
  });

  it('reads the saved match field by field', async () => {
    expect(await loadRecord(gameSchema, released())).toEqual({
      schemaVersion: 2,
      size: 'medium',
      seed: 'dots-and-boxes-muqq7b5y-7pv0k',
      first: CPU,
      edges: '0220220210222021002102101210110022120000',
      boxes: '.c..c..c..cc....',
      toMove: PLAYER,
      moveCount: 24,
      elapsedSeconds: 13,
      savedAt: 1790931225278,
    });
  });

  it('restores the suspended match down to the line and the box', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();
    expect(session!.size).toBe('medium');
    expect(session!.board.n).toBe(4);
    expect(session!.board.edges).toBe('0220220210222021002102101210110022120000');
    //   . c . .
    //   c . . c
    //   . . c c
    //   . . . .
    expect(session!.board.boxes).toBe('.c..c..c..cc....');
    expect(session!.seed).toBe('dots-and-boxes-muqq7b5y-7pv0k');
    // Who opened the match and whose line it is are both part of the
    // position: a box closed keeps the turn, so neither can be derived (§8).
    expect(session!.first).toBe(CPU);
    expect(session!.toMove).toBe(PLAYER);
    // The move count is half the CPU's draw (§4) and must equal the lines drawn.
    expect(session!.moveCount).toBe(24);
    expect(session!.moveCount).toBe(
      [...session!.board.edges].filter((edge) => edge !== '0').length,
    );
    // Minutes on the board are part of it: dropping them quietly reports
    // someone else's play time (issue #109).
    expect(session!.elapsedSeconds).toBe(13);
    expect(session!.status).toBe('playing');
  });

  it('brings the match back without the lines that made it', async () => {
    // The undo history is deliberately not persisted (§8).
    const session = await loadSavedGame(released());
    expect(session!.history).toEqual([]);
    expect(session!.lastMove).toBeNull();
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":2,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [DB_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preferences default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [DB_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [DB_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no match to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [DB_STORAGE_KEYS.game]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a board that does not decode rather than repairing it', async () => {
    // A shorter edge string is not a smaller board — it is a record from
    // something that is not this game (§8).
    const kv = createMemoryKV({
      [DB_STORAGE_KEYS.game]: RELEASED[DB_STORAGE_KEYS.game]!.replace(
        '"0220220210222021002102101210110022120000"',
        '"02202202102220210021"',
      ),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a match whose move count is not the lines drawn', async () => {
    // Half the CPU's draw (§4): resuming it would answer differently than
    // the match that was put down.
    const kv = createMemoryKV({
      [DB_STORAGE_KEYS.game]: RELEASED[DB_STORAGE_KEYS.game]!.replace(
        '"moveCount":24',
        '"moveCount":23',
      ),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('a suspended match comes back the way it was left', () => {
  it('survives the round trip through storage', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();

    // One more line from the released position, wherever it legally goes:
    // the point is the round trip, not which line it is.
    const edge = openEdges(session!.board)[0]!;
    const next = applyPlayerMove(session!, edge);
    expect(next, `line ${edge} did nothing`).not.toBeNull();

    const kv = createMemoryKV();
    await saveGame(next!, kv);
    const restored = await loadSavedGame(kv);

    expect(restored).not.toBeNull();
    expect(restored!.board).toEqual(next!.board);
    expect(restored!.size).toBe('medium');
    expect(restored!.seed).toBe(next!.seed);
    expect(restored!.first).toBe(CPU);
    expect(restored!.toMove).toBe(next!.toMove);
    expect(restored!.moveCount).toBe(25);
    expect(restored!.elapsedSeconds).toBe(next!.elapsedSeconds);
    expect(restored!.status).toBe('playing');
  });
});
