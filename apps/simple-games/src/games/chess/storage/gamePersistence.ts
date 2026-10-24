/**
 * Converts between the in-memory ChessSession and its persisted form
 * (docs/CHESS_RULES.md §7.1). The game is turn-based and comes back exactly as
 * it was left, which is why this title saves at all.
 *
 * The record is the move list, so the Undo history and the positions the
 * repetition rule counts come back with it (§6, §7.1): nothing else has to be
 * saved for either.
 *
 * Loading fails closed. The schema (./schemas.ts) refuses a record of the
 * wrong shape; this module replays the move list from the standard position
 * against the same engine the screen plays with (`restoreSession`) and
 * refuses anything the replay refuses — an illegal or malformed move, a move
 * after the end, too many plies, a finished game. Whatever is refused is no
 * saved game at all: the player lands on the home, and nothing new is started
 * in its place.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  BLACK,
  WHITE,
  encodeSessionMoves,
  isOver,
  restoreSession,
  type ChessSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

/** The record for a game in play, or null for a finished one (never saved — §7.1). */
export function toPersisted(session: ChessSession, savedAt: number): PersistedGame | null {
  if (isOver(session)) return null;
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    side: session.playerColor === WHITE ? 'white' : 'black',
    moves: encodeSessionMoves(session),
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

/** The game a record replays to, or null when the replay refuses it (§7.1). */
export function fromPersisted(persisted: PersistedGame | null): ChessSession | null {
  if (persisted === null) return null;
  return restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    playerColor: persisted.side === 'white' ? WHITE : BLACK,
    moves: persisted.moves,
    elapsedSeconds: persisted.elapsedSeconds,
  });
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<ChessSession | null> {
  return fromPersisted(await loadRecord(gameSchema, kv));
}

/**
 * Saves the game in play. A finished game has no record (§7.1), so the slot
 * is cleared instead: the next game is a new one, not something to come back
 * to.
 */
export async function saveGame(session: ChessSession, kv: KVStore = preferencesKV): Promise<void> {
  const record = toPersisted(session, Date.now());
  if (record === null) {
    await clearSavedGame(kv);
    return;
  }
  await saveRecord(gameSchema, record, kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
