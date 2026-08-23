/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The production AdMob banner unit IDs — the app's only ad unit, once per
   * OS — injected at build time. Never committed. AdMob IDs are per-OS, so
   * the names carry the platform and neither build ever reads the other's
   * (services/ads/banner.ts selects by Capacitor.getPlatform()).
   * (The AdMob APPLICATION_ID is native-side: a Gradle manifest placeholder
   * fed by ADMOB_ANDROID_APP_ID — see android/app/build.gradle — and an Xcode
   * build setting fed by ADMOB_IOS_APP_ID — see ios/App/App/Info.plist.)
   */
  readonly VITE_ADMOB_ANDROID_BANNER_ID?: string;
  readonly VITE_ADMOB_IOS_BANNER_ID?: string;
  /** 'true' to force Google test ad units in a production-mode build. */
  readonly VITE_ADMOB_USE_TEST_ADS?: string;
  /**
   * Web build (`--mode web`) only — AdSense for the browser version at
   * pixapps.ai (docs/ADS_POLICY.md「Web 版」). Injected at build time and
   * never committed; the native build ignores them entirely. The client
   * alone enables the Auto-ads anchor; each display slot renders only when
   * its own ID is present alongside the client.
   */
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_HOME?: string;
  readonly VITE_ADSENSE_SLOT_RESULT?: string;
  /** 'true' renders the local placeholder test ad (no ad-network contact). */
  readonly VITE_ADSENSE_USE_TEST_ADS?: string;
  /**
   * Web build only — 忍者AdMax frame IDs (docs/ADS_POLICY.md「Web 版」).
   * Which network serves is decided by what this build carries: with an
   * AdSense client these are the runtime fallback, without one they are the
   * primary network. Injected at build time, never committed; keep them in
   * `.env.web` locally, so a native build cannot pick them up.
   * AdMax frames are fixed-size, so the name carries the exact size; a
   * missing ID means that placement×size simply has no ad.
   */
  readonly VITE_ADMAX_SLOT_HOME_728X90?: string;
  readonly VITE_ADMAX_SLOT_HOME_320X100?: string;
  readonly VITE_ADMAX_SLOT_RESULT_320X100?: string;
  readonly VITE_ADMAX_ANCHOR_728X90?: string;
  readonly VITE_ADMAX_ANCHOR_320X100?: string;
  /**
   * Web build only — the GA4 Web Stream measurement ID for
   * pixapps.ai/simple-games/play/. Missing or invalid means analytics is off.
   * Never commit the real ID; inject it when building the web artifact.
   */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

/**
 * Build-time constant from vite.config.ts: which ad surfaces this build
 * carries a 忍者AdMax frame for. The shared ad config reads this instead of
 * the IDs themselves, so the native bundle cannot carry them — see the
 * comment on `adFrameSurfaces` in vite.config.ts for why that indirection
 * exists, and why it is one flag per surface.
 */
declare const __SG_AD_FRAMES__: { anchor: boolean; home: boolean; result: boolean };

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
