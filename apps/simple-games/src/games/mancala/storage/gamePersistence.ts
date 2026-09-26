/**
 * Converts between the in-memory MancalaSession and its persisted form. The
 * match is turn-based and comes back exactly as it was left, which is why
 * this title saves at all (docs/MANCALA_RULES.md §8).
 *
 * The undo history is intentionally not persisted: the moves that led here
 * are not part of the position.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodePits,
  encodePits,
  initialPits,
  restoreSession,
  samePits,
  type MancalaSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: MancalaSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    difficulty: session.difficulty,
    first: session.first,
    pits: encodePits(session.pits),
    toMove: session.toMove,
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): MancalaSession | null {
  if (persisted === null) return null;
  // Seeds are moved, never made or lost: fourteen counts that do not add up
  // to 48 could not have come from play (§8).
  const pits = decodePits(persisted.pits);
  if (pits === null) return null;

  // Before the first move there is only one position, and only one side to
  // move in it. A save claiming no moves on any other board — or on the
  // opening with the wrong side up — did not come from play either, and the
  // move count is half the CPU's draw (§4), so it is not harmless.
  if (
    persisted.moveCount === 0 &&
    (!samePits(pits, initialPits()) || persisted.toMove !== persisted.first)
  ) {
    return null;
  }

  const session = restoreSession({
    seed: persisted.seed,
    difficulty: persisted.difficulty,
    first: persisted.first,
    pits,
    toMove: persisted.toMove,
    moveCount: persisted.moveCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next one starts
  // fresh (§8).
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<MancalaSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: MancalaSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
