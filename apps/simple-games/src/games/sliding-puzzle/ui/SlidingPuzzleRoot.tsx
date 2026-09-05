/**
 * Sliding Puzzle's root: loads the game's own records (local, fast, offline),
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
import { SlidingPuzzleProvider, useSlidingPuzzle } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import './sliding-puzzle.css';
import { SlidingPuzzleDailyScreen } from './screens/DailyScreen';
import { SlidingPuzzleGameScreen } from './screens/GameScreen';
import { SlidingPuzzleHomeScreen } from './screens/HomeScreen';
import { SlidingPuzzleLevelSelectScreen } from './screens/LevelSelectScreen';
import { SlidingPuzzleStatsScreen } from './screens/StatsScreen';
import { SlidingPuzzleTutorialScreen } from './screens/TutorialScreen';

export function SlidingPuzzleScreens() {
  const { screen } = useSlidingPuzzle();
  switch (screen) {
    case 'tutorial':
      return <SlidingPuzzleTutorialScreen />;
    case 'levels':
      return <SlidingPuzzleLevelSelectScreen />;
    case 'daily':
      return <SlidingPuzzleDailyScreen />;
    case 'game':
      return <SlidingPuzzleGameScreen />;
    case 'stats':
      return <SlidingPuzzleStatsScreen />;
    case 'home':
    default:
      return <SlidingPuzzleHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  sessions: SavedGames;
}

export interface SlidingPuzzleRootProps {
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

export function SlidingPuzzleRoot({ onExit, entry, kv = preferencesKV }: SlidingPuzzleRootProps) {
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
    <SlidingPuzzleProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <SlidingPuzzleScreens />
    </SlidingPuzzleProvider>
  );
}
