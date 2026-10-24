/**
 * Converts between the in-memory EchoSession and its persisted form
 * (docs/ECHO_PADS_RULES.md §8, §9).
 *
 * Loading is fail-closed. The slot schemas (./schemas.ts) already refuse a
 * record play could not have written — its shape, the mode the key is for,
 * and every combination `restoreSession` refuses. What is left needs other
 * records, and is checked here: the level must be open in `ep.progress`, the
 * attempt must be one `ep.progress` has already handed out, and a daily must
 * be today's. A record that fails reads as an empty slot: the player lands on
 * the game's home with nothing started for them, and the next run begun in
 * that slot replaces the record. Only a daily from another day is removed on
 * the spot, record and all, so no door can reopen it (§7).
 *
 * Two independent slots: one level run and one daily.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRaw, loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { isRecord } from '../../../storage/validate';
import {
  isFinished,
  isUnlocked,
  localDateString,
  restoreSession,
  snapshotOf,
  type EchoProgress,
  type EchoSession,
  type GameMode,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  level: EchoSession | null;
  daily: EchoSession | null;
}

export const GAME_MODES: readonly GameMode[] = ['level', 'daily'];

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

/** The record for a run that is not over; null for a finished one (§8). */
export function toPersisted(session: EchoSession, savedAt: number): PersistedGame | null {
  const snapshot = snapshotOf(session);
  if (snapshot === null) return null;
  return { schemaVersion: 1, ...snapshot, pacesHeard: [...snapshot.pacesHeard], savedAt };
}

/** The session a record holds, or null when there is none worth resuming. Never throws. */
export function toSession(persisted: PersistedGame | null): EchoSession | null {
  return persisted === null ? null : restoreSession(persisted);
}

/**
 * Whether a restored run agrees with the progress record (§9): the level is
 * open, and the attempt is one already handed out — an attempt at or past
 * `nextAttempt` is a sequence no run has started.
 */
export function agreesWithProgress(
  session: EchoSession,
  progress: EchoProgress,
  today: string,
): boolean {
  if (session.mode === 'level') {
    const level = session.level;
    if (level === null || !isUnlocked(progress, level)) return false;
    return session.attempt < (progress.nextAttempt[level - 1] ?? 0);
  }
  if (session.dailyDate !== today) return false;
  const daily = progress.daily;
  return daily !== null && daily.date === today && session.attempt < daily.nextAttempt;
}

/**
 * The one suspended run a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113): none and two both mean
 * the home screen.
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = GAME_MODES.filter((mode) => {
    const session = saved[mode];
    return session !== null && !isFinished(session);
  });
  return suspended.length === 1 ? suspended[0]! : null;
}

/**
 * The date a stored daily claims, read before anything else about it is
 * checked — or null when the text is not a record with a date string at all
 * (then it is simply corrupt, and stays).
 */
async function storedDailyDate(kv: KVStore): Promise<string | null> {
  const text = await loadRaw(dailyGameSchema.key, kv);
  if (text === null) return null;
  try {
    const raw: unknown = JSON.parse(text);
    return isRecord(raw) && typeof raw.dailyDate === 'string' ? raw.dailyDate : null;
  } catch {
    return null;
  }
}

/**
 * Both slots, read and checked against `progress`. `today` is a seam for the
 * tests; production reads the device clock.
 */
export async function loadSavedGames(
  progress: EchoProgress,
  kv: KVStore = preferencesKV,
  today: string = localDateString(new Date()),
): Promise<SavedGames> {
  const claimed = await storedDailyDate(kv);
  const stale = claimed !== null && claimed !== today;
  if (stale) await removeRecord(dailyGameSchema.key, kv);
  const [level, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    stale ? null : loadRecord(dailyGameSchema, kv),
  ]);
  const checked = (persisted: PersistedGame | null): EchoSession | null => {
    const session = toSession(persisted);
    return session !== null && agreesWithProgress(session, progress, today) ? session : null;
  };
  return { level: checked(level), daily: checked(daily) };
}

/** Saves a run in progress; a finished run has no record and is not written. */
export async function saveGame(session: EchoSession, kv: KVStore = preferencesKV): Promise<void> {
  const record = toPersisted(session, Date.now());
  if (record === null) return;
  await saveRecord(schemaFor(session.mode), record, kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
