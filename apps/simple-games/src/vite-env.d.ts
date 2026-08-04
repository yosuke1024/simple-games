/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The production AdMob banner unit ID for the ANDROID app — the app's only
   * ad unit — injected at build time. Never committed. AdMob IDs are per-OS,
   * so the name carries the platform: an iOS build adds
   * VITE_ADMOB_IOS_BANNER_ID beside this rather than reusing it.
   * (The AdMob APPLICATION_ID is native-side: a Gradle manifest placeholder
   * fed by the ADMOB_ANDROID_APP_ID env var — see android/app/build.gradle.)
   */
  readonly VITE_ADMOB_ANDROID_BANNER_ID?: string;
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
   * Web build only — the GA4 Web Stream measurement ID for
   * pixapps.ai/simple-games/play/. Missing or invalid means analytics is off.
   * Never commit the real ID; inject it when building the web artifact.
   */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
