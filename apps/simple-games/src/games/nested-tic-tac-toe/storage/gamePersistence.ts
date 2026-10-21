/**
 * Converts between the in-memory NestedSession and its persisted form
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §8). The match is turn-based and comes
 * back exactly as it was left, which is why this title saves at all.
 *
 * The record is the move list, so the Undo history comes back with it (§5):
 * taking moves off the end of the list is the history, and nothing else has
 * to be saved for it.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { sessionFromSavedGame, toSavedGame, type NestedSession } from '../game';
import { gameSchema } from './schemas';

/**
 * The suspended match, or null — for nothing saved, and for anything the
 * replay refuses (§8.2). A finished match is never saved, and one found in
 * storage is not trusted either: the validator refuses a list whose replay
 * ends finished.
 */
export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<NestedSession | null> {
  const saved = await loadRecord(gameSchema, kv);
  return saved === null ? null : sessionFromSavedGame(saved);
}

/**
 * Saves the match in play. A finished match has no record (§8.1 — the writer
 * returns null for one), so the slot is cleared instead: the next match is a
 * new one, not something to come back to.
 */
export async function saveGame(session: NestedSession, kv: KVStore = preferencesKV): Promise<void> {
  const record = toSavedGame(session, Date.now());
  if (record === null) {
    await clearSavedGame(kv);
    return;
  }
  await saveRecord(gameSchema, record, kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
