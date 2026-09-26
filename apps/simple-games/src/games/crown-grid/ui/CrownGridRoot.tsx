/**
 * Crown Grid's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * The game's stylesheet is imported here rather than added to the shared one,
 * so everything Crown Grid looks like arrives and leaves with Crown Grid.
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { CrownGridProvider, useCrownGrid } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './crown-grid.css';
import { CrownGridDailyScreen } from './screens/DailyScreen';
import { CrownGridGameScreen } from './screens/GameScreen';
import { CrownGridHomeScreen } from './screens/HomeScreen';
import { CrownGridStatsScreen } from './screens/StatsScreen';
import { CrownGridTutorialScreen } from './screens/TutorialScreen';

export function CrownGridScreens() {
  const { screen } = useCrownGrid();
  switch (screen) {
    case 'tutorial':
      return <CrownGridTutorialScreen />;
    case 'daily':
      return <CrownGridDailyScreen />;
    case 'game':
      return <CrownGridGameScreen />;
    case 'stats':
      return <CrownGridStatsScreen />;
    case 'home':
    default:
      return <CrownGridHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface CrownGridRootProps {
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

export function CrownGridRoot({ onExit, entry, kv = preferencesKV }: CrownGridRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <CrownGridProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <CrownGridScreens />
    </CrownGridProvider>
  );
}
