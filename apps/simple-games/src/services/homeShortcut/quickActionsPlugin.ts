/**
 * The bridge to the one piece of native code the iOS quick actions need:
 * handing UIKit the list to show under a long press on the app icon (issue
 * #114). The Swift side is ios/App/App/QuickActionsPlugin.swift, registered
 * in MainViewController.swift — a local plugin rather than a package, like
 * its Android sibling `HomeShortcut` (plugin.ts), because it is a dozen lines
 * around `UIApplication.shortcutItems` and nothing else would ever use it.
 *
 * Writing only. A tapped item never comes back through here: AppDelegate.swift
 * turns it into the URL-open Capacitor's own App plugin already reports, so
 * the JavaScript reads it with `getLaunchUrl()` / `appUrlOpen` exactly as it
 * reads an Android shortcut (app/shortcutLaunch.ts). One contract, two OSes.
 *
 * There is no Android implementation, and the web one below is a stub that
 * does nothing, so a build without the native side — the browser, a test —
 * never has to catch a "not implemented" rejection. Callers gate on the
 * platform before reaching here anyway (quickActions.ts).
 */
import { registerPlugin } from '@capacitor/core';

export interface QuickActionItem {
  /**
   * Stable per game (`game-<id>`, the same id the Android shortcut uses), so
   * a list that names the same games twice running is the same list to the OS.
   */
  id: string;
  /** The row's title: the game's title, a proper noun in every language. */
  label: string;
  /** The URI the item carries; app/shortcutLaunch.ts reads it back at launch. */
  uri: string;
}

export interface QuickActionsPlugin {
  /**
   * Replaces the whole list. An empty list removes every item — no favourites,
   * no quick actions. Resolves for every list it is handed; an entry missing a
   * field is left out rather than failing the rest.
   */
  setItems(options: { items: QuickActionItem[] }): Promise<void>;
}

export const QuickActions = registerPlugin<QuickActionsPlugin>('QuickActions', {
  web: {
    setItems: () => Promise.resolve(),
  },
});
