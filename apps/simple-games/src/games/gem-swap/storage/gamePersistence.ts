/**
 * Converts between the in-memory GemSwapSession and its persisted form
 * (docs/GEM_SWAP_RULES.md §7). One slot, holding the round in progress.
 *
 * What is kept is the replay triple — seed, gem count, the valid swaps in
 * order — and the play seconds, never a board: loading replays every swap
 * from the seed's initial board through the rules, so a board play could
 * not have produced cannot come back at all, and the swap list is the Undo
 * history too, so a resumed round can still be taken back to its first
 * swap (§6).
 *
 * A finished round is never written: it is removed the moment it ends, and
 * a record that replays to a finished round is read as "nothing saved".
 *
 * Every check is the schema's (storage/schemas.ts), and Backup & Restore runs
 * that same schema, so a backup can neither carry nor bring in a round this
 * loader refuses. Loading adds no check of its own. A refused record is not
 * deleted, as in every game: the slot's next write replaces it.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, toSessionRecord, type GemSwapSession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

/** The record for a round worth coming back to, or null for a finished one. */
export function toPersisted(session: GemSwapSession, savedAt: number): PersistedGame | null {
  const record = toSessionRecord(session);
  if (record === null) return null;
  return {
    schemaVersion: 1,
    seed: record.seed,
    colors: record.colors,
    swaps: record.swaps.map(([a, b]) => [a, b]),
    elapsedSeconds: record.elapsedSeconds,
    savedAt,
  };
}

/**
 * The round a record holds, or null. The schema has already replayed it once;
 * this replays it again into the session the screen plays on, so the two can
 * never disagree about what was saved.
 */
export function fromPersisted(persisted: PersistedGame | null): GemSwapSession | null {
  return persisted === null ? null : restoreSession(persisted);
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<GemSwapSession | null> {
  return fromPersisted(await loadRecord(gameSchema, kv));
}

/** Writes the round if it is one to come back to; a finished round is not. */
export async function saveGame(
  session: GemSwapSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  const record = toPersisted(session, Date.now());
  if (record === null) return;
  await saveRecord(gameSchema, record, kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
