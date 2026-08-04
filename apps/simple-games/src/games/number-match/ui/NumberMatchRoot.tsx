/**
 * Number Match's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import { useEffect, useState } from 'react';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { AppProvider, useApp } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { DailyScreen } from './screens/DailyScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LevelSelectScreen } from './screens/LevelSelectScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import './number-match.css';

export function NumberMatchScreens() {
  const { screen } = useApp();
  switch (screen) {
    case 'tutorial':
      return <TutorialScreen />;
    case 'levels':
      return <LevelSelectScreen />;
    case 'daily':
      return <DailyScreen />;
    case 'game':
      return <GameScreen />;
    case 'stats':
      return <StatsScreen />;
    case 'home':
    default:
      return <HomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  sessions: SavedGames;
}

export interface NumberMatchRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function NumberMatchRoot({ onExit, kv = preferencesKV }: NumberMatchRootProps) {
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
    <AppProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      onExit={onExit}
    >
      <NumberMatchScreens />
    </AppProvider>
  );
}
