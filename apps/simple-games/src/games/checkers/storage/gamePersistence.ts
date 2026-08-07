/**
 * Converts between the in-memory CheckersSession and its persisted form. The
 * match is turn-based and comes back exactly as it was left, which is why
 * this title saves at all where the arcade ones deliberately do not
 * (docs/CHECKERS_RULES.md §8).
 *
 * The undo history is intentionally not persisted: the moves that led here
 * are not part of the position.
 *
 * Loading fails closed on anything play could not have produced. Two checks
 * beyond the board's own validation matter, and both exist because the move
 * count is half the CPU's draw (§4): a resumed match that answers differently
 * from the one that was saved would break the promise Undo rests on (§5).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoard,
  encodeBoard,
  hasJumpFrom,
  restoreSession,
  sideToMove,
  type CheckersSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: CheckersSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    first: session.first,
    board: encodeBoard(session.board),
    moveCount: session.moveCount,
    quietPlies: session.quietPlies,
    pendingJumpFrom: session.pendingJumpFrom ?? -1,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): CheckersSession | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.board);
  if (board === null) return null;

  // A half-played sequence has to still be one. The saved cell must hold a
  // piece of the side whose turn it is, and that piece must actually have a
  // jump — otherwise the restored match would sit forever on an obligation
  // nothing can discharge, with every other piece frozen (§2).
  const pendingJumpFrom = persisted.pendingJumpFrom;
  if (pendingJumpFrom >= 0) {
    const side = sideToMove(persisted.moveCount, persisted.first);
    if (!hasJumpFrom(board, pendingJumpFrom, side)) return null;
  }

  const session = restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    first: persisted.first,
    board,
    moveCount: persisted.moveCount,
    quietPlies: persisted.quietPlies,
    pendingJumpFrom: pendingJumpFrom >= 0 ? pendingJumpFrom : null,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next one is free
  // and starts fresh (§8).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<CheckersSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: CheckersSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
