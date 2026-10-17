/**
 * Converts between the in-memory BridgesSession and its persisted form
 * (docs/BRIDGES_RULES.md §10).
 *
 * Loading is fail-closed, in two layers. The schema (storage/schemas.ts)
 * refuses everything it can without searching — a board, answer or bridges
 * play could not have produced, a finished game — and Backup & Restore runs
 * that same schema, so neither layer lets in what the other refuses. Then
 * `fromRecord` (game/session.ts) reads the record again and adds the one
 * check the schema leaves out: the answer, proven again to be the board's
 * only one. Anything refused is dropped and the player lands on the game's
 * home; nothing here ever starts a new board in its place, and nothing here
 * deletes a refused record — like every game's loader, it is left for the
 * slot's next write to replace (§10). The one record that is deleted on load
 * is a daily from another day, below.
 *
 * The re-proof is the one bounded search a load runs (§6). It runs from
 * `loadSavedGames`, which only the game's root calls — when the player opens
 * the game — and never from the schema validators the backup screens use.
 *
 * Two independent slots: one difficulty game and one daily. Suspending a hard
 * board to play today's daily never costs you either one (§8).
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { fromRecord, localDateString, toRecord, type BridgesSession, type GameMode } from '../game';
import { dailyGameSchema, gameSchema, type PersistedGame } from './schemas';

export interface SavedGames {
  difficulty: BridgesSession | null;
  daily: BridgesSession | null;
}

const schemaFor = (mode: GameMode) => (mode === 'daily' ? dailyGameSchema : gameSchema);

export function toPersisted(session: BridgesSession, savedAt: number): PersistedGame {
  return { schemaVersion: 1, ...toRecord(session), savedAt };
}

/**
 * The session a record holds, or null. `fromRecord` refuses a finished game
 * itself (a solved board is history, not a game to resume), so whatever comes
 * back here is in play.
 */
export function toSession(persisted: PersistedGame | null): BridgesSession | null {
  if (persisted === null) return null;
  const session = fromRecord(persisted);
  return session !== null && session.status === 'playing' ? session : null;
}

/**
 * The one suspended game a home-screen shortcut may open straight onto, or
 * null when there is no single answer (issue #113).
 *
 * A shortcut is a way back into the game somebody was playing. With two
 * independent slots — one difficulty board, one daily (§8, §10) — "the game
 * they were playing" is only a fact when exactly one of them is suspended.
 * Two would make it a guess, and guessing wrong drops somebody onto the other
 * board mid-game. None and two both mean the home screen, which is where every
 * other door leads anyway. Nothing is cleared either way.
 *
 * Reads the game's own saves and nothing else: the shell hands over which door
 * was used and never learns what this decided
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」).
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
 * 「デイリーは今日の 1 問」, §8). A board from any other day — one that has
 * passed, or one dated ahead by a clock set back or a backup from another
 * time zone — is dropped here, record and all, so no door (the home button,
 * a shortcut) can reopen it. `today` is a seam for the tests; production
 * reads the device clock.
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
  session: BridgesSession,
  kv: KVStore = preferencesKV,
): Promise<void> {
  await saveRecord(schemaFor(session.mode), toPersisted(session, Date.now()), kv);
}

export async function clearSavedGame(mode: GameMode, kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(schemaFor(mode).key, kv);
}
