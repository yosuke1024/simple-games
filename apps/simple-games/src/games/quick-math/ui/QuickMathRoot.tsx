/**
 * Quick Math's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
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
import { QuickMathProvider, useQuickMath } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { QuickMathDailyScreen } from './screens/DailyScreen';
import { QuickMathGameScreen } from './screens/GameScreen';
import { QuickMathHomeScreen } from './screens/HomeScreen';
import { QuickMathLevelSelectScreen } from './screens/LevelSelectScreen';
import { QuickMathStatsScreen } from './screens/StatsScreen';
import { QuickMathTutorialScreen } from './screens/TutorialScreen';
import './quick-math.css';

export function QuickMathScreens() {
  const { screen } = useQuickMath();
  switch (screen) {
    case 'tutorial':
      return <QuickMathTutorialScreen />;
    case 'levels':
      return <QuickMathLevelSelectScreen />;
    case 'daily':
      return <QuickMathDailyScreen />;
    case 'game':
      return <QuickMathGameScreen />;
    case 'stats':
      return <QuickMathStatsScreen />;
    case 'home':
    default:
      return <QuickMathHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  sessions: SavedGames;
}

export interface QuickMathRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Passed straight through: what a door means is the provider's
   * answer, taken once from the records loaded below.
   */
  entry?: 'collection' | 'shortcut';
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function QuickMathRoot({ onExit, entry, kv = preferencesKV }: QuickMathRootProps) {
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
    <QuickMathProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <QuickMathScreens />
    </QuickMathProvider>
  );
}
