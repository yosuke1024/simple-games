/**
 * Converts between the in-memory NonogramSession and its persisted form
 * (docs/NONOGRAM_RULES.md §10). Clues are not persisted — they are recomputed
 * from the saved solution, which cannot drift from it.
 *
 * Each mode has its own slot, so suspending a level game and playing the daily
 * (or a free board, §6) never costs you any of them.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeMarks,
  decodeSolution,
  encodeCells,
  restoreSession,
  type GameMode,
  type NonogramSession,
} from '../game';
import { dailyGameSchema, freeGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: NonogramSession | null;
  daily: NonogramSession | null;
  free: NonogramSession | null;
}

const schemaFor = (mode: GameMode) =>
  mode === 'daily' ? dailyGameSchema : mode === 'free' ? freeGameSchema : gameSchema;

export function toPersisted(session: NonogramSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    size: session.size,
    dailyDate: session.dailyDate,
    level: session.level,
    freeTier: session.freeTier,
    solution: encodeCells(session.solution),
    marks: encodeCells(session.marks),
    elapsedSeconds: session.elapsedSeconds,
    hintCount: session.hintCount,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): NonogramSession | null {
  if (persisted === null) return null;
  const solution = decodeSolution(persisted.solution, persisted.size);
  const marks = decodeMarks(persisted.marks, persisted.size);
  if (solution === null || marks === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    size: persisted.size,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    freeTier: persisted.freeTier,
    solution,
    marks,
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

export async function saveGame(
  session: NonogramSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
