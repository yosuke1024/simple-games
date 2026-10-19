/**
 * Bridges' root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (docs/GAME_LIFECYCLE.md — an off-screen game renders nothing).
 *
 * Loading the two saved boards is the one place a suspended game is re-proved
 * (`fromRecord`'s bounded search, docs/BRIDGES_RULES.md §6, §10): it runs here
 * because the player opened the game, and nowhere else.
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
import { BridgesProvider, useBridges } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './bridges.css';
import { BridgesGameScreen } from './screens/GameScreen';
import { BridgesHomeScreen } from './screens/HomeScreen';
import { BridgesStatsScreen } from './screens/StatsScreen';
import { BridgesTutorialScreen } from './screens/TutorialScreen';

export function BridgesScreens() {
  const { screen } = useBridges();
  switch (screen) {
    case 'tutorial':
      return <BridgesTutorialScreen />;
    case 'game':
      return <BridgesGameScreen />;
    case 'stats':
      return <BridgesStatsScreen />;
    case 'home':
    default:
      return <BridgesHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface BridgesRootProps {
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

function defaultRecords(): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
    sessions: { difficulty: null, daily: null },
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, prefs, sessions] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGames(kv),
  ]);
  return { stats, flags, prefs, sessions };
}

export function BridgesRoot({ onExit, entry, kv = preferencesKV }: BridgesRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <BridgesProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <BridgesScreens />
    </BridgesProvider>
  );
}
