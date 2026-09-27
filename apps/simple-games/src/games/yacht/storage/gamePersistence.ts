/**
 * Converts between the in-memory YachtSession and its persisted form. The
 * match is turn-based and comes back exactly as it was left
 * (docs/YACHT_RULES.md §8).
 *
 * The schema (./schemas.ts) checks the record's shape — and refuses a v1
 * solo-sheet record outright, since it is not a match (§8). `restoreSession`
 * checks what only the rules can — holds before a throw, a box holding
 * points no throw could score there, the sheets out of step with each other,
 * a throw count the sheets cannot explain. Anything that fails either is
 * discarded and the player lands on the home screen, never in an invented
 * match.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, statusOf, type YachtSession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: YachtSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 2,
    seed: session.seed,
    rollIndex: session.rollIndex,
    dice: [...session.dice],
    held: [...session.held],
    rollsUsed: session.rollsUsed,
    scores: [...session.scores],
    cpuScores: [...session.cpuScores],
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): YachtSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    seed: persisted.seed,
    rollIndex: persisted.rollIndex,
    dice: persisted.dice,
    held: persisted.held,
    rollsUsed: persisted.rollsUsed,
    scores: persisted.scores,
    cpuScores: persisted.cpuScores,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // A finished match is not something to come back to: the next game starts
  // fresh (§8).
  return session !== null && statusOf(session) === 'playing' ? session : null;
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<YachtSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(session: YachtSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
