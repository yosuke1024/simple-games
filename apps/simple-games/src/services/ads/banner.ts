/**
 * The collection's ONLY ad surface: one anchored adaptive banner
 * (docs/ADS_POLICY.md). There is no interstitial, no rewarded, no app-open —
 * not just unused but absent, so the public source proves the promise.
 *
 * Hard rules implemented here:
 * - Ads never gate game features; every failure path is silent.
 * - Offline → no ad requests at all, and no retry loops (battery).
 * - The ad-removal purchase is honored by the caller (BannerSlot): once the
 *   entitlement is active this module is simply never asked to show anything.
 * - Dev builds use Google's official test ad unit. The production unit ID is
 *   injected via an environment variable at build time; when absent, ads are
 *   simply disabled.
 */
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { isOnline } from '../network';

/** Google's official test banner ID (safe to hardcode; never earns revenue). */
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741';

const useTestAds: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ADMOB_USE_TEST_ADS === 'true';

function bannerAdUnitId(): string | null {
  if (useTestAds) return TEST_BANNER_ID;
  return import.meta.env.VITE_ADMOB_BANNER_ID ?? null;
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
    void requestConsentIfNeeded();
    // The game screen may have been entered before init finished.
    if (bannerWanted) void applyBannerState();
  } catch {
    // SDK init failed (offline etc.): game unaffected; retried next launch.
  }
}

/**
 * UMP consent, decoupled from game initialization: failures are ignored and
 * the game never waits for this.
 */
async function requestConsentIfNeeded(): Promise<void> {
  if (!isOnline()) return;
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
    }
  } catch {
    // No consent config / offline: continue without personalized ads.
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
