/**
 * Reversi's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work —
 * including a CPU reply still on its timer (battery: an off-screen game
 * renders nothing and thinks nothing).
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
import type { ReversiSession } from '../game';
import { ReversiProvider, useReversi } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './reversi.css';
import { ReversiGameScreen } from './screens/GameScreen';
import { ReversiHomeScreen } from './screens/HomeScreen';
import { ReversiStatsScreen } from './screens/StatsScreen';
import { ReversiTutorialScreen } from './screens/TutorialScreen';

export function ReversiScreens() {
  const { screen } = useReversi();
  switch (screen) {
    case 'tutorial':
      return <ReversiTutorialScreen />;
    case 'game':
      return <ReversiGameScreen />;
    case 'stats':
      return <ReversiStatsScreen />;
    case 'home':
    default:
      return <ReversiHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: ReversiSession | null;
}

export interface ReversiRootProps {
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

export function ReversiRoot({ onExit, entry, kv = preferencesKV }: ReversiRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        prefs: prefsSchema.defaultValue(),
        session: null,
      };
      try {
        const [stats, flags, prefs, session] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(prefsSchema, kv),
          loadSavedGame(kv),
        ]);
        loaded = { stats, flags, prefs, session };
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
    <ReversiProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <ReversiScreens />
    </ReversiProvider>
  );
}
