/**
 * What the shell does at boot: local-only reads first (fast, offline-first),
 * then the fire-and-forget work that must never gate a frame.
 *
 * The reads share nothing but the order they run in, so they are guarded one
 * by one. They used to share a single `try` in `main.tsx`, which meant the
 * first rejection skipped every step after it — settings back to defaults and
 * an empty recent-games row because one unrelated record failed to read
 * (issue #96). A step that fails now costs only itself; its own module keeps
 * its defaults and the rest of boot carries on.
 */
import { initAdRemoval, isAdRemovalActive } from '../monetization/adRemoval';
import { initAds } from '../services/ads/banner';
import { initHomeShortcuts } from '../services/homeShortcut/homeShortcut';
import { initNetwork } from '../services/network';
import { initReview } from '../services/review';
import { initWebAppPrompt } from '../services/webAppPrompt';
import { loadRecord } from '../storage/repo';
import { settingsSchema, type Settings } from '../storage/schemas';
import { initFavoriteGames } from './favoriteGames';
import { initRecentGames } from './recentGames';
import { initShortcutLaunch } from './shortcutLaunch';

/** Runs one boot step on its own. Boot itself cannot fail. */
async function bootStep(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch {
    // Even an unexpected failure must not prevent playing: the step's module
    // keeps its defaults, and the steps after it still run.
  }
}

/**
 * Reads the shared records and returns the settings the first render needs.
 * Each game loads its own records when it is opened; the shell loads none of
 * them. Sequential because these are cheap local reads and the order is the
 * one `main.tsx` has always used — not because any step depends on another.
 *
 * The two shortcut steps are local plugin calls rather than record reads
 * (issue #110): which game, if any, a home-screen shortcut launched us into —
 * needed before the first render, so the game paints first — and whether the
 * launcher takes pin requests at all. Off Android each answers at once.
 */
export async function initShellState(): Promise<Settings> {
  await bootStep(initNetwork);
  await bootStep(initAdRemoval);
  await bootStep(initReview);
  await bootStep(initRecentGames);
  await bootStep(initFavoriteGames);
  await bootStep(initWebAppPrompt);
  await bootStep(initShortcutLaunch);
  await bootStep(initHomeShortcuts);

  let settings = settingsSchema.defaultValue();
  await bootStep(async () => {
    settings = await loadRecord(settingsSchema);
  });
  return settings;
}

/**
 * Starts the ad SDK, unless the ad removal takes effect this launch — the
 * purchase is active, or the entitlement could not be read at all (issue
 * #96). Fire-and-forget: nothing here gates the app, and when no banner can
 * appear the SDK is never initialized (battery, and none of that code
 * belongs in a paying player's launch).
 */
export function startAdsUnlessRemoved(): void {
  if (isAdRemovalActive()) return;
  void initAds();
}
