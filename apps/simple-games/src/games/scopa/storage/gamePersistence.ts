/**
 * Converts between the in-memory ScopaSession and its `sc.saveGame` record
 * (docs/SCOPA_RULES.md §9). The match is turn-based and comes back exactly as
 * it was left: the record is the deal's public history, and the position is
 * what replaying it leaves behind.
 *
 * The schema's `validate` already ran the decoder to accept the record; the
 * loader runs the same pure function again because that is what builds the
 * session. A refused record is read past and left where it is — it may have
 * been written by a newer version — and nothing new is dealt in its place:
 * the caller lands on the home screen (§9.2).
 *
 * What is not stored is recomputed: the match status, the settled deal's
 * result and the reshuffles all follow from the seed, the score and the
 * history. The lifted card and a half-built group are not moves, so a resumed
 * match starts with nothing lifted.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { decodeSavedMatch, toSavedMatch, type ScopaSession } from '../game';
import { gameSchema, type SavedMatch } from './schemas';

export function toPersisted(session: ScopaSession, savedAt: number): SavedMatch {
  return toSavedMatch(session, savedAt);
}

export function fromPersisted(record: SavedMatch | null): ScopaSession | null {
  return record === null ? null : decodeSavedMatch(record);
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<ScopaSession | null> {
  return fromPersisted(await loadRecord(gameSchema, kv));
}

export async function saveGame(session: ScopaSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
