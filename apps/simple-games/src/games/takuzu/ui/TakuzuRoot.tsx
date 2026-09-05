/**
 * Takuzu's root: loads the game's own records (local, fast, offline), then
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
import { TakuzuProvider, useTakuzu } from '../state/GameContext';
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
import './takuzu.css';
import { TakuzuDailyScreen } from './screens/DailyScreen';
import { TakuzuGameScreen } from './screens/GameScreen';
import { TakuzuHomeScreen } from './screens/HomeScreen';
import { TakuzuLevelSelectScreen } from './screens/LevelSelectScreen';
import { TakuzuStatsScreen } from './screens/StatsScreen';
import { TakuzuTutorialScreen } from './screens/TutorialScreen';

export function TakuzuScreens() {
  const { screen } = useTakuzu();
  switch (screen) {
    case 'tutorial':
      return <TakuzuTutorialScreen />;
    case 'levels':
      return <TakuzuLevelSelectScreen />;
    case 'daily':
      return <TakuzuDailyScreen />;
    case 'game':
      return <TakuzuGameScreen />;
    case 'stats':
      return <TakuzuStatsScreen />;
    case 'home':
    default:
      return <TakuzuHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface TakuzuRootProps {
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

export function TakuzuRoot({ onExit, entry, kv = preferencesKV }: TakuzuRootProps) {
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
    <TakuzuProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      prefs={data.prefs}
      onExit={onExit}
      entry={entry}
    >
      <TakuzuScreens />
    </TakuzuProvider>
  );
}
