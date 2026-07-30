/**
 * Minesweeper's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * The game's stylesheet is imported here rather than added to the shared one,
 * so everything Minesweeper looks like arrives and leaves with Minesweeper.
 */
import { useEffect, useState } from 'react';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { MinesweeperProvider, useMinesweeper } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import { MinesDailyScreen } from './screens/DailyScreen';
import { MinesGameScreen } from './screens/GameScreen';
import { MinesHomeScreen } from './screens/HomeScreen';
import { MinesStatsScreen } from './screens/StatsScreen';
import { MinesTutorialScreen } from './screens/TutorialScreen';
import './minesweeper.css';

export function MinesweeperScreens() {
  const { screen } = useMinesweeper();
  switch (screen) {
    case 'tutorial':
      return <MinesTutorialScreen />;
    case 'daily':
      return <MinesDailyScreen />;
    case 'game':
      return <MinesGameScreen />;
    case 'stats':
      return <MinesStatsScreen />;
    case 'home':
    default:
      return <MinesHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface MinesweeperRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function MinesweeperRoot({ onExit, kv = preferencesKV }: MinesweeperRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        prefs: prefsSchema.defaultValue(),
        sessions: { difficulty: null, daily: null },
      };
      try {
        const [stats, flags, prefs, sessions] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(prefsSchema, kv),
          loadSavedGames(kv),
        ]);
        loaded = { stats, flags, prefs, sessions };
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
    <MinesweeperProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
    >
      <MinesweeperScreens />
    </MinesweeperProvider>
  );
}
