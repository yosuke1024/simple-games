/**
 * Converts between the in-memory TangramSession and its persisted form
 * (docs/TANGRAM_RULES.md §8).
 *
 * Loading is fail-closed. The slot schemas (./schemas.ts) already refuse a
 * record play could not have written — the shape, the mode the key is for,
 * and every placement judged by `restoreSession` with the same geometry play
 * uses — so here a record either becomes the session it describes or the slot
 * reads as empty. The player then lands on the game's home with nothing
 * started for them, and the next figure begun in that slot replaces the
 * record (§8「読み捨てた記録はストレージから消さない」).
 *
 * Two independent slots: one Free Play figure and one daily. Suspending a
 * Hard figure to play today's daily never costs the player either one.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRaw, loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { isRecord } from '../../../storage/validate';
import {
  localDateString,
  restoreSession,
  toRecord,
  type GameMode,
  type TangramSession,
} from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  free: TangramSession | null;
  daily: TangramSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: TangramSession, savedAt: number): PersistedGame {
  return { schemaVersion: 1, ...toRecord(session), savedAt };
}

/** The session a record holds, or null when there is none worth resuming. Never throws. */
export function toSession(persisted: PersistedGame | null): TangramSession | null {
  if (persisted === null) return null;
  const restored = restoreSession(persisted);
  return restored.ok ? restored.session : null;
}

/**
 * The one suspended figure a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113, §8「2 スロット」). With two
 * slots, "the figure they were playing" is only a fact when exactly one of
 * them is suspended; none and two both mean the home screen.
 */
export function soleSuspendedMode(saved: SavedGames): GameMode | null {
  const suspended = (['free', 'daily'] as const).filter(
    (mode) => saved[mode]?.status === 'playing',
  );
  return suspended.length === 1 ? suspended[0]! : null;
}

/**
 * The date a stored daily claims, read before anything else about it is
 * checked (§8: 日付は形の検証より先に見る) — or null when the text is not a
 * record with a date string at all (then it is simply corrupt, and stays).
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
 * Both slots, read and checked. The daily slot holds today's figure or nothing
 * (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」, §6): a record dated any
 * other day — yesterday, or a tomorrow left by a clock set back — is removed
 * here, record and all, so no door (the home button, a shortcut) can reopen
 * it. `today` is a seam for the tests; production reads the device clock.
 */
export async function loadSavedGames(
  kv: KVStore = preferencesKV,
  today: string = localDateString(new Date()),
): Promise<SavedGames> {
  const claimed = await storedDailyDate(kv);
  if (claimed !== null && claimed !== today) await removeRecord(dailyGameSchema.key, kv);
  const [free, daily] = await Promise.all([
    loadRecord(gameSchema, kv),
    claimed !== null && claimed !== today ? null : loadRecord(dailyGameSchema, kv),
  ]);
  return { free: toSession(free), daily: toSession(daily) };
}

export async function saveGame(
  session: TangramSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
