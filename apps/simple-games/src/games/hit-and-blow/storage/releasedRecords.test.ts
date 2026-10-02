/**
 * The records the published web build actually wrote, read by today's
 * validators — frozen at graduation (2026-10-02, docs/RELEASE_CHECKLIST.md §0,
 * docs/HIT_AND_BLOW_RULES.md §8).
 *
 * Hit & Blow went from the web-only beta channel into the app on 2026-10-02.
 * From that day a player can carry these records from the web build into the
 * app's storage format, and from one app version to the next, so the schema
 * is frozen here: a validator is only proven by data it did not generate
 * itself. Building a payload from `defaultValue()` would prove nothing — it
 * would follow the schema wherever the schema went.
 *
 * Provenance: captured by actually playing the published web build (pixapps-landing
 * 7e536db, built from simple-games 74b4e58) in headless Chromium with every
 * external request blocked, through the game's own UI (palette taps, Check,
 * Home, the difficulty buttons and the replace-game dialog; the tutorial was
 * stepped through to its end). The guesses were chosen by a script that read
 * only the hit/blow counts the history shows, as a player would. Nothing was
 * written to storage by hand. The strings below are what Capacitor Preferences
 * held afterwards, copied verbatim: one run for the final state (flags, prefs
 * on Hard, statistics, a suspended Hard game) and, from the moment before the
 * Hard game replaced it, the Normal slot of the same run.
 * Nothing here is hand-built.
 *
 * Provenance of the code: `git rev-parse` at graduation shows these paths are
 * identical (same tree/blob hash) at 74b4e58 and at the graduation commit, so
 * what the published build wrote is what this build reads:
 *   storage/schemas.ts, storage/keys.ts, storage/gamePersistence.ts,
 *   the whole game/ tree, state/statsLogic.ts — all identical.
 * Nothing differs. (The 2026-10-02 "daily is today's one board" change does
 * not touch this title: it has no daily, only the one suspended slot.)
 *
 * Do not regenerate them to make a change go green: a payload that has to be
 * rewritten is a payload existing players cannot load either. From now on
 * these records change only by migration (a SchemaDef version bump).
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import {
  createSession,
  isDifficulty,
  judge,
  pushSymbol,
  secretFor,
  submitGuess,
  type HitAndBlowSession,
} from '../game';
import { clearSavedGame, loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, gameSchema, HB_STORAGE_KEYS, prefsSchema, statsSchema } from './schemas';

/** Capacitor Preferences after: tutorial, one solved Easy, a Normal replaced by a Hard left mid-game. */
const RELEASED: Record<string, string> = {
  [HB_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [HB_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"difficulty":"hard"}',
  [HB_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"totalPlaySeconds":19,"easy":{"played":1,"solved":1,"bestGuesses":3,' +
    '"totalGuesses":3},"normal":{"played":1,"solved":0,"bestGuesses":null,"totalGuesses":0},' +
    '"hard":{"played":1,"solved":0,"bestGuesses":null,"totalGuesses":0}}',
  [HB_STORAGE_KEYS.game]:
    '{"schemaVersion":1,"seed":"hit-and-blow-hard-muqq36og-1qdld",' +
    '"difficulty":"hard","guesses":[[2,5,6,0,1],[0,1,2,3,5]],"elapsedSeconds":6,' +
    '"savedAt":1790931026096}',
};

/** The suspended Normal game, as the same run left it, before the Hard game replaced it. */
const RELEASED_NORMAL_SLOT =
  '{"schemaVersion":1,"seed":"hit-and-blow-normal-muqq30au-4i9t5","difficulty":"normal",' +
  '"guesses":[[2,5,6,0],[0,1,6,3],[0,5,1,4]],"elapsedSeconds":7,"savedAt":1790931018428}';

const released = () => createMemoryKV({ ...RELEASED });

describe('records the published build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads the difficulty last picked', async () => {
    const prefs = await loadRecord(prefsSchema, released());
    expect(prefs).toEqual({ schemaVersion: 1, difficulty: 'hard' });
    expect(isDifficulty(prefs.difficulty)).toBe(true);
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      totalPlaySeconds: 19,
      easy: { played: 1, solved: 1, bestGuesses: 3, totalGuesses: 3 },
      // Started and replaced: counted as played, never as a solve (§7).
      normal: { played: 1, solved: 0, bestGuesses: null, totalGuesses: 0 },
      hard: { played: 1, solved: 0, bestGuesses: null, totalGuesses: 0 },
    });
  });

  it('reads the saved-game record field by field', async () => {
    expect(await loadRecord(gameSchema, released())).toEqual({
      schemaVersion: 1,
      seed: 'hit-and-blow-hard-muqq36og-1qdld',
      difficulty: 'hard',
      guesses: [
        [2, 5, 6, 0, 1],
        [0, 1, 2, 3, 5],
      ],
      elapsedSeconds: 6,
      savedAt: 1790931026096,
    });
  });
});

