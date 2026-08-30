/**
 * The collection's ONLY ad surface: one anchored adaptive banner
 * (docs/ADS_POLICY.md). There is no interstitial, no rewarded, no app-open —
 * not just unused but absent, so the public source proves the promise.
 *
 * Hard rules implemented here:
 * - Ads never gate game features; every failure path is silent.
 * - Offline → no ad requests at all, and no retry loops (battery).
 * - No ad is requested before UMP says it may be (consent.ts).
 * - The ad-removal purchase is honored by the caller (BannerSlot): once the
 *   entitlement is active this module is simply never asked to show anything.
 * - Dev builds use Google's official test ad unit. The production unit ID is
 *   injected via an environment variable at build time; when absent, ads are
 *   simply disabled.
 */
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { isOnline } from '../network';
import { canRequestAds } from './consent';

/**
 * AdMob app IDs and unit IDs are per-OS, so every ID here is keyed by
 * platform and nothing is ever shared between the two. That is also why the
 * environment variables carry the platform in their names
 * (docs/ADS_POLICY.md「広告 ID の管理」).
 */
type AdPlatform = 'android' | 'ios';

/**
 * Google's official test banner units (safe to hardcode; they never earn
 * revenue). Both are the ADAPTIVE banner unit for their OS — the fixed-size
 * test units would not exercise the size the app actually asks for.
 */
const TEST_BANNER_ID: Record<AdPlatform, string> = {
  android: 'ca-app-pub-3940256099942544/9214589741',
  ios: 'ca-app-pub-3940256099942544/2435281174',
};

/**
 * Production units, injected at build time and never committed. Written as
 * whole `import.meta.env.VITE_…` expressions because Vite substitutes those
 * textually — a computed lookup would leave both IDs in every build, which is
 * exactly what "an iOS build must not carry the Android ID" forbids.
 */
const PRODUCTION_BANNER_ID: Record<AdPlatform, string | undefined> = {
  android: import.meta.env.VITE_ADMOB_ANDROID_BANNER_ID,
  ios: import.meta.env.VITE_ADMOB_IOS_BANNER_ID,
};

const useTestAds: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ADMOB_USE_TEST_ADS === 'true';

/** The ad platform, or null where the app shows no native banner at all. */
export function adPlatform(): AdPlatform | null {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' ? platform : null;
}

export function bannerAdUnitId(): string | null {
  const platform = adPlatform();
  if (!platform) return null;
  if (useTestAds) return TEST_BANNER_ID[platform];
  // The release workflow passes '' when ads are not configured, and Vite
  // embeds that as the empty string rather than undefined — so `?? null` alone
  // would hand back '' here. The caller's `if (!adId)` already stops that, but
  // normalizing at the source keeps the next caller from having to know.
  const injected = PRODUCTION_BANNER_ID[platform]?.trim() ?? '';
  return injected === '' ? null : injected;
}

let initialized = false;
let bannerCreated = false;
let bannerShowing = false;
/** Desired banner visibility, remembered across the async SDK init. */
let bannerWanted = false;
let bannerBusy = false;
/** The viewport width the current banner was requested for (see below). */
let bannerCreatedWidth: number | null = null;
let viewportWatched = false;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * An adaptive banner's size is fixed at request time — the plugin measures
 * the view once inside showBanner and never re-measures (BannerExecutor.swift
 * does the same on Android). On a portrait-locked phone that is the end of
 * the story; an iPad rotating or entering Split View (issue #93) is exactly
 * the case Google documents as "load a new banner". So: after a resize
 * settles, if the width moved enough to matter, the banner is recreated —
 * once per settled resize, never per resize event, and never offline.
 */
const RESIZE_SETTLE_MS = 600;
const RECREATE_MIN_DELTA_PX = 64;

const bannerSizeListeners = new Set<(height: number) => void>();

export function isNativeAdsPlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Fire-and-forget at app boot. Never a startup condition. */
export async function initAds(): Promise<void> {
  if (!isNativeAdsPlatform() || initialized) return;
  try {
    await AdMob.initialize({});
    initialized = true;
    void AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
      for (const listener of bannerSizeListeners) listener(size.height);
    });
    // A failed load destroys the native ad view; forget it so the next
    // game-screen entry recreates the banner instead of resuming nothing.
    void AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
      bannerCreated = false;
      bannerShowing = false;
      bannerCreatedWidth = null;
    });
    // Ask for consent early so the first game screen does not have to wait,
    // but never wait for it here: the answer is required before an ad
    // request, not before the app finishes booting.
    void canRequestAds();
    if (!viewportWatched) {
      viewportWatched = true;
      window.addEventListener('resize', onViewportResize);
    }
    // The game screen may have been entered before init finished.
    if (bannerWanted) void applyBannerState();
  } catch {
    // SDK init failed (offline etc.): game unaffected; retried next launch.
  }
}

