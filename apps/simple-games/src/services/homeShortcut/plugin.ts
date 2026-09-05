/**
 * The bridge to the one piece of native code the home-screen shortcut needs:
 * asking Android to pin one (issue #110). The Java side is
 * android/app/src/main/java/com/pixapps/simplegames/HomeShortcutPlugin.java,
 * registered in MainActivity — a local plugin rather than a package, because
 * it is a few dozen lines around `ShortcutManagerCompat` and nothing else
 * would ever use it.
 *
 * There is no iOS implementation, and the web one below is a stub that
 * answers "unsupported", so a build without the native side — the browser, a
 * test — never has to catch a "not implemented" rejection. Callers gate on
 * the platform before reaching here anyway (homeShortcut.ts).
 */
import { registerPlugin } from '@capacitor/core';

export interface HomeShortcutRequest {
  /**
   * Stable per game (`game-<id>`), so asking twice updates the one shortcut
   * record rather than registering a second. What the launcher then puts on
   * the workspace is its own decision, taken with the player at its
   * confirmation: Pixel Launcher asks again and, if told yes, places a second
   * icon for the same record (measured 2026-09-05). That is the OS flow the
   * feature promises to respect, not something to route around.
   */
  id: string;
  /** The label under the icon: the game's title, a proper noun in every language. */
  label: string;
  /** The URI the Intent carries; app/shortcutLaunch.ts reads it back at launch. */
  uri: string;
  /**
   * A PNG, base64 with no `data:` prefix, used as a full-bleed adaptive-icon
   * layer (icon.ts). Left out, the launcher shows the app icon instead.
   */
  icon?: string;
}

export interface HomeShortcutPlugin {
  /** Whether this device and launcher take pin requests at all. */
  isSupported(): Promise<{ supported: boolean }>;
  /**
   * Asks the launcher. `requested` means the request was handed over, not
   * that a shortcut now exists: the launcher shows its own confirmation and
   * never reports the answer back.
   */
  requestPin(request: HomeShortcutRequest): Promise<{ requested: boolean }>;
}

export const HomeShortcut = registerPlugin<HomeShortcutPlugin>('HomeShortcut', {
  web: {
    isSupported: () => Promise.resolve({ supported: false }),
    requestPin: () => Promise.resolve({ requested: false }),
  },
});
