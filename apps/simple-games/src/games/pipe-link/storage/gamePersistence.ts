/**
 * Converts between the in-memory PipeLinkSession and its persisted form
 * (docs/PIPE_LINK_RULES.md §7).
 *
 * Loading is fail-closed in one step: the slot's schema (storage/schemas.ts)
 * reads the record through the same `fromRecord` the session comes back
 * from, so a record the schema lets in is one the game resumes, and Backup &
 * Restore — which runs the same schema — cannot carry a board the game would
 * refuse. Anything refused is dropped and the player lands on the game's
 * home; nothing here ever starts a new board in its place, and nothing here
 * deletes a refused record — like every game's loader, it is left for the
 * slot's next write to replace (§7). The one record that is deleted on load
 * is a daily from another day, below.
 *
 * No search runs on a load (§4「仕事量と上限」): uniqueness is not proved
 * again, because the win is the lighting (§2) and the technique hint never
 * reads the stored answer (§6).
 *
 * Two independent slots: one difficulty game and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§8).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import {
  fromRecord,
  localDateString,
  toRecord,
  type GameMode,
  type PipeLinkSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: PipeLinkSession | null;
  daily: PipeLinkSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: PipeLinkSession, savedAt: number): PersistedGame {
  return { schemaVersion: 1, ...toRecord(session), savedAt };
}

/**
 * The session a record holds, or null. `fromRecord` refuses a solved board
 * itself (a solved board is history, not a game to resume), so whatever comes
 * back here is in play.
 */
export function toSession(persisted: PersistedGame | null): PipeLinkSession | null {
  if (persisted === null) return null;
  const session = fromRecord(persisted);
  return session !== null && session.status === 'playing' ? session : null;
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113). With two slots, "the game
 * they were playing" is only a fact when exactly one of them is suspended;
 * none and two both mean the home screen.
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['difficulty', 'daily'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

async function loadSlots(kv: KVStore): Promise<SavedGames> {
  const [difficulty, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    loadRecord(dailyGameSchema, kv),
  ]);
  return { difficulty: toSession(difficulty), daily: toSession(daily) };
}

/**
 * The daily slot holds today's board or nothing (docs/PRODUCT_PRINCIPLES.md
 * 「デイリーは今日の 1 問」, §8). A board from any other day — past, or dated
 * ahead by a clock set back — is dropped here, record and all, so no door (the
 * home button, a shortcut) can reopen it. `today` is a seam for the tests;
 * production reads the device clock.
 */
export async function loadSavedGames(
  kv: KVStore = preferencesKV,
  today: string = localDateString(new Date()),
): Promise<SavedGames> {
  const saved = await loadSlots(kv);
  if (saved.daily !== null && saved.daily.dailyDate !== today) {
    await removeRecord(dailyGameSchema.key, kv);
    return { ...saved, daily: null };
  }
  return saved;
}

export async function saveGame(
  session: PipeLinkSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
