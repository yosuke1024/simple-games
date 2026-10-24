import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { finished, type Session } from '../game';
import { gameSchema, restore, toPersisted } from './schemas';
export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<Session | null> {
  return restore(await loadRecord(gameSchema, kv));
}
export async function saveGame(session: Session, kv: KVStore = preferencesKV): Promise<void> {
  if (!finished(session)) await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}
export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
