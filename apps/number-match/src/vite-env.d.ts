/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production AdMob unit IDs, injected at build time. Never committed. */
  readonly VITE_ADMOB_APP_ID?: string;
  readonly VITE_ADMOB_BANNER_ID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_ID?: string;
  /** 'true' to force Google test ad units in a production-mode build. */
  readonly VITE_ADMOB_USE_TEST_ADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
