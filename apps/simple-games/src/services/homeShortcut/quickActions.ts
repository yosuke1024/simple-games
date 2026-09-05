/**
 * The favourites shelf, mirrored onto the iOS Home Screen quick actions — the
 * menu a long press on the app icon opens (issue #114).
 *
 * WHY FAVOURITES, WHEN ANDROID'S SHORTCUTS ARE NOT
 *
 * On Android a home-screen shortcut is a new icon placed on somebody's
 * launcher, so it is made only when they ask for it by name (homeShortcut.ts),
 * and favouriting never makes one. iOS has no such thing: the only door an
 * app gets is the list inside its own icon's menu, and that list is the app's
 * to fill. Filling it with the games the player already pinned to the top of
 * the collection is the natural entrance on this OS (issue #107: use each
 * OS's own door rather than forcing one shape on both) — and it costs the
 * favourites nothing. No order, no UI, no stored field changes for this; the
 * shelf is read, never written, and only the projection of it is new.
 *
 * WHAT THE LIST IS
 *
 * The first `QUICK_ACTIONS_MAX` games of the shelf, in shelf order. iOS shows
 * at most four quick actions per app, and the shelf is in pinning order, so
 * "the top of the shelf" is a stable choice: pinning a fifth game moves
 * nothing, unpinning one of the four lets the next in. Not a ranking — the
 * shelf is arranged by the player and stays that way (app/favoriteGames.ts).
 * An empty shelf registers nothing at all; the OS keeps its own entries and
 * those are not ours to show or hide.
 *
 * Each item carries the game's address, the same `?game=<id>` URL an Android
 * shortcut carries (app/shortcutLaunch.ts). AppDelegate.swift hands a tapped
 * item to Capacitor as a URL open, so the launch — cold or warm, straight
 * onto a suspended board where the game allows it (issue #113), onto the
 * collection for an id this build no longer carries — is the one path both
 * OSes already share, and nothing here has a reading side.
 *
 * WHEN IT IS WRITTEN
 *
 * Whenever the shelf changes, and once at boot. `initQuickActions` subscribes
 * to the shelf (app/favoriteGames.ts notifies after every pin, unpin, and
 * reload — "Reset Local Data" included) and mirrors what is there now. The
 * boot write is what heals a list the OS still holds for a game a later build
 * withdrew, and one a failed write left stale; it is a local assignment of a
 * few strings, not a request to anything. Every write is fire-and-forget and
 * never rejects: a plugin that fails leaves the OS list as it was, and the
 * shelf on screen neither waits for it nor hears about it. Nothing is counted
 * (docs/ARCHITECTURE.md: no analytics in the app artifact).
 *
 * iOS only, by runtime guard rather than by build (docs/WEB_VERSION.md
 * 「実装上の約束」), the way homeShortcut.ts is Android only. Off iOS every
 * function here returns at once, so Android and the browser are unchanged by
 * this feature as a fact about the code.
 */
import { Capacitor } from '@capacitor/core';
import { getFavoriteGames, subscribeFavoriteGames } from '../../app/favoriteGames';
import { GAMES, type GameId } from '../../app/registry';
import { shortcutUrlFor } from '../../app/shortcutLaunch';
import { QuickActions, type QuickActionItem } from './quickActionsPlugin';

/**
 * How many items iOS shows in an app icon's menu. The system truncates a
 * longer list itself, but silently, and which four it would keep is then its
 * decision rather than the shelf's — so the cut is made here, at the top.
 */
export const QUICK_ACTIONS_MAX = 4;

/**
 * The items a shelf maps to, in shelf order. A pure function of the ids: an id
 * the registry no longer carries is dropped before the cut, so a withdrawn
 * game never costs a slot (the shelf drops those itself — app/favoriteGames.ts —
 * but this is the place that promises it to the OS).
 */
export function quickActionItemsFor(favorites: readonly GameId[]): QuickActionItem[] {
  return favorites
    .flatMap((id) => GAMES.filter((game) => game.id === id))
    .slice(0, QUICK_ACTIONS_MAX)
    .map((game) => ({
      id: `game-${game.id}`,
      label: game.title,
      uri: shortcutUrlFor(game.id),
    }));
}

/**
 * Writes the shelf to the OS. Resolves for every ending — off iOS at once,
 * and on a plugin that rejects with the list left as it was — and never
 * throws: the caller is the favourites shelf, which owes the player a pin,
 * not a report about the OS.
 */
export async function syncQuickActions(favorites: readonly GameId[]): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return;
  try {
    await QuickActions.setItems({ items: quickActionItemsFor(favorites) });
  } catch {
    // The OS list stays as it was. Nothing on screen depends on it.
  }
}

let unsubscribe: (() => void) | null = null;

/**
 * Boot: mirror the shelf as it stands, and keep mirroring it as it changes.
 * Runs after `initFavoriteGames` (app/boot.ts) so the first write is the
 * stored shelf rather than an empty one. Off iOS this subscribes to nothing
 * and returns at once. Never rejects.
 */
export async function initQuickActions(): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return;
  unsubscribe?.();
  unsubscribe = subscribeFavoriteGames((favorites) => {
    void syncQuickActions(favorites);
  });
  await syncQuickActions(getFavoriteGames());
}

/** Test hook. */
export function resetQuickActionsForTesting(): void {
  unsubscribe?.();
  unsubscribe = null;
}
