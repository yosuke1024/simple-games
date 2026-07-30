import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from './app/App';
import { initAdRemoval, isAdRemovalPurchased } from './monetization/adRemoval';
import { initPlayBilling } from './monetization/playBilling';
import { initAds } from './services/ads/banner';
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
    settings = await loadRecord(settingsSchema);
  } catch {
    // Even unexpected boot failures must not prevent playing: use defaults.
  }

  createRoot(container).render(
    <StrictMode>
      <SettingsProvider initialSettings={settings}>
        <App />
      </SettingsProvider>
    </StrictMode>,
  );

  // Fire-and-forget: ad SDK init, billing availability and splash hide never
  // gate the app. With the ad-removal purchase active the ad SDK is never
  // initialized at all (battery, and no ad code runs for paying users).
  if (!isAdRemovalPurchased()) void initAds();
  void initPlayBilling();
  void SplashScreen.hide().catch(() => undefined);
}

void boot();
