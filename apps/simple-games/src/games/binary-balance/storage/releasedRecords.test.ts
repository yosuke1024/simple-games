/**
 * The records a released build actually wrote, read by today's validators
 * (graduation 2026-10-02, docs/RELEASE_CHECKLIST.md §0, docs/BINARY_BALANCE_RULES.md §11).
 *
 * Binary Balance was a web-beta title until 2026-10-02, so its schema was
 * explicitly allowed to change. From graduation on it is frozen: a stored
 * shape changes by migration (`SchemaDef` version), never by reinterpretation.
 * A validator is only proven by data it did not generate itself — building
 * these payloads from `defaultValue()` or `toPersisted()` would follow the
 * schema wherever the schema went and prove nothing.
 *
 * Provenance: every string below was captured by playing the PUBLISHED web
 * build (landing 7e536db, built from simple-games 74b4e58) in headless
 * Chromium with every external request blocked and an empty localStorage.
 * The game was driven through its own UI — clicks on its buttons and cells,
 * nothing written to storage by hand — and the strings are what Capacitor
 * Preferences held afterwards, copied verbatim. The play: Quick Rules to the
 * end; a hint and a few moves on Easy, leaving via Home; resume, solve it; Hard
 * the same way; today's daily the same way, then "Retry same board" and
 * a few moves, leaving via Home; and a Medium board left mid-game. Nothing here
 * is hand-built.
 *
 * Compared with 74b4e58 (`git rev-parse 74b4e58:<path> HEAD:<path>`):
 * `storage/schemas.ts`, `storage/keys.ts` and the whole `game/` tree are
 * identical. `storage/gamePersistence.ts` differs, and only in behaviour: the
 * 2026-10-02 "the daily is today's one board" change makes `loadSavedGames`
 * drop a daily slot dated another day. The daily test below therefore passes
 * the captured date as `today` explicitly, and one test pins the drop.
 *
 * Do not regenerate these records to make a change go green — from now on they
 * change only by migration. A payload that has to be rewritten is a payload
 * existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  createDailySession,
  createDifficultySession,
  doTap,
  EMPTY,
  encodeBoard,
  encodeLinks,
  type BinaryBalanceSession,
} from '../game';
import { loadSavedGames, saveGame } from './gamePersistence';
import {
  BN_STORAGE_KEYS,
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  prefsSchema,
  statsSchema,
} from './schemas';

/** The local date on the machine that played the published build. */
const DAILY_DATE = '2026-10-02';

