/**
 * Converts between the in-memory Game2048Session and its persisted form.
 * Undo history is intentionally not persisted (docs/GAME_2048_RULES.md §5).
 *
 * Each mode has its own slot, so suspending a classic run and playing the
 * daily never costs you either one (§6).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  decodeBoard,
  encodeBoard,
  restoreSession,
  type Game2048Session,
  type GameMode,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  classic: Game2048Session | null;
  daily: Game2048Session | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: Game2048Session, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    dailyDate: session.dailyDate,
    board: encodeBoard(session.board),
    score: session.score,
    moveCount: session.moveCount,
    spawnCount: session.spawnCount,
    won: session.won,
    winAcknowledged: session.winAcknowledged,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): Game2048Session | null {
  if (persisted === null) return null;
  const board = decodeBoard(persisted.board);
  if (board === null) return null;

  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    dailyDate: persisted.dailyDate,
    board,
    score: persisted.score,
    moveCount: persisted.moveCount,
    spawnCount: persisted.spawnCount,
    won: persisted.won,
    winAcknowledged: persisted.winAcknowledged,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [classic, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { classic: toSession(classic), daily: toSession(daily) };
}

export async function saveGame(
  session: Game2048Session,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
