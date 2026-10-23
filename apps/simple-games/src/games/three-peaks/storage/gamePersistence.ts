import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type Session } from '../game';
import { gameSchema, type PersistedGame } from './schemas';
export function toPersisted(session: Session, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    actions: session.actions.map((action) => ({ ...action })),
    elapsedSeconds: session.elapsedSeconds,
    countedWin: session.countedWin,
    savedAt,
  };
}
export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<Session | null> {
  return restoreSession(await loadRecord(gameSchema, kv));
}
export async function saveGame(session: Session, kv: KVStore = preferencesKV): Promise<void> {
  if (session.status === 'playing')
    await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}
export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
