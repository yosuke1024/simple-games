/**
 * Converts between the in-memory PegSolitaireSession and its persisted form
 * (docs/PEG_SOLITAIRE_RULES.md §11). One slot, holding the game in progress.
 *
 * What is kept is the problem and the jumps played — the smallest record
 * there is, and the strongest check: loading replays every jump from the
 * opening through the rules, so a board play could not have produced cannot
 * come back at all. The jump list is the Undo history too, which is why a
 * resumed game can still be taken back to its first position (§6). A game
 * whose perfect clear was undone also carries `cleared: true`, so finishing
 * it again after a resume does not count a second clear (§10).
 *
 * A finished game is never written: it is cleared the moment it ends, and a
 * record that replays to a finished board is read as "nothing saved" (§11).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, toRecord, type PegSolitaireSession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

export function toPersisted(session: PegSolitaireSession, savedAt: number): PersistedGame {
  const record = toRecord(session);
  return {
    schemaVersion: 1,
    board: record.board,
    start: record.start,
    target: record.target,
    jumps: record.jumps.map(([from, to]) => [from, to]),
    elapsedSeconds: record.elapsedSeconds,
    ...(record.cleared ? { cleared: true as const } : {}),
    savedAt,
  };
}

/**
 * The game a record holds, or null. The schema has already replayed it once
 * (storage/schemas.ts `gameSchema`); this replays it again into the session
 * the screen plays on, so the two can never disagree about what was saved.
 */
export function toSession(persisted: PersistedGame | null): PegSolitaireSession | null {
  if (persisted === null) return null;
  const restored = restoreSession(persisted);
  return restored.ok ? restored.session : null;
}

export async function loadSavedGame(
  kv: KVStore = preferencesKV,
): Promise<PegSolitaireSession | null> {
  return toSession(await loadRecord(gameSchema, kv));
}

export async function saveGame(
  session: PegSolitaireSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  // Only a game still in play is a game to come back to (§11).
  if (session.status !== 'playing') return;
  await saveRecord(gameSchema, toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
