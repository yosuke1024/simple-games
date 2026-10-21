/**
 * Converts between the in-memory MakeTheTargetSession and its persisted form
 * (docs/MAKE_THE_TARGET_RULES.md §10), and owns the two slots — one Free Play
 * game, one daily — so suspending one to play the other never costs either
 * (§8).
 *
 * What is kept is the problem as dealt and the moves made: loading replays
 * them through the rules, so a board play could not have produced cannot come
 * back at all, and a resumed game can still be undone to its first position
 * (§5). Every check is the schema's (storage/schemas.ts) — Backup & Restore
 * runs that same schema — and loading adds exactly one rule of its own: a
 * daily that is not today's is deleted, record and all (§8, §10). Nothing
 * here searches (§6).
 *
 * A finished problem (solved, or its solution shown) is never written: its
 * slot is cleared the moment it ends. A refused record is not deleted, as in
 * every game: it is read as "nothing saved", and the slot's next write
 * replaces it (§10).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  localDateString,
  restoreSession,
  SAVED_AT_MAX,
  toRecord,
  wholeInRange,
  type GameMode,
  type MakeTheTargetSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  free: MakeTheTargetSession | null;
  daily: MakeTheTargetSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

/** Whether a session is a game to come back to: still in play, or on the `missed` panel (§4). */
export const isSuspendable = (session: MakeTheTargetSession | null): boolean =>
  session !== null && (session.status === 'playing' || session.status === 'missed');

/**
 * The record for a game in play, stamped `savedAt` (ms, clamped to the range
 * a record may hold — §10); null for a finished one, which is never saved.
 */
export function toPersisted(session: MakeTheTargetSession, savedAt: number): PersistedGame | null {
  return toRecord(session, wholeInRange(savedAt, SAVED_AT_MAX));
}

/**
 * The game a validated record holds, or null. The schema has already
 * replayed it once (storage/schemas.ts); this replays it again into the
 * session the screen plays on, so the two can never disagree about what was
 * saved.
 */
export function toSession(persisted: PersistedGame | null): MakeTheTargetSession | null {
  return persisted === null ? null : restoreSession(persisted);
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113): none and two both mean
 * the home screen, which is where every other door leads anyway (§8).
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['free', 'daily'] as const).filter((mode) => isSuspendable(saved[mode]));
  return suspended.length === 1 ? suspended[0]! : null;
}

/**
 * Both slots, as the game opens. The daily slot holds today's problem or
 * nothing (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」, §8): a daily
 * from any other day — past, or ahead of a clock turned back — is deleted
 * here, record and all, so no door can reopen it. The date is checked on a
 * record that passed the schema: a daily the schema refuses is, like every
 * refused record, left where it is and read as nothing saved, whatever its
 * date, and the next daily replaces it (§10). `today` is a seam for the
 * tests; production reads the device clock.
 */
export async function loadSavedGames(
  kv: KVStore = preferencesKV,
  today: string = localDateString(new Date()),
): Promise<SavedGames> {
  const [free, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  if (daily !== null && daily.dailyDate !== today) {
    await removeRecord(dailyGameSchema.key, kv);
    return { free: toSession(free), daily: null };
  }
  return { free: toSession(free), daily: toSession(daily) };
}

/** Saves a game in play to its mode's slot; a finished one is not written (§10). */
export async function saveGame(
  session: MakeTheTargetSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  const record = toPersisted(session, Date.now());
  if (record === null) return;
  await saveRecord(schemaFor(session.mode), record, kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
