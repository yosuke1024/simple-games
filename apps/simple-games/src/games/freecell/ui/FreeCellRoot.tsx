/**
 * FreeCell's root: loads the game's own records (local, fast, offline), then
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
import { FreeCellProvider, useFreeCell } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './freecell.css';
import { FreeCellDailyScreen } from './screens/DailyScreen';
import { FreeCellGameScreen } from './screens/GameScreen';
import { FreeCellHomeScreen } from './screens/HomeScreen';
import { FreeCellStatsScreen } from './screens/StatsScreen';
import { FreeCellTutorialScreen } from './screens/TutorialScreen';

export function FreeCellScreens() {
  const { screen } = useFreeCell();
  switch (screen) {
    case 'tutorial':
      return <FreeCellTutorialScreen />;
    case 'daily':
      return <FreeCellDailyScreen />;
    case 'game':
      return <FreeCellGameScreen />;
    case 'stats':
      return <FreeCellStatsScreen />;
    case 'home':
    default:
      return <FreeCellHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  sessions: SavedGames;
}

export interface FreeCellRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Passed straight through: what a door means is FreeCell's own
   * answer, taken once from the records loaded below.
   */
  entry?: 'collection' | 'shortcut';
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function FreeCellRoot({ onExit, entry, kv = preferencesKV }: FreeCellRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        sessions: { free: null, daily: null },
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
    <FreeCellProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <FreeCellScreens />
    </FreeCellProvider>
  );
}
