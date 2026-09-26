/**
 * What a saved game has to prove before it is handed back
 * (docs/HIT_AND_BLOW_RULES.md §8): a shape the schema accepts, guesses the
 * rules could have accepted for its difficulty, and a game still in play.
 * Anything else goes back to the home screen — never repaired, never
 * replaced by a new game nobody asked for.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { createSession, pushSymbol, submitGuess, type HitAndBlowSession } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import {
  gameSchema,
  HB_STORAGE_KEYS,
  prefsSchema,
  statsSchema,
  type PersistedGame,
} from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [HB_STORAGE_KEYS.game]: JSON.stringify(record) });

function guessOnce(session: HitAndBlowSession, guess: readonly number[]): HitAndBlowSession {
  const composed = guess.reduce((current, symbol) => pushSymbol(current, symbol)!, session);
  return submitGuess(composed)!;
}

/** One wrong guess in: a game in play with a history of one. */
function afterOneGuess(): { session: HitAndBlowSession; record: PersistedGame } {
  const start = createSession('normal', 'hit-and-blow-persist');
  const session = guessOnce(start, [...start.secret].reverse());
  return { session, record: toPersisted(session, 1) };
}

describe('resuming a saved game (§8)', () => {
  it('gives back the game that was saved, secret and all', async () => {
    const { session, record } = afterOneGuess();
    const loaded = await loadSavedGame(saved(record));
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe(session.seed);
    expect(loaded!.secret).toEqual(session.secret);
    expect(loaded!.guesses).toEqual(session.guesses);
    expect(loaded!.status).toBe('playing');
  });

  it('writes the seed, never the secret, and never the row being composed', () => {
    const { session } = afterOneGuess();
    const composing = pushSymbol(session, session.secret[0]!)!;
    const text = JSON.stringify(toPersisted(composing, 1));
    expect(Object.keys(JSON.parse(text) as object).sort()).toEqual(
      ['difficulty', 'elapsedSeconds', 'guesses', 'savedAt', 'schemaVersion', 'seed'].sort(),
    );
  });

  it('starts an untouched game with an empty history', async () => {
    const record = toPersisted(createSession('easy', 'hit-and-blow-fresh'), 1);
    const loaded = await loadSavedGame(saved(record));
    expect(loaded!.guesses).toEqual([]);
  });

  it('keeps no game at all when nothing was saved', async () => {
    expect(await loadSavedGame(createMemoryKV())).toBeNull();
  });
});

describe('discarding what play could not have produced (§8)', () => {
  it('a guess of the wrong length for its difficulty', async () => {
    const { record } = afterOneGuess();
    expect(await loadSavedGame(saved({ ...record, guesses: [[0, 1, 2]] }))).toBeNull();
    // A normal-length guess is the wrong length for hard.
    expect(await loadSavedGame(saved({ ...record, difficulty: 'hard' }))).toBeNull();
  });

  it('a symbol outside its difficulty’s pool', async () => {
    const { record } = afterOneGuess();
    // 7 is on the normal palette but not on the easy one.
    const easy = { ...record, difficulty: 'easy', guesses: [[0, 1, 2, 7]] };
    expect(await loadSavedGame(saved(easy))).toBeNull();
    expect(await loadSavedGame(saved({ ...record, guesses: [[0, 1, 2, 9]] }))).toBeNull();
  });

  it('a symbol twice in one guess', async () => {
    const { record } = afterOneGuess();
    expect(await loadSavedGame(saved({ ...record, guesses: [[0, 1, 1, 2]] }))).toBeNull();
  });

  it('a game already won', async () => {
    const start = createSession('easy', 'hit-and-blow-won');
    const won = guessOnce(start, start.secret);
    expect(won.status).toBe('won');
    expect(await loadSavedGame(saved(toPersisted(won, 1)))).toBeNull();
  });

  it('a record missing its seed, its difficulty, or its guesses', async () => {
    const { record } = afterOneGuess();
    const { seed: _seed, ...noSeed } = record;
    const { difficulty: _difficulty, ...noDifficulty } = record;
    const { guesses: _guesses, ...noGuesses } = record;
    expect(await loadSavedGame(saved(noSeed))).toBeNull();
    expect(await loadSavedGame(saved(noDifficulty))).toBeNull();
    expect(await loadSavedGame(saved(noGuesses))).toBeNull();
    expect(await loadSavedGame(saved({ ...record, seed: '' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record, schemaVersion: 2 }))).toBeNull();
  });

  it('never throws on garbage', () => {
    for (const raw of [null, 7, 'x', [], {}, { schemaVersion: 1, guesses: 'no' }]) {
      expect(() => gameSchema.validate(raw)).not.toThrow();
      expect(gameSchema.validate(raw)).toBeNull();
    }
  });
});

describe('the other records', () => {
  it('prefs default to easy and keep only a known difficulty (§1)', () => {
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'hard' })).toEqual({
      schemaVersion: 1,
      difficulty: 'hard',
    });
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'expert' })).toBeNull();
  });

  it('stats round-trip, and a best of zero guesses is not a record (§7)', () => {
    const stats = statsSchema.defaultValue();
    stats.easy = { played: 3, solved: 2, bestGuesses: 4, totalGuesses: 11 };
    stats.totalPlaySeconds = 90;
    expect(statsSchema.validate(JSON.parse(JSON.stringify(stats)))).toEqual(stats);
    const zero = { ...stats, easy: { ...stats.easy, bestGuesses: 0 } };
    expect(statsSchema.validate(zero)).toBeNull();
  });
});
