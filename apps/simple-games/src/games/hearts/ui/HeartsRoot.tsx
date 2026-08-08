/**
 * Hearts' root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work —
 * including the next beat of the table, still on its timer (battery: an
 * off-screen game renders nothing and thinks nothing).
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import { useEffect, useState } from 'react';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import type { HeartsSession } from '../game';
import { HeartsProvider, useHearts } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './hearts.css';
import { HeartsGameScreen } from './screens/GameScreen';
import { HeartsHomeScreen } from './screens/HomeScreen';
import { HeartsStatsScreen } from './screens/StatsScreen';
import { HeartsTutorialScreen } from './screens/TutorialScreen';

export function HeartsScreens() {
  const { screen } = useHearts();
  switch (screen) {
    case 'tutorial':
      return <HeartsTutorialScreen />;
    case 'game':
      return <HeartsGameScreen />;
    case 'stats':
      return <HeartsStatsScreen />;
    case 'home':
    default:
      return <HeartsHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: HeartsSession | null;
}

export interface HeartsRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function HeartsRoot({ onExit, kv = preferencesKV }: HeartsRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        prefs: prefsSchema.defaultValue(),
        session: null,
      };
      try {
        const [stats, flags, prefs, session] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(prefsSchema, kv),
          loadSavedGame(kv),
        ]);
        loaded = { stats, flags, prefs, session };
      } catch {
        // Even unexpected load failures must not prevent playing: defaults.
      }
      if (!cancelled) setData(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [kv]);

  // Local reads resolve in milliseconds; a spinner here would only flash.
  if (data === null) return null;

  return (
    <HeartsProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
    >
      <HeartsScreens />
    </HeartsProvider>
  );
}