describe('a suspended game comes back the way it was left', () => {
  it('restores the Hard game down to the history and the clock', async () => {
    const session = await loadSavedGame(released());
    expect(session).not.toBeNull();
    expect(session!.seed).toBe('hit-and-blow-hard-muqq36og-1qdld');
    expect(session!.difficulty).toBe('hard');
    expect(session!.guesses).toEqual([
      [2, 5, 6, 0, 1],
      [0, 1, 2, 3, 5],
    ]);
    expect(session!.elapsedSeconds).toBe(6);
    expect(session!.status).toBe('playing');
    // The row being composed is never part of the save (§8).
    expect(session!.draft).toEqual([null, null, null, null, null]);
  });

  it('deals the same secret again from the seed — the pegs the player saw still hold', async () => {
    const session = await loadSavedGame(released());
    // The feedback the published build showed for these two guesses
    // (0 Hits · 4 Blows each), and the secret the seed deals today.
    expect(judge(session!.secret, [2, 5, 6, 0, 1])).toEqual({ hits: 0, blows: 4 });
    expect(judge(session!.secret, [0, 1, 2, 3, 5])).toEqual({ hits: 0, blows: 4 });
    expect(session!.secret).toEqual(secretFor('hit-and-blow-hard-muqq36og-1qdld', 'hard'));
    expect(session!.secret).toHaveLength(5);
  });

  it('restores the Normal game too, with its own pegs', async () => {
    const kv = createMemoryKV({ [HB_STORAGE_KEYS.game]: RELEASED_NORMAL_SLOT });
    const session = await loadSavedGame(kv);
    expect(session).not.toBeNull();
    expect(session!.seed).toBe('hit-and-blow-normal-muqq30au-4i9t5');
    expect(session!.difficulty).toBe('normal');
    expect(session!.guesses).toEqual([
      [2, 5, 6, 0],
      [0, 1, 6, 3],
      [0, 5, 1, 4],
    ]);
    expect(session!.elapsedSeconds).toBe(7);
    expect(session!.status).toBe('playing');
    // What the published build showed: 1·1, 1·1 and 0·2.
    expect(judge(session!.secret, [2, 5, 6, 0])).toEqual({ hits: 1, blows: 1 });
    expect(judge(session!.secret, [0, 1, 6, 3])).toEqual({ hits: 1, blows: 1 });
    expect(judge(session!.secret, [0, 5, 1, 4])).toEqual({ hits: 0, blows: 2 });
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"tutorialCompleted":true}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [HB_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the preferences default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [HB_STORAGE_KEYS.prefs]: raw });
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [HB_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('offers no game to resume for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [HB_STORAGE_KEYS.game]: raw });
    expect(await loadRecord(gameSchema, kv)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('discards a history the rules could not have accepted rather than repairing it', async () => {
    // A symbol twice in one guess never comes from play (§3).
    const kv = createMemoryKV({
      [HB_STORAGE_KEYS.game]: RELEASED[HB_STORAGE_KEYS.game]!.replace('[2,5,6,0,1]', '[2,2,6,0,1]'),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('does not bring a finished game back (§8)', async () => {
    const seed = 'hit-and-blow-hard-muqq36og-1qdld';
    const secret = secretFor(seed, 'hard');
    const won = JSON.stringify({
      schemaVersion: 1,
      seed,
      difficulty: 'hard',
      guesses: [[2, 5, 6, 0, 1], [...secret]],
      elapsedSeconds: 6,
      savedAt: 1790931026096,
    });
    const kv = createMemoryKV({ [HB_STORAGE_KEYS.game]: won });
    expect(await loadRecord(gameSchema, kv)).not.toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe("what today's code writes, today's code reads back", () => {
  /** Two real guesses on a fixed seed: a game in play with a history of two. */
  function twoGuesses(): HitAndBlowSession {
    let session = createSession('hard', 'hit-and-blow-round-trip');
    for (const guess of [
      [0, 1, 2, 3, 4],
      [5, 6, 7, 0, 1],
    ]) {
      for (const symbol of guess) session = pushSymbol(session, symbol)!;
      session = submitGuess({ ...session, elapsedSeconds: session.elapsedSeconds + 4 })!;
    }
    return session;
  }

  it('survives the round trip through storage', async () => {
    const session = twoGuesses();
    expect(session.status).toBe('playing');

    const kv = createMemoryKV();
    await saveGame(session, kv);
    const restored = await loadSavedGame(kv);

    expect(restored).not.toBeNull();
    expect(restored!.seed).toBe(session.seed);
    expect(restored!.difficulty).toBe('hard');
    expect(restored!.guesses).toEqual(session.guesses);
    expect(restored!.guesses).toHaveLength(2);
    expect(restored!.secret).toEqual(session.secret);
    expect(restored!.elapsedSeconds).toBe(8);
    expect(restored!.status).toBe('playing');
  });

  it('writes the same shape the published build wrote', async () => {
    const kv = createMemoryKV();
    await saveGame(twoGuesses(), kv);
    const written = JSON.parse((await kv.get(HB_STORAGE_KEYS.game))!) as Record<string, unknown>;
    const published = JSON.parse(RELEASED[HB_STORAGE_KEYS.game]!) as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual(Object.keys(published).sort());
    expect(written.schemaVersion).toBe(1);
    expect(typeof written.savedAt).toBe('number');
  });

  it('saves and reloads flags, preferences and statistics unchanged', async () => {
    const kv = createMemoryKV();
    const flags = await loadRecord(flagsSchema, released());
    const prefs = await loadRecord(prefsSchema, released());
    const stats = await loadRecord(statsSchema, released());
    await saveRecord(flagsSchema, flags, kv);
    await saveRecord(prefsSchema, prefs, kv);
    await saveRecord(statsSchema, stats, kv);
    expect(await loadRecord(flagsSchema, kv)).toEqual(flags);
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefs);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);
  });

  it('leaves no game to resume once the slot is cleared', async () => {
    const kv = released();
    expect(await loadSavedGame(kv)).not.toBeNull();
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
});
