import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord, saveRecord, removeRecord } from '../../../storage/repo';
import { pause, type Session } from '../game';
import { gameSchema, type PersistedGame } from './schemas';
export function toPersisted(session: Session, savedAt: number): PersistedGame | null {
  return session.status === 'over' ? null : { ...pause(session), schemaVersion: 1, savedAt };
}
export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<Session | null> {
  const record = await loadRecord(gameSchema, kv);
  if (!record) return null;
  const { seed, board, active, pieceIndex, score, lines, status, elapsedSeconds } = record;
  return { seed, board, active, pieceIndex, score, lines, status, elapsedSeconds };
}
export async function saveGame(session: Session, kv: KVStore = preferencesKV): Promise<void> {
  const record = toPersisted(session, Date.now());
  if (record) await saveRecord(gameSchema, record, kv);
}
export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
