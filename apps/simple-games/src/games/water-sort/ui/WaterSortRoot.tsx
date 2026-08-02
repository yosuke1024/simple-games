/**
 * Water Sort's root: loads the game's own records (local, fast, offline),
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
import { useWaterSort, WaterProvider } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import './water-sort.css';
import { WaterDailyScreen } from './screens/DailyScreen';
import { WaterGameScreen } from './screens/GameScreen';
import { WaterHomeScreen } from './screens/HomeScreen';
import { WaterLevelSelectScreen } from './screens/LevelSelectScreen';
import { WaterStatsScreen } from './screens/StatsScreen';
import { WaterTutorialScreen } from './screens/TutorialScreen';

export function WaterScreens() {
  const { screen } = useWaterSort();
  switch (screen) {
    case 'tutorial':
      return <WaterTutorialScreen />;
    case 'levels':
      return <WaterLevelSelectScreen />;
    case 'daily':
      return <WaterDailyScreen />;
    case 'game':
      return <WaterGameScreen />;
    case 'stats':
      return <WaterStatsScreen />;
    case 'home':
    default:
      return <WaterHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  sessions: SavedGames;
}

export interface WaterSortRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function WaterSortRoot({ onExit, kv = preferencesKV }: WaterSortRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        progress: progressSchema.defaultValue(),
        sessions: { level: null, daily: null },
      };
      try {
        const [stats, flags, progress, sessions] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(progressSchema, kv),
          loadSavedGames(kv),
        ]);
        loaded = { stats, flags, progress, sessions };
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
    <WaterProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      onExit={onExit}
    >
      <WaterScreens />
    </WaterProvider>
  );
}
