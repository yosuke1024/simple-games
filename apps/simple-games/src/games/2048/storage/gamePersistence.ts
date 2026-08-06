/**
 * Converts between the in-memory Game2048Session and its persisted form. The
 * board is turn-based and comes back exactly as it was left, which is why this
 * title saves at all where the arcade two deliberately do not
 * (docs/GAME_2048_RULES.md §10).
 *
 * The undo history is intentionally not persisted: the moves that led here are
 * not part of the position.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { decodeBoard, encodeBoard, restoreSession, type Game2048Session } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: Game2048Session, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    board: encodeBoard(session.board),
    score: session.score,
    spawnIndex: session.spawnIndex,
    reached2048: session.reached2048,
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): Game2048Session | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.board);
  if (board === null) return null;

  const session = restoreSession({
    seed: persisted.seed,
    board,
    score: persisted.score,
    spawnIndex: persisted.spawnIndex,
    reached2048: persisted.reached2048,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished board is not something to come back to: the next game is free
  // and starts fresh (§8).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<Game2048Session | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: Game2048Session,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
