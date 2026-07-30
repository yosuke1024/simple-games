/**
 * Converts between the in-memory GameSession and its persisted form.
 * Undo history is intentionally not persisted (spec §8.1).
 *
 * Each mode has its own slot, so suspending a level game and playing the
 * daily never costs you either one (docs §14).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { decodeBoard, encodeBoard, restoreSession, type GameMode, type GameSession } from '../game';
import { dailyGameSchema, gameSchema, NM_STORAGE_KEYS, type PersistedGame } from './schemas';

export interface SavedGames {
  level: GameSession | null;
  daily: GameSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: GameSession, savedAt: number): PersistedGame {
  const { values, mask } = encodeBoard(session.board);
  return {
    schemaVersion: 2,
    mode: session.mode,
    seed: session.seed,
    dailyDate: session.dailyDate,
    level: session.level,
    values,
    mask,
    score: session.score,
    moveCount: session.moveCount,
    addCount: session.addCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): GameSession | null {
  if (persisted === null) return null;
  const board = decodeBoard({ values: persisted.values, mask: persisted.mask });
  if (board === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    board,
    score: persisted.score,
    moveCount: persisted.moveCount,
    addCount: persisted.addCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume games that are still playable.
  return session.status === 'playing' ? session : null;
}

/**
 * Loads both slots. Builds before the split kept a daily game in the level
 * slot; such a record is moved to its own slot once, on first load.
 */
export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [legacySlot, dailySlot] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);

  if (legacySlot?.mode === 'daily') {
    const migrated = dailySlot === null;
    if (migrated) await saveRecord(dailyGameSchema, legacySlot, kv);
    await removeRecord(NM_STORAGE_KEYS.game, kv);
    return { level: null, daily: toSession(migrated ? legacySlot : dailySlot) };
  }

  return {
    level: toSession(legacySlot),
    daily: toSession(dailySlot),
  };
}

export async function saveGame(session: GameSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(
  mode: GameMode,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
