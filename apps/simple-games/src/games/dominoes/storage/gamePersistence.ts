/**
 * Converts between the in-memory DominoesSession and its persisted form.
 * The game is turn-based and comes back exactly as it was left
 * (docs/DOMINOES_RULES.md §9): the same line, the same hands, the same
 * boneyard in the same order — so the next tile drawn is the one that would
 * have been drawn.
 *
 * Loading fails closed. The record's shape is checked by its schema, the
 * position by the game (`decodePosition`), and a game that has already ended
 * — a hand played out, or two passes in a row — is not something to come
 * back to: the next one starts fresh.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodePosition,
  encodeLine,
  encodeTiles,
  restoreSession,
  type DominoesSession,
} from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: DominoesSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    seed: session.seed,
    line: encodeLine(session.line),
    playerHand: encodeTiles(session.playerHand),
    cpuHand: encodeTiles(session.cpuHand),
    boneyard: encodeTiles(session.boneyard),
    toMove: session.toMove,
    passes: session.passes,
    moveCount: session.moveCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): DominoesSession | null {
  if (persisted === null) return null;
  const position = decodePosition(persisted);
  if (position === null) return null;
  const session = restoreSession(position);
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<DominoesSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: DominoesSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
