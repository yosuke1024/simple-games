import { preferencesKV, type KVStore } from '@/storage/kv';
import { loadRecord, removeRecord, saveRecord } from '@/storage/repo';
import type { Session } from '../game';
import { gameSchema } from './schemas';
export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<Session | null> {
  return (await loadRecord(gameSchema, kv))?.session ?? null;
}
export async function saveGame(session: Session, kv: KVStore = preferencesKV) {
  if (session.status === 'playing')
    await saveRecord(gameSchema, { schemaVersion: 1, savedAt: Date.now(), session }, kv);
}
export async function clearSavedGame(kv: KVStore = preferencesKV) {
  await removeRecord(gameSchema.key, kv);
}
