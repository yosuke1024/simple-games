/**
 * Schulte Table's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * There is no saved round to load — only progress, statistics and flags (§11).
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import { useEffect, useState } from 'react';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { SchulteProvider, useSchulte } from '../state/GameContext';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { SchulteDailyScreen } from './screens/DailyScreen';
import { SchulteGameScreen } from './screens/GameScreen';
import { SchulteHomeScreen } from './screens/HomeScreen';
import { SchulteLevelSelectScreen } from './screens/LevelSelectScreen';
import { SchulteStatsScreen } from './screens/StatsScreen';
import { SchulteTutorialScreen } from './screens/TutorialScreen';
import './schulte-table.css';

export function SchulteTableScreens() {
  const { screen } = useSchulte();
  switch (screen) {
    case 'tutorial':
      return <SchulteTutorialScreen />;
    case 'levels':
      return <SchulteLevelSelectScreen />;
    case 'daily':
      return <SchulteDailyScreen />;
    case 'game':
      return <SchulteGameScreen />;
    case 'stats':
      return <SchulteStatsScreen />;
    case 'home':
    default:
      return <SchulteHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
}

export interface SchulteTableRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function SchulteTableRoot({ onExit, kv = preferencesKV }: SchulteTableRootProps) {
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
    <SchulteProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      onExit={onExit}
    >
      <SchulteTableScreens />
    </SchulteProvider>
  );
}