function onViewportResize(): void {
  if (resizeTimer !== null) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeTimer = null;
    void refreshBannerForViewport();
  }, RESIZE_SETTLE_MS);
}

async function refreshBannerForViewport(): Promise<void> {
  if (!initialized || !bannerCreated) return;
  if (
    bannerCreatedWidth !== null &&
    Math.abs(window.innerWidth - bannerCreatedWidth) < RECREATE_MIN_DELTA_PX
  ) {
    return;
  }
  // Offline: a stale-width banner beats a queued request (no retry loops).
  if (!isOnline()) return;
  if (bannerBusy) {
    // A show/hide is in flight; let it finish and measure again.
    onViewportResize();
    return;
  }
  // Busy while the old view comes down, so a concurrent setBannerVisible
  // cannot request a new banner that the still-running removal would then
  // take with it. The wanted state it records is applied right below.
  bannerBusy = true;
  bannerCreated = false;
  bannerShowing = false;
  bannerCreatedWidth = null;
  try {
    await AdMob.removeBanner();
  } catch {
    // A view that was already gone: nothing to remove.
  } finally {
    bannerBusy = false;
  }
  // Hidden (home screen): stop here, so the next game entry creates the
  // banner at the new width without spending a request now.
  if (bannerWanted) await applyBannerState();
}

/** Subscribes to native banner height changes (for the reserved slot). */
export function onBannerSize(listener: (height: number) => void): () => void {
  bannerSizeListeners.add(listener);
  return () => {
    bannerSizeListeners.delete(listener);
  };
}

/**
 * Shows/hides the anchored adaptive banner. Called on game screen
 * enter/leave. The desired state is remembered, so a call made before the
 * SDK finished initializing is applied as soon as init completes.
 * All failures are silent; offline is a normal skip, not a retry loop.
 */
export async function setBannerVisible(visible: boolean): Promise<void> {
  bannerWanted = visible;
  if (!isNativeAdsPlatform() || !initialized) return;
  await applyBannerState();
}

async function applyBannerState(): Promise<void> {
  if (bannerBusy) return;
  bannerBusy = true;
  try {
    if (!bannerWanted) {
      if (bannerShowing) {
        bannerShowing = false;
        await AdMob.hideBanner();
      }
      return;
    }
    if (bannerCreated) {
      bannerShowing = true;
      await AdMob.resumeBanner();
      return;
    }
    if (!isOnline()) return;
    const adId = bannerAdUnitId();
    if (!adId) return;
    // Last gate before the only ad request this app makes. Awaiting here can
    // let the player leave the game screen first — or the network drop — so
    // both intents are rechecked below rather than assumed.
    if (!(await canRequestAds())) return;
    if (!bannerWanted || bannerCreated || !isOnline()) return;
    const requestedWidth = window.innerWidth;
    await AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: useTestAds,
    });
    bannerCreated = true;
    bannerShowing = true;
    bannerCreatedWidth = requestedWidth;
  } catch {
    // Banner failure: the reserved slot stays quietly empty.
  } finally {
    bannerBusy = false;
  }
}

/** Test hook. */
export function resetBannerForTesting(): void {
  initialized = false;
  bannerCreated = false;
  bannerShowing = false;
  bannerWanted = false;
  bannerBusy = false;
  bannerCreatedWidth = null;
  if (resizeTimer !== null) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }
  if (viewportWatched) {
    window.removeEventListener('resize', onViewportResize);
    viewportWatched = false;
  }
  bannerSizeListeners.clear();
}
