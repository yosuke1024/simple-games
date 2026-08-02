/**
 * Brick Breaker's root: loads the game's own records (local, fast, offline),
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
import { BrickProvider, useBrickBreaker } from '../state/GameContext';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import './brick-breaker.css';
import { BrickGameScreen } from './screens/GameScreen';
import { BrickHomeScreen } from './screens/HomeScreen';
import { BrickLevelSelectScreen } from './screens/LevelSelectScreen';
import { BrickStatsScreen } from './screens/StatsScreen';
import { BrickTutorialScreen } from './screens/TutorialScreen';

export function BrickScreens() {
  const { screen } = useBrickBreaker();
  switch (screen) {
    case 'tutorial':
      return <BrickTutorialScreen />;
    case 'levels':
      return <BrickLevelSelectScreen />;
    case 'game':
      return <BrickGameScreen />;
    case 'stats':
      return <BrickStatsScreen />;
    case 'home':
    default:
      return <BrickHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
}

export interface BrickBreakerRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function BrickBreakerRoot({ onExit, kv = preferencesKV }: BrickBreakerRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        progress: progressSchema.defaultValue(),
      };
      try {
        const [stats, flags, progress] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(progressSchema, kv),
        ]);
        loaded = { stats, flags, progress };
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
    <BrickProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      onExit={onExit}
    >
      <BrickScreens />
    </BrickProvider>
  );
}
