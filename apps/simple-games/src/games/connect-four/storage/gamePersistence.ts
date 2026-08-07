/**
 * Converts between the in-memory ConnectFourSession and its persisted form.
 * The match is turn-based and comes back exactly as it was left, which is
 * why this title saves at all where the arcade two deliberately do not
 * (docs/CONNECT_FOUR_RULES.md §8).
 *
 * The undo history is intentionally not persisted: the moves that led here
 * are not part of the position.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  countPieces,
  decodeBoard,
  encodeBoard,
  restoreSession,
  type ConnectFourSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: ConnectFourSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    first: session.first,
    board: encodeBoard(session.board),
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): ConnectFourSession | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.board, persisted.first);
  if (board === null) return null;

  // Every drop puts exactly one disc down, so the count on the board *is* the
  // move count. A save where the two disagree could not have come from play,
  // and it is not harmless: the move count is half the CPU's draw (§4), so a
  // resumed match would answer differently than the one that was saved —
  // which is the promise Undo rests on. Fail closed, like the board itself.
  const { player, cpu } = countPieces(board);
  if (persisted.moveCount !== player + cpu) return null;

  const session = restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    first: persisted.first,
    board,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next one is free
  // and starts fresh (§8).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(
  kv: KVStore = preferencesKV,
): Promise<ConnectFourSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: ConnectFourSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
