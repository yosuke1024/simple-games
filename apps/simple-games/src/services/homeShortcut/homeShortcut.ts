/**
 * Adding one game to the Android home screen (issue #110), for the sheet a
 * long press opens on a game tile (ui/components/GameActionSheet.tsx).
 *
 * WHAT THIS IS, AND IS NOT
 *
 * A pinned shortcut: the OS's own door straight to one game, made only when
 * somebody asks for it by name. Nothing here runs when a game is pinned to
 * the collection's Favorites shelf — the two are separate decisions offered
 * side by side in the same sheet, and a favourite never grows a home-screen
 * icon on its own. Nor is it a second app: the shortcut launches Simple Games
 * with a URI that names the game (app/shortcutLaunch.ts), and everything
 * after that is the app.
 *
 * EVERY ENDING IS A NORMAL ENDING
 *
 * The launcher shows its own confirmation and never reports the answer. A
 * launcher that takes no pin requests, a request that fails, a plugin that is
 * missing — none of it reaches the player as an error: `requestHomeShortcut`
 * resolves false and nothing on screen changes, the rule
 * services/share/share.ts is held to. Where the launcher cannot pin at all
 * the door is not offered: `homeShortcutsAvailable()` is settled once at boot
 * and the sheet leaves the action out, rather than showing a button that
 * does nothing.
 *
 * NOTHING IS COUNTED. Not how often this is asked for, nor for which game
 * (docs/ARCHITECTURE.md: no analytics in the app artifact).
 *
 * Android only, by runtime guard rather than by build (docs/WEB_VERSION.md
 * 「実装上の約束」). iOS has no pinned shortcuts — its Quick Actions are
 * issue #114 — and the browser has nothing to pin to.
 */
import { Capacitor } from '@capacitor/core';
import type { GameDefinition } from '../../app/registry';
import { shortcutUrlFor } from '../../app/shortcutLaunch';
import { renderHomeShortcutIcon } from './icon';
import { HomeShortcut } from './plugin';

let available = false;

/**
 * Boot: asks the launcher once whether it takes pin requests. A local call,
 * and never a rejection — a plugin that fails leaves the answer at "no", and
 * the door is simply not offered this launch.
 */
export async function initHomeShortcuts(): Promise<void> {
  available = false;
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    const { supported } = await HomeShortcut.isSupported();
    available = supported === true;
  } catch {
    available = false;
  }
}

/** Whether the sheet should offer "Add to Home Screen" at all. */
export function homeShortcutsAvailable(): boolean {
  return available;
}

/**
 * Asks the launcher to pin this game. Resolves true when the request was
 * handed over — the launcher takes it from there and its answer is never
 * reported back — and false for every other ending, without throwing.
 *
 * The icon is drawn synchronously first (icon.ts); a drawing that fails
 * simply leaves the picture out and the launcher shows the app icon.
 */
export async function requestHomeShortcut(game: GameDefinition): Promise<boolean> {
  if (!available) return false;
  try {
    const icon = renderHomeShortcutIcon(game);
    const { requested } = await HomeShortcut.requestPin({
      id: `game-${game.id}`,
      label: game.title,
      uri: shortcutUrlFor(game.id),
      ...(icon ? { icon } : {}),
    });
    return requested === true;
  } catch {
    return false;
  }
}

/** Test hook. */
export function resetHomeShortcutsForTesting(): void {
  available = false;
}
