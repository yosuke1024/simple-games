/**
 * Kakuro's root: loads the game's own records (local, fast, offline), then
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
import { KakuroProvider, useKakuro } from '../state/GameContext';
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
import './kakuro.css';
import { KakuroDailyScreen } from './screens/DailyScreen';
import { KakuroGameScreen } from './screens/GameScreen';
import { KakuroHomeScreen } from './screens/HomeScreen';
import { KakuroLevelSelectScreen } from './screens/LevelSelectScreen';
import { KakuroStatsScreen } from './screens/StatsScreen';
import { KakuroTutorialScreen } from './screens/TutorialScreen';

export function KakuroScreens() {
  const { screen } = useKakuro();
  switch (screen) {
    case 'tutorial':
      return <KakuroTutorialScreen />;
    case 'levels':
      return <KakuroLevelSelectScreen />;
    case 'daily':
      return <KakuroDailyScreen />;
    case 'game':
      return <KakuroGameScreen />;
    case 'stats':
      return <KakuroStatsScreen />;
    case 'home':
    default:
      return <KakuroHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface KakuroRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). A fact, not an instruction: passed straight down, because what a
   * door means is the provider's answer, taken once from the records loaded
   * below.
   */
  entry?: 'collection' | 'shortcut';
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function KakuroRoot({ onExit, entry, kv = preferencesKV }: KakuroRootProps) {
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
    <KakuroProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      prefs={data.prefs}
      onExit={onExit}
      entry={entry}
    >
      <KakuroScreens />
    </KakuroProvider>
  );
}
