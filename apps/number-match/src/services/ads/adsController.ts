/**
 * AdMob orchestration (docs/ADS_POLICY.md).
 *
 * Hard rules implemented here:
 * - Ads never gate game features; every failure path is silent.
 * - Offline → every ad call is skipped; the game continues unchanged.
 * - Interstitials only show when ALREADY loaded; never wait for loading.
 * - After showing, the instance is discarded and the next one prepares in
 *   the background.
 * - Dev builds use Google's official test ad units. Production unit IDs are
 *   injected via environment variables at build time; when absent, ads are
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
import { localDateString } from '../../game';
import { isOnline } from '../network';
import { getRemoteConfig } from '../remoteConfig';
import { countersForPolicy, registerInterstitialShown } from './adState';
import { canShowInterstitial, type InterstitialTrigger } from './interstitialPolicy';

/** Google's official test ad unit IDs (safe to hardcode; never earn revenue). */
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

const useTestAds: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ADMOB_USE_TEST_ADS === 'true';

function bannerAdUnitId(): string | null {
  if (useTestAds) return TEST_BANNER_ID;
  return import.meta.env.VITE_ADMOB_BANNER_ID ?? null;
}

function interstitialAdUnitId(): string | null {
  if (useTestAds) return TEST_INTERSTITIAL_ID;
  return import.meta.env.VITE_ADMOB_INTERSTITIAL_ID ?? null;
}

let initialized = false;
let bannerCreated = false;
let bannerShowing = false;
/** Desired banner visibility, remembered across the async SDK init. */
let bannerWanted = false;
let bannerBusy = false;
let interstitialReady = false;
let preparingInterstitial = false;

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
    void prepareInterstitialIfNeeded();
    // The game screen may have been entered before init finished.
    if (bannerWanted) void applyBannerState();
  } catch {
    // SDK init failed (offline etc.): game unaffected; retried next launch.
  }
}

/**
 * UMP consent, decoupled from game initialization (spec §17): failures are
 * ignored and the game never waits for this.
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
 * All failures are silent; offline is a normal skip.
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
    if (!getRemoteConfig().banner_enabled || !isOnline()) return;
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

export async function prepareInterstitialIfNeeded(): Promise<void> {
  if (!isNativeAdsPlatform() || !initialized || interstitialReady || preparingInterstitial) return;
  if (!getRemoteConfig().interstitial_enabled || !isOnline()) return;
  const adId = interstitialAdUnitId();
  if (!adId) return;
  preparingInterstitial = true;
  try {
    await AdMob.prepareInterstitial({ adId, isTesting: useTestAds });
    interstitialReady = true;
  } catch {
    interstitialReady = false;
  } finally {
    preparingInterstitial = false;
  }
}

/**
 * Shows an interstitial at a natural break if — and only if — the frequency
 * policy passes AND an ad is already loaded. Returns immediately otherwise
 * (never blocks or delays the flow that triggered it).
 */
export async function maybeShowInterstitial(_trigger: InterstitialTrigger): Promise<boolean> {
  if (!isNativeAdsPlatform() || !initialized || !isOnline()) return false;
  const config = getRemoteConfig();
  if (!config.interstitial_enabled) return false;
  const now = Date.now();
  const today = localDateString(new Date());
  if (!canShowInterstitial(config, countersForPolicy(today), now)) {
    return false;
  }
  if (!interstitialReady) {
    // Not loaded: skip instantly, warm up the next opportunity.
    void prepareInterstitialIfNeeded();
    return false;
  }
  try {
    interstitialReady = false; // Never reuse the same ad instance.
    await AdMob.showInterstitial();
    registerInterstitialShown(now, today);
    void prepareInterstitialIfNeeded();
    return true;
  } catch {
    void prepareInterstitialIfNeeded();
    return false;
  }
}
