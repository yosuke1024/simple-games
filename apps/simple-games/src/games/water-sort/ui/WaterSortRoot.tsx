/**
 * Water Sort's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
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
import { useWaterSort, WaterProvider } from '../state/GameContext';
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
import './water-sort.css';
import { WaterDailyScreen } from './screens/DailyScreen';
import { WaterGameScreen } from './screens/GameScreen';
import { WaterHomeScreen } from './screens/HomeScreen';
import { WaterLevelSelectScreen } from './screens/LevelSelectScreen';
import { WaterStatsScreen } from './screens/StatsScreen';
import { WaterTutorialScreen } from './screens/TutorialScreen';

export function WaterScreens() {
  const { screen } = useWaterSort();
  switch (screen) {
    case 'tutorial':
      return <WaterTutorialScreen />;
    case 'levels':
      return <WaterLevelSelectScreen />;
    case 'daily':
      return <WaterDailyScreen />;
    case 'game':
      return <WaterGameScreen />;
    case 'stats':
      return <WaterStatsScreen />;
    case 'home':
    default:
      return <WaterHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface WaterSortRootProps {
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
    progress: progressSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
    sessions: { level: null, daily: null, free: null },
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, progress, prefs, sessions] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(progressSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGames(kv),
  ]);
  return { stats, flags, progress, prefs, sessions };
}

export function WaterSortRoot({ onExit, entry, kv = preferencesKV }: WaterSortRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <WaterProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <WaterScreens />
    </WaterProvider>
  );
}
