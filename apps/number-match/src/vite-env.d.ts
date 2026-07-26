/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Production AdMob unit IDs, injected at build time. Never committed.
   * (The AdMob APPLICATION_ID is native-side: a Gradle manifest placeholder
   * fed by the ADMOB_APP_ID env var — see android/app/build.gradle.)
   */
  readonly VITE_ADMOB_BANNER_ID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_ID?: string;
  /** 'true' to force Google test ad units in a production-mode build. */
  readonly VITE_ADMOB_USE_TEST_ADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
