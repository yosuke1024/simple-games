/**
 * Checkers' root: loads the game's own records (local, fast, offline), then
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
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import type { CheckersSession } from '../game';
import { CheckersProvider, useCheckers } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './checkers.css';
import { CheckersGameScreen } from './screens/GameScreen';
import { CheckersHomeScreen } from './screens/HomeScreen';
import { CheckersStatsScreen } from './screens/StatsScreen';
import { CheckersTutorialScreen } from './screens/TutorialScreen';

export function CheckersScreens() {
  const { screen } = useCheckers();
  switch (screen) {
    case 'tutorial':
      return <CheckersTutorialScreen />;
    case 'game':
      return <CheckersGameScreen />;
    case 'stats':
      return <CheckersStatsScreen />;
    case 'home':
    default:
      return <CheckersHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: CheckersSession | null;
}

export interface CheckersRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Handed straight on: what a door means is this game's own answer,
   * and it is taken from the records loaded below.
   */
  entry?: 'collection' | 'shortcut';
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
    session: null,
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, prefs, session] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGame(kv),
  ]);
  return { stats, flags, prefs, session };
}

export function CheckersRoot({ onExit, entry, kv = preferencesKV }: CheckersRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <CheckersProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <CheckersScreens />
    </CheckersProvider>
  );
}
