import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import type { Session } from '../game';
import { gameSchema } from './schemas';
export const loadSavedGame = (kv: KVStore = preferencesKV): Promise<Session | null> =>
  loadRecord(gameSchema, kv);
export const clearSavedGame = (kv: KVStore = preferencesKV): Promise<void> =>
  removeRecord(gameSchema.key, kv);
export function saveGame(session: Session, kv: KVStore = preferencesKV): Promise<void> {
  return session.status === 'playing' ? saveRecord(gameSchema, session, kv) : clearSavedGame(kv);
}
