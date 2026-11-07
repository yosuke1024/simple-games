import { preferencesKV, type KVStore } from '@/storage/kv';
import { loadRecord, removeRecord, saveRecord } from '@/storage/repo';
import type { Card, Session } from '../game';
import { arrangeHand } from '../game/handOrder';
import { gameSchema } from './schemas';
/** A resumable game and the order the player had put their hand in. */
export interface SavedGame {
  session: Session;
  handOrder: Card[];
}
export async function loadSaved(kv: KVStore = preferencesKV): Promise<SavedGame | null> {
  const record = await loadRecord(gameSchema, kv);
  return record ? { session: record.session, handOrder: record.handOrder } : null;
}
export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<Session | null> {
  return (await loadSaved(kv))?.session ?? null;
}
/**
 * `handOrder` is read against the hand being saved, so a stale order — or none,
 * which is the sorted hand — is stored as the arrangement the screen shows.
 */
export async function saveGame(
  session: Session,
  kv: KVStore = preferencesKV,
  handOrder: readonly Card[] = [],
) {
  if (session.status === 'playing')
    await saveRecord(
      gameSchema,
      {
        schemaVersion: 2,
        savedAt: Date.now(),
        session,
        handOrder: arrangeHand(handOrder, session.hands[0]!),
      },
      kv,
    );
}
export async function clearSavedGame(kv: KVStore = preferencesKV) {
  await removeRecord(gameSchema.key, kv);
}
