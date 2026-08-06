/**
 * Converts between the in-memory BlockSession and its persisted form
 * (docs/BLOCK_PUZZLE_RULES.md §10).
 *
 * A turn-based board saves honestly: what comes back is the position that was
 * left, down to the three pieces on offer. Only the undo history is dropped,
 * and that is the one thing a save cannot promise anyway — it describes a
 * path, not a position.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoard,
  decodeTray,
  encodeBoard,
  encodeTray,
  restoreSession,
  type BlockSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: BlockSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    board: encodeBoard(session.board),
    tray: encodeTray(session.tray),
    score: session.score,
    batchIndex: session.batchIndex,
    linesCleared: session.linesCleared,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): BlockSession | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.board);
  if (board === null) return null;
  const tray = decodeTray(persisted.tray);
  if (tray === null) return null;

  const session = restoreSession({
    seed: persisted.seed,
    board,
    tray,
    score: persisted.score,
    batchIndex: persisted.batchIndex,
    linesCleared: persisted.linesCleared,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A game that had already run out of room is over; there is nothing to
  // resume, and offering it would just show the result screen again (§2).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<BlockSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(session: BlockSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
