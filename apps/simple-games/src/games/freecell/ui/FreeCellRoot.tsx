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
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
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
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    sessions: { free: null, daily: null },
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, sessions] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadSavedGames(kv),
  ]);
  return { stats, flags, sessions };
}

export function FreeCellRoot({ onExit, kv = preferencesKV }: FreeCellRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <FreeCellProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSessions={data.sessions}
      onExit={onExit}
    >
      <FreeCellScreens />
    </FreeCellProvider>
  );
}
