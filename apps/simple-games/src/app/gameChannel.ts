/**
 * Which of the registry's titles this build actually offers — the runtime
 * guard behind the browser version's early-release channel
 * (docs/WEB_VERSION.md「先行公開(ベータ)」, issue #194).
 *
 * The registry lists every title the code carries; `GameDefinition.channel`
 * says where each one ships. A title with no channel is released everywhere.
 * A `'web-beta'` title is in the browser version only, so on the app it must
 * be absent from every door a game can be opened through: the home's shelves
 * and sections, the search, the favourites picker, the `?game=` address the
 * browser reads and the home-screen shortcut carries, and the lazy root the
 * shell mounts. All of those ask here, and nowhere else, so "not in the app"
 * is one decision rather than six.
 *
 * Decided at runtime, never at build time. The web and native artifacts are
 * one build with three build-time gates already (ads, analytics, site chrome
 * —「実装上の約束」), and this does not become a fourth: the beta title's code
 * ships in the app bundle too, where nothing can reach it. That is also why
 * the guard is `Capacitor.isNativePlatform()` and not a mode check — the same
 * seam every other web/app difference in this product uses (app/webRoute.ts).
 *
 * What is deliberately NOT gated: `storageKeys` and `loadStorageSchemas`.
 * "Reset Local Data" wipes every key the registry knows and a backup restores
 * every record its owner can validate, whichever build made it — a browser
 * backup carrying a beta save must restore on the app without losing that
 * save, so the schemas stay registered on both (src/backup/owners.ts).
 */
import { Capacitor } from '@capacitor/core';
import { GAMES, type GameDefinition, type GameId } from './registry';

/** Whether this build offers the title: released everywhere, or beta in the browser. */
export function isGameAvailable(game: GameDefinition): boolean {
  return game.channel !== 'web-beta' || !Capacitor.isNativePlatform();
}

/** The registry, minus the titles this build keeps off its doors. Registry order. */
export function availableGames(): readonly GameDefinition[] {
  return GAMES.filter(isGameAvailable);
}

/** The title an id names — only if this build offers it. */
export function findAvailableGame(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id && isGameAvailable(game));
}

/** The id check every door uses: a registry id, and one this build offers. */
export const isAvailableGameId = (id: string | null | undefined): id is GameId =>
  typeof id === 'string' && findAvailableGame(id) !== undefined;
