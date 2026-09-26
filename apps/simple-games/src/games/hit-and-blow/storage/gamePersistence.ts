/**
 * Converts between the in-memory HitAndBlowSession and its persisted form
 * (docs/HIT_AND_BLOW_RULES.md §8).
 *
 * What is written is the seed and the guesses: the secret is dealt again from
 * the seed on load (§2), and the row being composed is not kept. What comes
 * back has to prove it could have come from play — every guess the right
 * length, inside the pool, no symbol twice — and a game already won is not
 * something to come back to.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type HitAndBlowSession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: HitAndBlowSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    guesses: session.guesses.map((guess) => [...guess]),
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

/** Fail closed: anything play could not have produced goes back to the home screen. */
export function fromPersisted(persisted: PersistedGame | null): HitAndBlowSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    guesses: persisted.guesses,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished game is not something to come back to: the next one is free
  // and starts fresh (§8).
  return session !== null && session.status === 'playing' ? session : null;
}

export async function loadSavedGame(
  kv: KVStore = preferencesKV,
): Promise<HitAndBlowSession | null> {
  return fromPersisted(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: HitAndBlowSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
