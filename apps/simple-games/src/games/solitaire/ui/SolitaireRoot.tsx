/**
 * Solitaire's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
 */
import { useEffect, useState } from 'react';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { SolitaireProvider, useSolitaire } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './solitaire.css';
import { SolitaireDailyScreen } from './screens/DailyScreen';
import { SolitaireGameScreen } from './screens/GameScreen';
import { SolitaireHomeScreen } from './screens/HomeScreen';
import { SolitaireStatsScreen } from './screens/StatsScreen';
import { SolitaireTutorialScreen } from './screens/TutorialScreen';

export function SolitaireScreens() {
  const { screen } = useSolitaire();
  switch (screen) {
    case 'tutorial':
      return <SolitaireTutorialScreen />;
    case 'daily':
      return <SolitaireDailyScreen />;
    case 'game':
      return <SolitaireGameScreen />;
    case 'stats':
      return <SolitaireStatsScreen />;
    case 'home':
    default:
      return <SolitaireHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface SolitaireRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function SolitaireRoot({ onExit, kv = preferencesKV }: SolitaireRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        prefs: prefsSchema.defaultValue(),
        sessions: { free: null, daily: null },
      };
      try {
        const [stats, flags, prefs, sessions] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(prefsSchema, kv),
          loadSavedGames(kv),
        ]);
        loaded = { stats, flags, prefs, sessions };
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
    <SolitaireProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
    >
      <SolitaireScreens />
    </SolitaireProvider>
  );
}
