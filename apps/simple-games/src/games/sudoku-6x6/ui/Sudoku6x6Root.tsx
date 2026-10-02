/**
 * Sudoku 6×6's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and routes its screens. The shell knows nothing
 * beyond this component and the storage keys; unmounting stops all of the
 * game's work (docs/GAME_LIFECYCLE.md).
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
 */
// Register this game's 14-locale catalog the moment the chunk loads, before
// anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { Sudoku6x6Provider, useSudoku6x6 } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './sudoku-6x6.css';
import { Sudoku6x6GameScreen } from './screens/GameScreen';
import { Sudoku6x6HomeScreen } from './screens/HomeScreen';
import { Sudoku6x6StatsScreen } from './screens/StatsScreen';
import { Sudoku6x6TutorialScreen } from './screens/TutorialScreen';

export function Sudoku6x6Screens() {
  const { screen } = useSudoku6x6();
  switch (screen) {
    case 'tutorial':
      return <Sudoku6x6TutorialScreen />;
    case 'game':
      return <Sudoku6x6GameScreen />;
    case 'stats':
      return <Sudoku6x6StatsScreen />;
    case 'home':
    default:
      return <Sudoku6x6HomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface Sudoku6x6RootProps {
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

export function Sudoku6x6Root({ onExit, entry, kv = preferencesKV }: Sudoku6x6RootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <Sudoku6x6Provider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <Sudoku6x6Screens />
    </Sudoku6x6Provider>
  );
}
