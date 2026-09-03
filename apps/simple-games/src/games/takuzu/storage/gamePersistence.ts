/**
 * Converts between the in-memory TakuzuSession and its persisted form
 * (docs/TAKUZU_RULES.md §11).
 *
 * Loading is fail-closed, and `decodeBoards` is where that happens: a record
 * only becomes a session if it is one play could have produced — a solution
 * that keeps all three rules, givens that agree with it, and no mark sitting on
 * top of a given. Anything else is dropped for a fresh board, because the
 * alternative is handing the player a puzzle whose answer is wrong.
 *
 * Each mode has its own slot, so suspending a level game and playing the daily
 * (or a free board, §7) never costs you any of them.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoards,
  encodeBoard,
  restoreSession,
  type GameMode,
  type TakuzuSession,
} from '../game';
import { dailyGameSchema, freeGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: TakuzuSession | null;
  daily: TakuzuSession | null;
  free: TakuzuSession | null;
}

const schemaFor = (mode: GameMode) =>
  mode === 'daily' ? dailyGameSchema : mode === 'free' ? freeGameSchema : gameSchema;

export function toPersisted(session: TakuzuSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    size: session.size,
    dailyDate: session.dailyDate,
    level: session.level,
    givens: encodeBoard(session.givens),
    solution: encodeBoard(session.solution),
    marks: encodeBoard(session.marks),
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

export function toSession(persisted: PersistedGame | null): TakuzuSession | null {
  if (persisted === null) return null;
  const boards = decodeBoards(persisted, persisted.size);
  if (boards === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    size: persisted.size,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    solution: boards.solution,
    givens: boards.givens,
    marks: boards.marks,
    elapsedSeconds: persisted.elapsedSeconds,
    hintCount: persisted.hintCount,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [level, daily, free] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
    loadRecord(freeGameSchema, kv),
  ]);
  return { level: toSession(level), daily: toSession(daily), free: toSession(free) };
}

export async function saveGame(session: TakuzuSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
