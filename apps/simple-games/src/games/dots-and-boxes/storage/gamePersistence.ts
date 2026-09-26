/**
 * Converts between the in-memory DotsAndBoxesSession and its persisted form.
 * The match is turn-based and comes back exactly as it was left
 * (docs/DOTS_AND_BOXES_RULES.md §8).
 *
 * The undo history is intentionally not persisted: the lines that led here
 * are not part of the position.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoard,
  drawnEdgeCount,
  PLAYER,
  restoreSession,
  type DotsAndBoxesSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: DotsAndBoxesSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    size: session.size,
    seed: session.seed,
    edges: session.board.edges,
    boxes: session.board.boxes,
    toMove: session.toMove,
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): DotsAndBoxesSession | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.size, persisted.edges, persisted.boxes);
  if (board === null) return null;

  // Every move draws exactly one line, so the lines on the board *are* the
  // move count. A save where the two disagree could not have come from play,
  // and it is not harmless: the move count is half the CPU's draw (§4), so a
  // resumed match would answer differently than the one that was saved —
  // which is the promise Undo rests on. Fail closed, like the board itself.
  if (persisted.moveCount !== drawnEdgeCount(board)) return null;
  // The player always draws first (§1): an untouched board on the CPU's turn
  // is a record no match produced.
  if (persisted.moveCount === 0 && persisted.toMove !== PLAYER) return null;

  const session = restoreSession({
    seed: persisted.seed,
    size: persisted.size,
    board,
    toMove: persisted.toMove,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next one starts
  // fresh (§8).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(
  kv: KVStore = preferencesKV,
): Promise<DotsAndBoxesSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: DotsAndBoxesSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
