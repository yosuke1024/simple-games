/**
 * Converts between the in-memory SpiderSession and its persisted form. Undo
 * history is intentionally not persisted (docs/SPIDER_SOLITAIRE_RULES.md §10).
 *
 * Each mode has its own slot, so suspending a free deal and playing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type GameMode, type SpiderSession } from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  free: SpiderSession | null;
  daily: SpiderSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: SpiderSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    suitCount: session.suitCount,
    dailyDate: session.dailyDate,
    stock: [...session.board.stock],
    tableau: session.board.tableau.map((pile) => ({ down: [...pile.down], up: [...pile.up] })),
    completed: session.board.completed.map((run) => [...run]),
    moveCount: session.moveCount,
    hintCount: session.hintCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): SpiderSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    seed: persisted.seed,
    suitCount: persisted.suitCount,
    dailyDate: persisted.dailyDate,
    board: {
      suitCount: persisted.suitCount,
      stock: persisted.stock,
      tableau: persisted.tableau,
      completed: persisted.completed,
    },
    moveCount: persisted.moveCount,
    hintCount: persisted.hintCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a game that is still in progress.
  return session.status === 'playing' ? session : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [free, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { free: toSession(free), daily: toSession(daily) };
}

export async function saveGame(session: SpiderSession, kv: KVStore = preferencesKV): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
