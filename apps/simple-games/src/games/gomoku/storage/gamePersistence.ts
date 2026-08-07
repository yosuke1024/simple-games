/**
 * Converts between the in-memory GomokuSession and its persisted form. The
 * match is turn-based and comes back exactly as it was left, which is why
 * this title saves at all where the arcade ones deliberately do not
 * (docs/GOMOKU_RULES.md §8).
 *
 * The undo history is intentionally not persisted: the moves that led here
 * are not part of the position.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { countStones, decodeBoard, encodeBoard, restoreSession, type GomokuSession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: GomokuSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    playerColor: session.playerColor,
    board: encodeBoard(session.board),
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): GomokuSession | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.board);
  if (board === null) return null;

  // Every move puts exactly one stone down and none are ever removed, so the
  // count on the board *is* the move count. A save where the two disagree
  // could not have come from play, and it is not harmless: the move count is
  // half the CPU's draw (§4), so a resumed match would answer differently
  // than the one that was saved — which is the promise Undo rests on. Fail
  // closed, like the board itself.
  const { black, white } = countStones(board);
  if (persisted.moveCount !== black + white) return null;

  const session = restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    playerColor: persisted.playerColor,
    board,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next one is free
  // and starts fresh (§8).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<GomokuSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(session: GomokuSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
