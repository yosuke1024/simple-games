/**
 * Sky Fighter's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
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
import { SkyProvider, useSkyFighter } from '../state/GameContext';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import './sky-fighter.css';
import { SkyGameScreen } from './screens/GameScreen';
import { SkyHomeScreen } from './screens/HomeScreen';
import { SkyLevelSelectScreen } from './screens/LevelSelectScreen';
import { SkyStatsScreen } from './screens/StatsScreen';
import { SkyTutorialScreen } from './screens/TutorialScreen';

export function SkyScreens() {
  const { screen } = useSkyFighter();
  switch (screen) {
    case 'tutorial':
      return <SkyTutorialScreen />;
    case 'levels':
      return <SkyLevelSelectScreen />;
    case 'game':
      return <SkyGameScreen />;
    case 'stats':
      return <SkyStatsScreen />;
    case 'home':
    default:
      return <SkyHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
}

export interface SkyFighterRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function SkyFighterRoot({ onExit, kv = preferencesKV }: SkyFighterRootProps) {
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
    <SkyProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      onExit={onExit}
    >
      <SkyScreens />
    </SkyProvider>
  );
}
