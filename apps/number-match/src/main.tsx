import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from './ui/App';
import { initAdState } from './services/ads/adState';
import { initAds } from './services/ads/adsController';
import { initNetwork } from './services/network';
import { initRemoteConfig } from './services/remoteConfig';
import { loadSavedGame } from './storage/gamePersistence';
import { loadRecord } from './storage/repo';
import { flagsSchema, settingsSchema, statsSchema } from './storage/schemas';
import { AppProvider } from './state/AppContext';
import { SettingsProvider } from './state/SettingsContext';
import './ui/styles.css';

/**
 * Boot: local-only reads (fast, offline-first). Network-dependent services
 * (ads) start AFTER first render and are never awaited — the game never
 * waits for the network (docs/OFFLINE_POLICY.md).
 */
async function boot(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) return;

  let settings = settingsSchema.defaultValue();
  let stats = statsSchema.defaultValue();
  let flags = flagsSchema.defaultValue();
  let savedGame = null as Awaited<ReturnType<typeof loadSavedGame>>;

  try {
    await initNetwork();
    await initRemoteConfig();
    await initAdState();
    [settings, stats, flags, savedGame] = await Promise.all([
      loadRecord(settingsSchema),
      loadRecord(statsSchema),
      loadRecord(flagsSchema),
      loadSavedGame(),
    ]);
  } catch {
    // Even unexpected boot failures must not prevent playing: use defaults.
  }

  createRoot(container).render(
    <StrictMode>
      <SettingsProvider initialSettings={settings}>
        <AppProvider initialStats={stats} initialFlags={flags} initialSession={savedGame}>
          <App />
        </AppProvider>
      </SettingsProvider>
    </StrictMode>,
  );

  // Fire-and-forget: ad SDK init and splash hide never gate the game.
  void initAds();
  void SplashScreen.hide().catch(() => undefined);
}

void boot();
