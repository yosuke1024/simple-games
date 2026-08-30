import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from './app/App';
import { initRecentGames } from './app/recentGames';
import { resolveLocale } from './i18n';
import { initAdRemoval, isAdRemovalPurchased } from './monetization/adRemoval';
import { initNativeStore } from './monetization/nativeStore';
import { initAds } from './services/ads/banner';
import { webAnchorEnabled } from './services/ads/web/config';
import { initNetwork } from './services/network';
import { initReview } from './services/review';
import { loadRecord } from './storage/repo';
import { settingsSchema } from './storage/schemas';
import { SettingsProvider } from './state/SettingsContext';
// Display font (title, tiles, scores): bundled latin subsets only, ~36 KB —
// body text and non-latin scripts stay on system fonts (offline-first).
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './ui/styles.css';

/**
 * Boot: local-only reads (fast, offline-first). The shell loads only the
 * shared records; each game loads its own when opened. Network-dependent
 * work (the banner SDK) starts AFTER first render and is never awaited —
 * the app never waits for the network (docs/OFFLINE_POLICY.md).
 */
async function boot(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) return;

  let settings = settingsSchema.defaultValue();
  try {
    await initNetwork();
    await initAdRemoval();
    await initReview();
    await initRecentGames();
    settings = await loadRecord(settingsSchema);
  } catch {
    // Even unexpected boot failures must not prevent playing: use defaults.
  }

  // Web build only — the whole block folds out of the native bundle
  // (import.meta.env.MODE is a build-time constant). The data attribute
  // reserves the anchor's bottom space on every screen BEFORE first paint
  // (styles.css), so the bottom-edge ad — Google's overlay or our own AdMax
  // bar — can never cover game controls and nothing shifts when it appears.
  // The boot itself (services/ads/web/boot.ts) is fire-and-forget, like the
  // AdMob init below.
  if (import.meta.env.MODE === 'web' && webAnchorEnabled()) {
    document.documentElement.dataset.sgWebAds = '';
    void import('./services/ads/web/boot').then((m) => m.initWebAds()).catch(() => undefined);
  }

  // Web build only, and default-off: without a valid build-time measurement
  // ID the integration chunk is never requested and no analytics request is
  // made. Network state was resolved above; an offline first attempt is not
  // retried during this page load (docs/WEB_VERSION.md「計測」).
  const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (import.meta.env.MODE === 'web' && gaMeasurementId) {
    void import('./services/analytics/web')
      .then((m) => m.initWebAnalytics(gaMeasurementId))
      // A chunk that never arrives must not disturb the player — but it must
      // not be invisible to the person building either, which is how a broken
      // integration stayed shipped (issue #84). `import.meta.env.DEV` is false
      // in every released build, so this line folds away with its message.
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('web analytics did not load', error);
      });
  }

  createRoot(container).render(
    <StrictMode>
      <SettingsProvider initialSettings={settings}>
        <App />
      </SettingsProvider>
    </StrictMode>,
  );

  // Web build only — the shared PixApps header, the browser version's way
  // back to the rest of the site (docs/WEB_VERSION.md「サイトクローム」).
  // Started after the render above so it can never delay first paint, and
  // handed the resolved locale directly: SettingsContext writes <html lang>
  // from an effect, so reading the DOM here would race the first commit.
  if (import.meta.env.MODE === 'web') {
    const locale = resolveLocale(settings.language);
    void import('./services/chrome/web/boot')
      .then((m) => m.initWebChrome(locale))
      .catch(() => undefined);
  }

  // Fire-and-forget: ad SDK init, billing availability and splash hide never
  // gate the app. With the ad-removal purchase active the ad SDK is never
  // initialized at all (battery, and no ad code runs for paying users).
  if (!isAdRemovalPurchased()) void initAds();
  void initNativeStore();
  void SplashScreen.hide().catch(() => undefined);
}

void boot();
