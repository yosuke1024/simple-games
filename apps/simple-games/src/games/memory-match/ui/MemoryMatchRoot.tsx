/**
 * Memory Match's root: loads the game's own records (local, fast, offline),
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
import { MemoryProvider, useMemoryMatch } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './memory-match.css';
import { MemoryDailyScreen } from './screens/DailyScreen';
import { MemoryGameScreen } from './screens/GameScreen';
import { MemoryHomeScreen } from './screens/HomeScreen';
import { MemoryStatsScreen } from './screens/StatsScreen';
import { MemoryTutorialScreen } from './screens/TutorialScreen';

export function MemoryScreens() {
  const { screen } = useMemoryMatch();
  switch (screen) {
    case 'tutorial':
      return <MemoryTutorialScreen />;
    case 'daily':
      return <MemoryDailyScreen />;
    case 'game':
      return <MemoryGameScreen />;
    case 'stats':
      return <MemoryStatsScreen />;
    case 'home':
    default:
      return <MemoryHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  sessions: SavedGames;
}

export interface MemoryMatchRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function MemoryMatchRoot({ onExit, kv = preferencesKV }: MemoryMatchRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        sessions: { difficulty: null, daily: null },
      };
      try {
        const [stats, flags, sessions] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadSavedGames(kv),
        ]);
        loaded = { stats, flags, sessions };
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
    <MemoryProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSessions={data.sessions}
      onExit={onExit}
    >
      <MemoryScreens />
    </MemoryProvider>
  );
}
