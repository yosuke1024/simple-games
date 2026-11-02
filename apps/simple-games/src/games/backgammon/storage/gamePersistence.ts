/**
 * Converts between the in-memory BackgammonSession and its persisted form
 * (docs/BACKGAMMON_RULES.md §9). The record holds inputs only; the position is
 * replayed from them on load, and a record the replay cannot accept is dropped
 * rather than repaired — the caller goes home with no match to resume.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { canonicalRecordOf, restoreSession } from '../game/persistence';
import type { BackgammonSession } from '../game/session';
import { gameSchema } from './schemas';

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<BackgammonSession | null> {
  const record = await loadRecord(gameSchema, kv);
  return record === null ? null : restoreSession(record);
}

/**
 * Saves the match at its canonical state (§9.2), or clears the slot when the
 * match has nothing to come back to — it is decided, or decides while being
 * wound forward.
 */
export async function saveGame(
  session: BackgammonSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  const record = canonicalRecordOf(session, Date.now());
  if (record === null) {
    await removeRecord(gameSchema.key, kv);
    return;
  }
  await saveRecord(gameSchema, record, kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
