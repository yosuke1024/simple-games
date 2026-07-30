/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The production AdMob banner unit ID — the collection's only ad unit —
   * injected at build time. Never committed.
   * (The AdMob APPLICATION_ID is native-side: a Gradle manifest placeholder
   * fed by the ADMOB_APP_ID env var — see android/app/build.gradle.)
   */
  readonly VITE_ADMOB_BANNER_ID?: string;
  /** 'true' to force Google test ad units in a production-mode build. */
  readonly VITE_ADMOB_USE_TEST_ADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
