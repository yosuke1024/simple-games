/**
 * Converts between the in-memory QuickMathSession and its persisted form
 * (docs/QUICK_MATH_RULES.md §9).
 *
 * The questions never travel: the record carries the seed and the index, and
 * `restoreSession` regenerates the set. That keeps the record tiny and, more
 * usefully, makes it impossible for a save to disagree with the generator
 * about what question 7 was.
 *
 * Each mode has its own slot, so suspending a level set and doing the daily
 * never costs you either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, type GameMode, type QuickMathSession } from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: QuickMathSession | null;
  daily: QuickMathSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: QuickMathSession, savedAt: number): PersistedGame {
  return {
    schemaVersion: 1,
    mode: session.mode,
    seed: session.seed,
    dailyDate: session.dailyDate,
    level: session.level,
    solvedCount: session.solvedCount,
    missCount: session.missCount,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  };
}

function toSession(persisted: PersistedGame | null): QuickMathSession | null {
  if (persisted === null) return null;
  const session = restoreSession({
    mode: persisted.mode,
    dailyDate: persisted.dailyDate,
    level: persisted.level,
    solvedCount: persisted.solvedCount,
    missCount: persisted.missCount,
    elapsedSeconds: persisted.elapsedSeconds,
  });
  // Only resume a set that is still in progress. `restoreSession` already
  // refuses an index past the end of its set.
  return session !== null && session.status === 'playing' ? session : null;
}

export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {
  const [level, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { level: toSession(level), daily: toSession(daily) };
}

export async function saveGame(
  session: QuickMathSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
