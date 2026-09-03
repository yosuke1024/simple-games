/**
 * Converts between the in-memory WaterSession and its persisted form. Undo
 * history is intentionally not persisted (docs/WATER_SORT_RULES.md §10).
 *
 * Each mode has its own slot, so suspending a level game and playing the
 * daily (or a free board, §6) never costs you any of them.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeTubes,
  encodeTubes,
  restoreSession,
  type GameMode,
  type WaterSession,
} from '../game';
import { dailyGameSchema, freeGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: WaterSession | null;
  daily: WaterSession | null;
  free: WaterSession | null;
}

const schemaFor = (mode: GameMode) =>
  mode === 'daily' ? dailyGameSchema : mode === 'free' ? freeGameSchema : gameSchema;

export function toPersisted(session: WaterSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    colors: session.colors,
    dailyDate: session.dailyDate,
    level: session.level,
    freeTier: session.freeTier,
    tubes: encodeTubes(session.tubes),
    moveCount: session.moveCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): WaterSession | null {
  if (persisted === null) return null;
  const tubes = decodeTubes(persisted.tubes, persisted.colors);
  if (tubes === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    colors: persisted.colors,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    freeTier: persisted.freeTier,
    tubes,
    moveCount: persisted.moveCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
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

export async function saveGame(session: WaterSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
