/**
 * Reads the native launch once before the first render. Launcher shortcuts,
 * Universal Links, App Links and the explicit LP fallback all use the same
 * validated game target. The untouched launch URL also feeds the separate
 * Club House invite handler. No network or browser-history operations.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { WEB_PLAY_URL } from '@simple-games/brand';
import type { GameId } from './registry';
import { GAME_PARAM } from './webRoute';
import { nativeGameTarget } from './nativeGameLink';

let launchGame: GameId | null = null;
/** The URL the OS launched the app with, for the other door it can be: an invite link. */
let launchUrl: string | null = null;

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
  return nativeGameTarget(url)?.gameId ?? null;
}

/**
 * Boot: remember which game, if any, this launch was asked to open. A local
 * plugin call and nothing else. Never rejects: a plugin that fails leaves the
 * answer at null, which is the ordinary launch — boot guards every step
 * anyway (app/boot.ts), but a caller should not need to know that.
 */
export async function initShortcutLaunch(): Promise<void> {
  launchGame = null;
  launchUrl = null;
  if (!Capacitor.isNativePlatform()) return;
  try {
    const launch = await CapacitorApp.getLaunchUrl();
    launchUrl = launch?.url ?? null;
    launchGame = gameIdFromShortcutUrl(launch?.url);
  } catch {
    launchGame = null;
  }
}

/** What boot found. Read by the shell's first render (App.tsx `initialView`). */
export function shortcutLaunchGame(): GameId | null {
  return launchGame;
}

/** The launch URL as the OS gave it (App.tsx reads an invite link out of it). */
export function shortcutLaunchUrl(): string | null {
  return launchUrl;
}

/** Test hook. */
export function resetShortcutLaunchForTesting(): void {
  launchGame = null;
  launchUrl = null;
}
