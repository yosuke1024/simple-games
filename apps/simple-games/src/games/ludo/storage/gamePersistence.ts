/**
 * The one saved-match slot: writing a session into it, and reading one back.
 *
 * Both directions are the game's own (game/serialize.ts) and neither is
 * re-implemented here. Writing is `canonicalRecordOf`, which moves the match
 * to the one state a record can express — the player, about to throw — and
 * answers null when there is nothing worth coming back to; **a null empties
 * the slot** rather than leaving yesterday's record behind to be resumed into
 * a match that has already finished. Reading is `restoreSession`, a replay of
 * the whole match from its opening that **fails closed**: a record play could
 * not have produced returns null, the save is dropped, and the player lands on
 * the home screen rather than in an invented position (docs/LUDO_RULES.md
 * §10.3). Nothing here repairs anything.
 *
 * A restored session is always standing on the canonical state, so a resumed
 * match starts with the die still to be thrown — never mid-choice, and never
 * on a CPU seat's turn.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { canonicalRecordOf, restoreSession, type LudoSession } from '../game';
import { gameSchema } from './schemas';

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<LudoSession | null> {
  const record = await loadRecord(gameSchema, kv);
  if (record === null) return null;
  const session = restoreSession(record);
  if (session === null) return null;
  // A decided match is not a match to come back to. The record cannot express
  // one (`canonicalRecordOf` refuses to write it), and the replay refuses to
  // stop on one — this states the same rule where the session is, so neither
  // layer has to rely on the other being right.
  return session.status === 'playing' ? session : null;
}

/**
 * Writes the match, canonicalized. A match that has ended — or that ends while
 * being wound forward through the CPU seats — has no record, and the slot is
 * emptied instead: leaving the previous one there would offer a resume into a
 * position the player has already left behind.
 */
export async function saveGame(session: LudoSession, kv: KVStore = preferencesKV): Promise<void> {
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
