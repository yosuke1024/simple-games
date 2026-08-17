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
    });
    // Ask for consent early so the first game screen does not have to wait,
    // but never wait for it here: the answer is required before an ad
    // request, not before the app finishes booting.
    void canRequestAds();
    // The game screen may have been entered before init finished.
    if (bannerWanted) void applyBannerState();
  } catch {
    // SDK init failed (offline etc.): game unaffected; retried next launch.
  }
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
    // let the player leave the game screen first, so the intent is rechecked
    // below rather than assumed.
    if (!(await canRequestAds())) return;
    if (!bannerWanted || bannerCreated) return;
    await AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: useTestAds,
    });
    bannerCreated = true;
    bannerShowing = true;
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
  bannerSizeListeners.clear();
}
