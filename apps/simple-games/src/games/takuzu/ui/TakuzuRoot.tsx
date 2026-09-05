/**
 * Takuzu's root: loads the game's own records (local, fast, offline), then
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
import { TakuzuProvider, useTakuzu } from '../state/GameContext';
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
import './takuzu.css';
import { TakuzuDailyScreen } from './screens/DailyScreen';
import { TakuzuGameScreen } from './screens/GameScreen';
import { TakuzuHomeScreen } from './screens/HomeScreen';
import { TakuzuLevelSelectScreen } from './screens/LevelSelectScreen';
import { TakuzuStatsScreen } from './screens/StatsScreen';
import { TakuzuTutorialScreen } from './screens/TutorialScreen';

export function TakuzuScreens() {
  const { screen } = useTakuzu();
  switch (screen) {
    case 'tutorial':
      return <TakuzuTutorialScreen />;
    case 'levels':
      return <TakuzuLevelSelectScreen />;
    case 'daily':
      return <TakuzuDailyScreen />;
    case 'game':
      return <TakuzuGameScreen />;
    case 'stats':
      return <TakuzuStatsScreen />;
    case 'home':
    default:
      return <TakuzuHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface TakuzuRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
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

export function TakuzuRoot({ onExit, kv = preferencesKV }: TakuzuRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <TakuzuProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      prefs={data.prefs}
      onExit={onExit}
    >
      <TakuzuScreens />
    </TakuzuProvider>
  );
}
