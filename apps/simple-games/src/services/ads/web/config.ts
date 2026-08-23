/**
 * Web-build ad configuration (docs/ADS_POLICY.md「Web 版」).
 *
 * This module is safe to reach the native bundle: it holds only env plumbing
 * and booleans, never an ad-network identifier. The actual AdSense
 * integration lives in AdUnit.tsx, which only the `--mode web` build
 * references (see ui/components/WebAdSlot.tsx), and the built artifacts are
 * checked in CI (.github/scripts/check-dist-ads-separation.sh).
 *
 * ID handling mirrors the AdMob banner (services/ads/banner.ts): production
 * IDs are injected at build time and never committed. AdSense has no official
 * test client ID (unlike AdMob), so test mode renders a local placeholder and
 * contacts no ad network at all.
 *
 * WHICH NETWORK SERVES is decided by what the build carries, not by a runtime
 * switch (docs/ADS_POLICY.md「Web 版」の「二つのネットワーク」):
 * - AdSense client injected → AdSense serves, 忍者AdMax is its runtime
 *   fallback (a frame mounts only where AdSense demonstrably failed).
 * - No client, but AdMax frames → **AdMax serves everything** and not one
 *   request reaches Google.
 * - Neither → no ads at all, and no ad code runs.
 * The switch is therefore an operational one (which secrets the publish
 * workflow injects), which is what makes it reviewable in a build log.
 */

export interface WebAdsConfig {
  /** Placeholder ads, zero network. Defaults on in dev, like the AdMob path. */
  testMode: boolean;
  /** AdSense publisher/client ID, injected via VITE_ADSENSE_CLIENT. */
  client: string | null;
  /** Display-unit slot ID for the collection home, via VITE_ADSENSE_SLOT_HOME. */
  slotHome: string | null;
  /** Display-unit slot ID for the result screens, via VITE_ADSENSE_SLOT_RESULT. */
  slotResult: string | null;
  /**
   * Which surfaces this build carries a 忍者AdMax frame for — the fixed-size
   * units of services/ads/web/admax.ts. Deliberately booleans and not the
   * IDs: this module ships in the native bundle too, and inlining opaque
   * frame IDs there is exactly what the app promises not to do
   * (vite.config.ts's `adFrameSurfaces` explains why a build-time constant
   * carries the answer, and why it is one flag per surface).
   */
  frames: AdFrameSurfaces;
}

export interface AdFrameSurfaces {
  /** The bottom bar that stands in for Google's Auto-ads anchor. */
  anchor: boolean;
  /** The collection home's display slot. */
  home: boolean;
  /** The result screens' occasional display slot. */
  result: boolean;
}

/** The two display placements the web build owns (docs/ADS_POLICY.md「Web 版」). */
export type WebAdPlacement = 'home' | 'result';

/**
 * An unset variable and one set to the empty string mean the same thing here:
 * there is no ID.
 *
 * This is not defensive tidying — `?? null` alone was a live bug. Vite embeds
 * an empty environment variable as `""`, not `undefined`, and the workflows
 * pass `''` for every mode except production
 * (`SG_WEB_ADS_MODE == 'production' && secrets.X || ''`). So a build made with
 * `ads: disabled` held `client === ''`, which is not null: the anchor space
 * was reserved, the privacy summary claimed AdSense, and the loader was
 * injected with an empty client — a real request to the ad network from the
 * one mode documented to make none (docs/ADS_POLICY.md, OFFLINE_POLICY.md).
 */
export function adIdFromEnv(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function fromEnv(): WebAdsConfig {
  return {
    testMode: import.meta.env.DEV || import.meta.env.VITE_ADSENSE_USE_TEST_ADS === 'true',
    client: adIdFromEnv(import.meta.env.VITE_ADSENSE_CLIENT),
    slotHome: adIdFromEnv(import.meta.env.VITE_ADSENSE_SLOT_HOME),
    slotResult: adIdFromEnv(import.meta.env.VITE_ADSENSE_SLOT_RESULT),
    // Build-time constant, all false in every non-web build (vite.config.ts).
    frames: __SG_AD_FRAMES__,
  };
}

let config: WebAdsConfig = fromEnv();

export function webAdsConfig(): WebAdsConfig {
  return config;
}

/**
 * Whether an anchor — the ad at the bottom edge — can appear in this build:
 * test mode, an injected client (Google's Auto-ads overlay), or an AdMax
 * anchor frame (our own bar). Neither needs a display slot ID.
 *
 * This is what reserves the bottom space on every screen and boots the
 * anchor, so it asks about the anchor alone: a build carrying only display
 * frames would otherwise keep 116px clear for a bar that can never mount.
 */
export function webAnchorEnabled(): boolean {
  // Truthiness, not `!== null`: an empty ID is an absent ID here, and this
  // predicate decides whether any anchor code runs at all.
  return config.testMode || Boolean(config.client) || config.frames.anchor;
}

/**
 * Whether one display placement can render anything at all in this build:
 * test mode, an AdSense slot injected beside the client, or an AdMax frame
 * for that placement. With none of those the slot renders nothing and no
 * empty box is reserved — a decision fixed at build time, so it can never
 * shift the layout. (Per placement, not per build: the lazy unit resolves
 * after the first paint, so a box reserved for a placement with no frame
 * would be visibly taken away rather than never drawn.)
 *
 * Frames are still counted per placement rather than per size: whether the
 * ONE frame that fits the measured width exists is a runtime question, and
 * AdUnit settles that before the first paint.
 */
export function webAdsSlotEnabled(placement: WebAdPlacement): boolean {
  const slot = placement === 'home' ? config.slotHome : config.slotResult;
  const frame = placement === 'home' ? config.frames.home : config.frames.result;
  return config.testMode || (Boolean(config.client) && Boolean(slot)) || frame;
}

/** Test hook (same pattern as setOnlineForTesting). `null` restores env values. */
export function setWebAdsConfigForTesting(partial: Partial<WebAdsConfig> | null): void {
  config = partial === null ? fromEnv() : { ...config, ...partial };
}
