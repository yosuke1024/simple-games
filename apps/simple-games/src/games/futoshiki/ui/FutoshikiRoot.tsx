/**
 * Futoshiki's root: loads the game's own records (local, fast, offline), then
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
import { FutoshikiProvider, useFutoshiki } from '../state/GameContext';
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
import './futoshiki.css';
import { FutoshikiDailyScreen } from './screens/DailyScreen';
import { FutoshikiGameScreen } from './screens/GameScreen';
import { FutoshikiHomeScreen } from './screens/HomeScreen';
import { FutoshikiLevelSelectScreen } from './screens/LevelSelectScreen';
import { FutoshikiStatsScreen } from './screens/StatsScreen';
import { FutoshikiTutorialScreen } from './screens/TutorialScreen';

export function FutoshikiScreens() {
  const { screen } = useFutoshiki();
  switch (screen) {
    case 'tutorial':
      return <FutoshikiTutorialScreen />;
    case 'levels':
      return <FutoshikiLevelSelectScreen />;
    case 'daily':
      return <FutoshikiDailyScreen />;
    case 'game':
      return <FutoshikiGameScreen />;
    case 'stats':
      return <FutoshikiStatsScreen />;
    case 'home':
    default:
      return <FutoshikiHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface FutoshikiRootProps {
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

export function FutoshikiRoot({ onExit, entry, kv = preferencesKV }: FutoshikiRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        progress: progressSchema.defaultValue(),
        prefs: prefsSchema.defaultValue(),
        sessions: { level: null, daily: null, free: null },
      };
      try {
        const [stats, flags, progress, prefs, sessions] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(progressSchema, kv),
          loadRecord(prefsSchema, kv),
          loadSavedGames(kv),
        ]);
        loaded = { stats, flags, progress, prefs, sessions };
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
    <FutoshikiProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      prefs={data.prefs}
      onExit={onExit}
      entry={entry}
    >
      <FutoshikiScreens />
    </FutoshikiProvider>
  );
}
