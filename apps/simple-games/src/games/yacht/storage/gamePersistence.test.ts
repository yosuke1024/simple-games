/**
 * What a saved sheet has to prove before it is handed back (§7). Every
 * rejection below is a record play could not have produced — and the answer
 * to each is the same: discard it, and let the player land on the home
 * screen rather than in an invented game.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { CATEGORIES, createSession, roll, score, toggleHold, type YachtSession } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { gameSchema, statsSchema, YT_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [YT_STORAGE_KEYS.game]: JSON.stringify(record) });

/** One box filled, the second turn thrown once, die 2 kept. */
function midGame(): YachtSession {
  let session = roll(createSession('yacht-persist'))!;
  session = score(session, 'choice')!;
  session = roll(session)!;
  return toggleHold(session, 1)!;
}

const record = () => toPersisted({ ...midGame(), elapsedSeconds: 42 }, 1);

describe('resuming a saved sheet (§7)', () => {
  it('gives back exactly the game that was saved', async () => {
    const original = { ...midGame(), elapsedSeconds: 42 };
    expect(await loadSavedGame(saved(toPersisted(original, 1)))).toEqual(original);
  });

  it('gives back a sheet saved before its first throw', async () => {
    const fresh = createSession('yacht-persist-fresh');
    expect(await loadSavedGame(saved(toPersisted(fresh, 1)))).toEqual(fresh);
  });

  it('has nothing to resume when nothing was saved', async () => {
    expect(await loadSavedGame(createMemoryKV())).toBeNull();
  });

  it('does not bring back a full sheet', async () => {
    let session = createSession('yacht-persist-full');
    for (const category of CATEGORIES) session = score(roll(session)!, category)!;
    expect(await loadSavedGame(saved(toPersisted(session, 1)))).toBeNull();
  });
});

describe('discarding a record play could not have produced (§7)', () => {
  it('refuses a record of another version', async () => {
    expect(await loadSavedGame(saved({ ...record(), schemaVersion: 2 }))).toBeNull();
  });

  it('refuses an empty or missing seed', async () => {
    expect(await loadSavedGame(saved({ ...record(), seed: '' }))).toBeNull();
    const { seed: _dropped, ...withoutSeed } = record();
    expect(await loadSavedGame(saved(withoutSeed))).toBeNull();
  });

  it('refuses dice that are not five faces of 1..6', async () => {
    expect(await loadSavedGame(saved({ ...record(), dice: [1, 2, 3, 4] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), dice: [1, 2, 3, 4, 7] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), dice: [0, 2, 3, 4, 5] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), dice: [1, 2, 3, 4, 2.5] }))).toBeNull();
  });

  it('refuses holds that are not five flags', async () => {
    expect(
      await loadSavedGame(saved({ ...record(), held: [true, false, false, false] })),
    ).toBeNull();
    expect(
      await loadSavedGame(saved({ ...record(), held: [1, 0, 0, 0, 0] as unknown as boolean[] })),
    ).toBeNull();
  });

  it('refuses a throw count outside a turn', async () => {
    expect(await loadSavedGame(saved({ ...record(), rollsUsed: 4 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), rollsUsed: -1 }))).toBeNull();
  });

  it('refuses holds before the first throw of a turn', async () => {
    // Keeping exists only after a throw (§2).
    expect(await loadSavedGame(saved({ ...record(), rollsUsed: 0, rollIndex: 1 }))).toBeNull();
  });

  it('refuses a sheet that is not twelve boxes', async () => {
    expect(
      await loadSavedGame(saved({ ...record(), scores: record().scores.slice(1) })),
    ).toBeNull();
  });

  it('refuses a box holding points no throw could score there', async () => {
    const scores = [...record().scores];
    scores[CATEGORIES.indexOf('sixes')] = 7;
    expect(await loadSavedGame(saved({ ...record(), scores }))).toBeNull();
    scores[CATEGORIES.indexOf('sixes')] = null;
    scores[CATEGORIES.indexOf('yacht')] = 49;
    expect(await loadSavedGame(saved({ ...record(), scores }))).toBeNull();
  });

  it('refuses a throw count the sheet cannot explain', async () => {
    // One box filled and one throw this turn: two to four throws in all. The
    // throw count is half of every draw still to come (§4), so a record where
    // it disagrees would resume onto dice this game was never going to get.
    expect(await loadSavedGame(saved({ ...record(), rollIndex: 1 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), rollIndex: 5 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), rollIndex: 4 }))).not.toBeNull();
  });

  it('refuses a negative or fractional elapsed time', async () => {
    expect(await loadSavedGame(saved({ ...record(), elapsedSeconds: -1 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), elapsedSeconds: 1.5 }))).toBeNull();
  });

  it('refuses text that is not a record at all', async () => {
    const kv = createMemoryKV({ [YT_STORAGE_KEYS.game]: '{not json' });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await loadRecord(gameSchema, saved([1, 2, 3]))).toBeNull();
  });
});

describe('statistics record (§6)', () => {
  const stats = (value: unknown) =>
    loadRecord(statsSchema, createMemoryKV({ [YT_STORAGE_KEYS.stats]: JSON.stringify(value) }));
  const valid = {
    schemaVersion: 1,
    played: 4,
    completed: 3,
    bestScore: 211,
    totalScore: 540,
    totalPlaySeconds: 1800,
  };

  it('keeps a valid record, with or without a best score', async () => {
    expect(await stats(valid)).toEqual(valid);
    expect(await stats({ ...valid, completed: 0, bestScore: null, totalScore: 0 })).toEqual({
      ...valid,
      completed: 0,
      bestScore: null,
      totalScore: 0,
    });
  });

  it('falls back to an empty record rather than keep a best no sheet can reach', async () => {
    expect(await stats({ ...valid, bestScore: 298 })).toEqual(statsSchema.defaultValue());
    expect(await stats({ ...valid, bestScore: '211' })).toEqual(statsSchema.defaultValue());
  });
});
