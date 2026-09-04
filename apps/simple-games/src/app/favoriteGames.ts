/**
 * Which games somebody pinned to the top of the collection home — the shell's
 * own memory, beside `app/recentGames.ts` and shaped the same way.
 *
 * The difference between the two is the whole reason this one exists: the
 * recent row is a history the shell writes as it mounts games, and this is a
 * choice the player makes and unmakes.
 *
 * Unlike `recentGames.ts`, a game's own screen does reach this — its home
 * header carries the star (`ui/components/FavoriteAction.tsx`). The boundary
 * still holds, because the direction is the one the layer rules already allow:
 * the game reaches out to a shared control and names itself, and nothing here
 * reaches into a game. What no game may do is read this to change how it
 * plays; being pinned means one thing, which is where the door is.
 *
 * State lives at module level with fire-and-forget persistence, mirroring
 * `recentGames.ts`. A failed save costs a pin, never a saved game.
 */
import type { KVStore } from '../storage/kv';
import { preferencesKV } from '../storage/kv';
import { loadRecord, saveRecord } from '../storage/repo';
import { FAVORITE_GAMES_MAX, favoriteGamesSchema, type FavoriteGames } from '../storage/schemas';
import { GAMES, type GameId } from './registry';

let state: FavoriteGames = favoriteGamesSchema.defaultValue();
let kvStore: KVStore = preferencesKV;

/** Loads the shelf at boot. Local read only; never blocks the app. */
export async function initFavoriteGames(kv: KVStore = preferencesKV): Promise<void> {
  kvStore = kv;
  state = await loadRecord(favoriteGamesSchema, kv);
}

const isKnownGame = (id: string): id is GameId => GAMES.some((game) => game.id === id);

/**
 * The pinned games, in the order they were pinned. Ids the registry no longer
 * carries are dropped here rather than at load, so withdrawing a game from a
 * future build quietly shortens the shelf instead of offering a door to
 * nowhere — and the stored record still names it, so a game that returns
 * returns pinned.
 */
export function getFavoriteGames(): readonly GameId[] {
  return state.ids.filter(isKnownGame);
}

/**
 * Pins or unpins one game, and hands back the shelf as it now stands so the
 * caller can put it on screen without reading this module back.
 *
 * A new pin goes to the END. Pinning one game must not move the others: this
 * shelf was arranged by the player, and one that reshuffled itself on every
 * addition would be a ranking rather than a shelf.
 */
export function toggleFavoriteGame(gameId: GameId): readonly GameId[] {
  const ids = state.ids.includes(gameId)
    ? state.ids.filter((id) => id !== gameId)
    : // `slice` only ever bites on a hand-edited record (FAVORITE_GAMES_MAX is
      // far above the collection's size); from the end, so the pin the player
      // just made is never the one dropped.
      [...state.ids, gameId].slice(-FAVORITE_GAMES_MAX);
  state = { ...state, ids };
  void saveRecord(favoriteGamesSchema, state, kvStore);
  return getFavoriteGames();
}

/** Test hook. */
export function resetFavoriteGamesForTesting(): void {
  state = favoriteGamesSchema.defaultValue();
  kvStore = preferencesKV;
}
