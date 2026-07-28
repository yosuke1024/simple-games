/**
 * Converts between the in-memory GameSession and its persisted form.
 * Undo history is intentionally not persisted (spec §8.1).
 */
import { decodeBoard, encodeBoard, restoreSession, type GameSession } from '../game';
import type { KVStore } from './kv';
import { preferencesKV } from './kv';
import { loadRecord, removeRecord, saveRecord } from './repo';
import { gameSchema, STORAGE_KEYS, type PersistedGame } from './schemas';

export function toPersisted(session: GameSession, savedAt: number): PersistedGame {
  const { values, mask } = encodeBoard(session.board);
  return {
    schemaVersion: 2,
    mode: session.mode,
    seed: session.seed,
    dailyDate: session.dailyDate,
    level: session.level,
    values,
    mask,
    score: session.score,
    moveCount: session.moveCount,
    addCount: session.addCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

/** Returns null when nothing (or corrupt data) is stored. */
export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<GameSession | null> {
  const persisted = await loadRecord(gameSchema, kv);
  if (persisted === null) return null;
  const board = decodeBoard({ values: persisted.values, mask: persisted.mask });
  if (board === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    board,
    score: persisted.score,
    moveCount: persisted.moveCount,
    addCount: persisted.addCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume games that are still playable.
  return session.status === 'playing' ? session : null;
}

export async function saveGame(session: GameSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(STORAGE_KEYS.game, kv);
}
