/**
 * Nonogram's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
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
import { NonogramProvider, useNonogram } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Progress,
  type Stats,
} from '../storage/schemas';
import './nonogram.css';
import { NonoDailyScreen } from './screens/DailyScreen';
import { NonoGameScreen } from './screens/GameScreen';
import { NonoHomeScreen } from './screens/HomeScreen';
import { NonoLevelSelectScreen } from './screens/LevelSelectScreen';
import { NonoStatsScreen } from './screens/StatsScreen';
import { NonoTutorialScreen } from './screens/TutorialScreen';

export function NonogramScreens() {
  const { screen } = useNonogram();
  switch (screen) {
    case 'tutorial':
      return <NonoTutorialScreen />;
    case 'levels':
      return <NonoLevelSelectScreen />;
    case 'daily':
      return <NonoDailyScreen />;
    case 'game':
      return <NonoGameScreen />;
    case 'stats':
      return <NonoStatsScreen />;
    case 'home':
    default:
      return <NonoHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  progress: Progress;
  sessions: SavedGames;
}

export interface NonogramRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function NonogramRoot({ onExit, kv = preferencesKV }: NonogramRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        prefs: prefsSchema.defaultValue(),
        progress: progressSchema.defaultValue(),
        sessions: { level: null, daily: null, free: null },
      };
      try {
        const [stats, flags, prefs, progress, sessions] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(prefsSchema, kv),
          loadRecord(progressSchema, kv),
          loadSavedGames(kv),
        ]);
        loaded = { stats, flags, prefs, progress, sessions };
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
    <NonogramProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      onExit={onExit}
    >
      <NonogramScreens />
    </NonogramProvider>
  );
}
