/**
 * Which game an Android home-screen shortcut asked for (issue #110) — the
 * app's counterpart of app/webRoute.ts, for the one way a native launch can
 * name a game.
 *
 * THE ADDRESS IS THE ONE THE BROWSER ALREADY USES
 *
 * A pinned shortcut carries an Intent, and the Intent carries a URI. That URI
 * is the browser version's own address for the game:
 *
 *   https://pixapps.ai/simple-games/play/?game=sudoku
 *
 * The contract exists, is documented (docs/WEB_VERSION.md「URL(ゲーム別の
 * 入口)」), and has one parser, `gameIdFromHref`. A scheme of our own would be
 * a second thing to keep in step with the registry for nothing in return. The
 * URI is data inside an *explicit* Intent aimed at MainActivity — never
 * something the OS resolves — so the app does not have to "own" it, and no
 * intent-filter is declared for it: nothing outside the app can open a game
 * by way of this.
 *
 * HOW IT ARRIVES
 *
 * Cold start: `@capacitor/app`'s `getLaunchUrl()` hands over the Intent's URI.
 * It is read once at boot (app/boot.ts) so the shell opens straight onto the
 * game, decided before the first render — the same way the browser opens
 * straight onto `?game=`, and for the same reason: the collection must not
 * flash on the way. Warm start — the activity already alive, and
 * `launchMode="singleTask"` in the manifest — the same plugin raises
 * `appUrlOpen` from `onNewIntent`, and App.tsx switches screens. Both paths
 * read the URI through `gameIdFromShortcutUrl`.
 *
 * WHAT AN UNKNOWN ID DOES
 *
 * A shortcut outlives the build that made it. If a game is withdrawn in a
 * later release its shortcut still sits on somebody's home screen, and a tap
 * on it must land on the collection, not on an error — exactly what the
 * browser does with a `?game=` it cannot use. The parser drops any id the
 * registry no longer carries, and the shell treats null as "the collection".
 *
 * ANDROID ONLY
 *
 * By runtime guard, like every other web/app difference in this product
 * (docs/WEB_VERSION.md「実装上の約束」). iOS declares no URL types today, so
 * `getLaunchUrl()` there would answer nothing anyway; gating on the platform
 * keeps "iOS and the web are unchanged" a fact rather than a coincidence.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { WEB_PLAY_URL } from '@simple-games/brand';
import type { GameId } from './registry';
import { GAME_PARAM, gameIdFromHref } from './webRoute';

let launchGame: GameId | null = null;

/** The URI a shortcut to this game carries. `gameIdFromShortcutUrl` reads it back. */
export function shortcutUrlFor(gameId: GameId): string {
  const url = new URL(WEB_PLAY_URL);
  url.searchParams.set(GAME_PARAM, gameId);
  return url.toString();
}

/**
 * The game a shortcut's URI names, or null for the collection — an id this
 * build does not carry, an address without the parameter, or no URL at all.
 */
export function gameIdFromShortcutUrl(url: string | null | undefined): GameId | null {
  return url ? gameIdFromHref(url) : null;
}

/**
 * Boot: remember which game, if any, this launch was asked to open. A local
 * plugin call and nothing else. Never rejects: a plugin that fails leaves the
 * answer at null, which is the ordinary launch — boot guards every step
 * anyway (app/boot.ts), but a caller should not need to know that.
 */
export async function initShortcutLaunch(): Promise<void> {
  launchGame = null;
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    const launch = await CapacitorApp.getLaunchUrl();
    launchGame = gameIdFromShortcutUrl(launch?.url);
  } catch {
    launchGame = null;
  }
}

/** What boot found. Read by the shell's first render (App.tsx `initialView`). */
export function shortcutLaunchGame(): GameId | null {
  return launchGame;
}

/** Test hook. */
export function resetShortcutLaunchForTesting(): void {
  launchGame = null;
}
