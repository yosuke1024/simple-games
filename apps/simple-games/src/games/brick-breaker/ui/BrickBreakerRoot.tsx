/**
 * Brick Breaker's root: loads the game's own records (local, fast, offline),
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
import { BrickProvider, useBrickBreaker } from '../state/GameContext';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import './brick-breaker.css';
import { BrickGameScreen } from './screens/GameScreen';
import { BrickHomeScreen } from './screens/HomeScreen';
import { BrickLevelSelectScreen } from './screens/LevelSelectScreen';
import { BrickStatsScreen } from './screens/StatsScreen';
import { BrickTutorialScreen } from './screens/TutorialScreen';

export function BrickScreens() {
  const { screen } = useBrickBreaker();
  switch (screen) {
    case 'tutorial':
      return <BrickTutorialScreen />;
    case 'levels':
      return <BrickLevelSelectScreen />;
    case 'game':
      return <BrickGameScreen />;
    case 'stats':
      return <BrickStatsScreen />;
    case 'home':
    default:
      return <BrickHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
}

export interface BrickBreakerRootProps {
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
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, progress] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(progressSchema, kv),
  ]);
  return { stats, flags, progress };
}

export function BrickBreakerRoot({ onExit, kv = preferencesKV }: BrickBreakerRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <BrickProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      onExit={onExit}
    >
      <BrickScreens />
    </BrickProvider>
  );
}