/** Capacitor Preferences, as it stood after the play described above. */
const RELEASED: Record<string, string> = {
  [BN_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [BN_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"medium"}',
  [BN_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"easy":{"played":1,"solved":1,"totalPlaySeconds":6,"bestSeconds":6},' +
    '"medium":{"played":3,"solved":1,"totalPlaySeconds":13,"bestSeconds":5},' +
    '"hard":{"played":1,"solved":1,"totalPlaySeconds":5,"bestSeconds":5},' +
    '"dailyTimes":{"2026-10-02":5}}',
  [BN_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"mode":"difficulty","seed":"binary-balance-medium-muqq2qgf-9szl8",' +
    '"difficulty":"medium","dailyDate":null,"size":6,' +
    '"solution":"010110101010011001110100001011100101",' +
    '"givens":"0........0..0.........00............",' +
    '"marks":".00000..............................",' +
    '"links":"h13=,h15=,v28x","hintCount":1,"elapsedSeconds":5,"savedAt":1790931003407}',
  [BN_STORAGE_KEYS.dailyGame]:
    '{"schemaVersion":1,"mode":"daily","seed":"binary-balance-daily-2026-10-02",' +
    '"difficulty":"medium","dailyDate":"2026-10-02","size":6,' +
    '"solution":"100101010110101001110010001101011010",' +
    '"givens":"....0.........1...............0.1..0",' +
    '"marks":"0000................................",' +
    '"links":"v4x,h13x,v14x,v15=,h24=,v27x","hintCount":1,"elapsedSeconds":3,' +
    '"savedAt":1790930997459}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the difficulty last picked, not the default', async () => {
    // The default is easy; the captured record says medium.
    expect(await loadRecord(prefsSchema, released())).toEqual({
      schemaVersion: 1,
      difficulty: 'medium',
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      easy: { played: 1, solved: 1, totalPlaySeconds: 6, bestSeconds: 6 },
      medium: { played: 3, solved: 1, totalPlaySeconds: 13, bestSeconds: 5 },
      hard: { played: 1, solved: 1, totalPlaySeconds: 5, bestSeconds: 5 },
      dailyTimes: { '2026-10-02': 5 },
    });
  });

  it('restores the suspended difficulty board down to the cell', async () => {
    const { difficulty, daily } = await loadSavedGames(released(), DAILY_DATE);
    expect(difficulty).not.toBeNull();
    expect(daily).not.toBeNull();

    const session = difficulty!;
    expect(session.mode).toBe('difficulty');
    expect(session.seed).toBe('binary-balance-medium-muqq2qgf-9szl8');
    expect(session.difficulty).toBe('medium');
    expect(session.dailyDate).toBeNull();
    expect(session.size).toBe(6);
    // Encoded one character per cell: 0 = sun, 1 = moon, . = empty.
    expect(encodeBoard(session.solution)).toBe('010110101010011001110100001011100101');
    expect(encodeBoard(session.givens)).toBe('0........0..0.........00............');
    // Five suns the player put down before leaving, none of them on a given.
    expect(encodeBoard(session.marks)).toBe('.00000..............................');
    expect(encodeLinks(session.links)).toBe('h13=,h15=,v28x');
    expect(session.hintCount).toBe(1);
    // The seconds on the board are part of it: dropping them here is how a
    // resumed game quietly reports someone else's play time (issue #109).
    expect(session.elapsedSeconds).toBe(5);
    expect(session.status).toBe('playing');
  });

  it('restores the suspended daily down to the cell', async () => {
    // `today` is the captured date: the daily slot holds today's board or
    // nothing, so a fixed clock is what keeps this from going red tomorrow.
    const { daily } = await loadSavedGames(released(), DAILY_DATE);
    expect(daily).not.toBeNull();

    const session = daily!;
    expect(session.mode).toBe('daily');
    expect(session.seed).toBe('binary-balance-daily-2026-10-02');
    expect(session.difficulty).toBe('medium');
    expect(session.dailyDate).toBe(DAILY_DATE);
    expect(session.size).toBe(6);
    expect(encodeBoard(session.solution)).toBe('100101010110101001110010001101011010');
    expect(encodeBoard(session.givens)).toBe('....0.........1...............0.1..0');
    expect(encodeBoard(session.marks)).toBe('0000................................');
    expect(encodeLinks(session.links)).toBe('v4x,h13x,v14x,v15=,h24=,v27x');
    expect(session.hintCount).toBe(1);
    expect(session.elapsedSeconds).toBe(3);
    expect(session.status).toBe('playing');
  });

  it('keeps the two slots apart: each record lives in the key it was saved under', async () => {
    expect(await loadRecord(gameSchema, released())).toMatchObject({ mode: 'difficulty' });
    expect(await loadRecord(dailyGameSchema, released())).toMatchObject({ mode: 'daily' });
  });

  it('still deals the boards the published build dealt for these seeds', () => {
    // The seed pins the board (§10). If today's generator dealt another board
    // for the same seed, Retry and resume would quietly change under players.
    const daily = createDailySession(DAILY_DATE);
    expect(encodeBoard(daily.solution)).toBe('100101010110101001110010001101011010');
    expect(encodeBoard(daily.givens)).toBe('....0.........1...............0.1..0');
    expect(encodeLinks(daily.links)).toBe('v4x,h13x,v14x,v15=,h24=,v27x');

    const medium = createDifficultySession('medium', 'binary-balance-medium-muqq2qgf-9szl8');
    expect(encodeBoard(medium.solution)).toBe('010110101010011001110100001011100101');
    expect(encodeBoard(medium.givens)).toBe('0........0..0.........00............');
    expect(encodeLinks(medium.links)).toBe('h13=,h15=,v28x');
  });

  it('lets the restored boards be finished, and the finish is a win', async () => {
    const { difficulty, daily } = await loadSavedGames(released(), DAILY_DATE);
    for (const restored of [difficulty!, daily!]) {
      let session: BinaryBalanceSession = restored;
      for (let index = 0; index < session.solution.length; index += 1) {
        if (session.givens[index] !== EMPTY) continue;
        // A cell cycles empty → sun → moon → empty, so three taps always arrive.
        for (
          let taps = 0;
          session.marks[index] !== session.solution[index] && taps < 3;
          taps += 1
        ) {
          session = doTap(session, index)!;
        }
      }
      expect(session.status).toBe('solved');
    }
  });
});

describe('a daily left over from another day', () => {
  it('is dropped at load, record and all, while the difficulty slot stays', async () => {
    const kv = released();
    const saved = await loadSavedGames(kv, '2026-10-03');
    expect(saved.daily).toBeNull();
    expect(await kv.get(BN_STORAGE_KEYS.dailyGame)).toBeNull();
    expect(saved.difficulty?.seed).toBe('binary-balance-medium-muqq2qgf-9szl8');
    expect(await kv.get(BN_STORAGE_KEYS.game)).toBe(RELEASED[BN_STORAGE_KEYS.game]);
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BN_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preferences default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BN_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BN_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no board to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BN_STORAGE_KEYS.game]: raw, [BN_STORAGE_KEYS.dailyGame]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadRecord(dailyGameSchema, kv)).toBeNull();
    expect(await loadSavedGames(kv, DAILY_DATE)).toEqual({ difficulty: null, daily: null });
  });

  it('discards a board that does not decode rather than repairing it', async () => {
    // A shorter board string is not a smaller board — it is a record from
    // something that is not this game (§11).
    const kv = createMemoryKV({
      [BN_STORAGE_KEYS.game]: RELEASED[BN_STORAGE_KEYS.game]!.replace(
        '"010110101010011001110100001011100101"',
        '"0101"',
      ),
    });
    expect((await loadSavedGames(kv, DAILY_DATE)).difficulty).toBeNull();
  });
});

