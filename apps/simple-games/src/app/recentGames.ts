/**
 * Which games were opened most recently — the shell's own memory, used by the
 * collection home for its shortcut row.
 *
 * It lives beside the registry rather than in `services/` because it is
 * navigation, not a service: the shell records what it itself mounted, and no
 * game knows this exists. A game is never told, and never asks.
 *
 * State lives at module level with fire-and-forget persistence, mirroring the
 * services/ pattern (`services/review.ts`). A failed save costs a shortcut,
 * never a saved game.
 */
import type { KVStore } from '../storage/kv';
import { preferencesKV } from '../storage/kv';
import { loadRecord, saveRecord } from '../storage/repo';
import { RECENT_GAMES_LIMIT, recentGamesSchema, type RecentGames } from '../storage/schemas';
import { GAMES, type GameId } from './registry';

let state: RecentGames = recentGamesSchema.defaultValue();
let kvStore: KVStore = preferencesKV;

/** Loads the list at boot. Local read only; never blocks the app. */
export async function initRecentGames(kv: KVStore = preferencesKV): Promise<void> {
  kvStore = kv;
  state = await loadRecord(recentGamesSchema, kv);
}

const isKnownGame = (id: string): id is GameId => GAMES.some((game) => game.id === id);

/**
 * The shortcuts to show, newest first. Ids the registry no longer carries are
 * dropped here rather than at load, so removing a game from a future build
 * quietly shortens the row instead of offering a door to nowhere.
 */
export function getRecentGames(): readonly GameId[] {
  return state.ids.filter(isKnownGame).slice(0, RECENT_GAMES_LIMIT);
}

/** Called by the shell as a game mounts. Moving to the front is all it does. */
export function recordGameOpened(gameId: GameId): void {
  const ids = [gameId, ...state.ids.filter((id) => id !== gameId)].slice(0, RECENT_GAMES_LIMIT);
  state = { ...state, ids };
  void saveRecord(recentGamesSchema, state, kvStore);
}

/** Test hook. */
export function resetRecentGamesForTesting(): void {
  state = recentGamesSchema.defaultValue();
  kvStore = preferencesKV;
}
