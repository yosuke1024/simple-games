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
}

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
  };
}

let config: WebAdsConfig = fromEnv();

export function webAdsConfig(): WebAdsConfig {
  return config;
}

/**
 * Whether web ads exist at all in this build: test mode, or an injected
 * client ID. The client alone is enough for the Auto-ads anchor (it has no
 * slot ID — the AdSense console decides its formats), which is why this does
 * not require a slot. Drives the boot loader and the reserved bottom space.
 */
export function webAdsEnabled(): boolean {
  // Truthiness, not `!== null`: an empty ID is an absent ID here, and this
  // predicate decides whether any ad code runs at all.
  return config.testMode || Boolean(config.client);
}

/**
 * Whether one specific display placement can render: its slot ID must be
 * injected alongside the client (or test mode shows the placeholder). With
 * neither, that slot renders nothing — no empty box is reserved (a decision
 * fixed at build time, so it can never cause a layout shift at runtime).
 */
export function webAdsSlotEnabled(slot: string | null): boolean {
  return config.testMode || (Boolean(config.client) && Boolean(slot));
}

/** Test hook (same pattern as setOnlineForTesting). `null` restores env values. */
export function setWebAdsConfigForTesting(partial: Partial<WebAdsConfig> | null): void {
  config = partial === null ? fromEnv() : { ...config, ...partial };
}
