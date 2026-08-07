/**
 * Converts between the in-memory ReversiSession and its persisted form. The
 * match is turn-based and comes back exactly as it was left, which is why
 * this title saves at all where the arcade two deliberately do not
 * (docs/REVERSI_RULES.md §9).
 *
 * The undo history is intentionally not persisted: the moves that led here
 * are not part of the position.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { decodeBoard, encodeBoard, restoreSession, type ReversiSession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: ReversiSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    playerColor: session.playerColor,
    board: encodeBoard(session.board),
    toMove: session.toMove,
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): ReversiSession | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.board);
  if (board === null) return null;

  const session = restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    playerColor: persisted.playerColor,
    board,
    toMove: persisted.toMove,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next one is free
  // and starts fresh (§9).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<ReversiSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: ReversiSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
