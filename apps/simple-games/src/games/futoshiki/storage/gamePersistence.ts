/**
 * Converts between the in-memory FutoshikiSession and its persisted form
 * (docs/FUTOSHIKI_RULES.md §11). Undo history is deliberately not persisted
 * (§5).
 *
 * Loading is fail-closed, and `decodeGame` in the game layer is where that
 * happens: a record only becomes a session if it is one play could have
 * produced — a solution that is a Latin square, signs that point the way the
 * solution reads, givens that agree with it, no entry sitting on a given, and
 * no note under a written digit. Anything else is dropped for a fresh board,
 * because the alternative is handing the player a puzzle whose answer is
 * wrong.
 *
 * The rules live in one place on purpose. This module knows the shape of the
 * record; the game knows what a legal board is, and asking it is what keeps
 * the two from drifting.
 *
 * Each mode has its own slot, so suspending a level game and playing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeGame,
  encodeConstraints,
  encodeGrid,
  encodeNotes,
  restoreSession,
  type FutoshikiSession,
  type GameMode,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: FutoshikiSession | null;
  daily: FutoshikiSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: FutoshikiSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    size: session.size,
    dailyDate: session.dailyDate,
    level: session.level,
    solution: encodeGrid(session.solution),
    constraints: encodeConstraints(session.constraints, session.size),
    givens: encodeGrid(session.board.givens),
    entries: encodeGrid(session.board.entries),
    notes: encodeNotes(session.board.notes),
    mistakeCount: session.mistakeCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): FutoshikiSession | null {
  if (persisted === null) return null;
  const decoded = decodeGame(persisted, persisted.size);
  if (decoded === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    size: persisted.size,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    solution: decoded.solution,
    constraints: decoded.constraints,
    board: decoded.board,
    mistakeCount: persisted.mistakeCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [level, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { level: toSession(level), daily: toSession(daily) };
}

export async function saveGame(
  session: FutoshikiSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