describe('a suspended board comes back the way it was left', () => {
  it('survives the round trip through storage, both slots at once', async () => {
    const { difficulty, daily } = await loadSavedGames(released(), DAILY_DATE);
    // Moves made with today's code on top of the released records.
    const moved = doTap(difficulty!, 5)!;
    const dailyMoved = doTap(daily!, 6)!;

    const kv = createMemoryKV();
    await saveGame(moved, kv);
    await saveGame(dailyMoved, kv);
    const restored = await loadSavedGames(kv, DAILY_DATE);

    for (const [before, after] of [
      [moved, restored.difficulty],
      [dailyMoved, restored.daily],
    ] as const) {
      expect(after).not.toBeNull();
      expect(after!.mode).toBe(before.mode);
      expect(after!.seed).toBe(before.seed);
      expect(after!.dailyDate).toBe(before.dailyDate);
      expect(encodeBoard(after!.solution)).toBe(encodeBoard(before.solution));
      expect(encodeBoard(after!.givens)).toBe(encodeBoard(before.givens));
      expect(encodeBoard(after!.marks)).toBe(encodeBoard(before.marks));
      expect(encodeLinks(after!.links)).toBe(encodeLinks(before.links));
      expect(after!.hintCount).toBe(before.hintCount);
      expect(after!.elapsedSeconds).toBe(before.elapsedSeconds);
      expect(after!.status).toBe('playing');
    }
  });
});
