/**
 * Number Recall's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * There is no saved round to load — only progress, statistics and flags (§12).
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { RecallProvider, useRecall } from '../state/GameContext';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { RecallDailyScreen } from './screens/DailyScreen';
import { RecallGameScreen } from './screens/GameScreen';
import { RecallHomeScreen } from './screens/HomeScreen';
import { RecallLevelSelectScreen } from './screens/LevelSelectScreen';
import { RecallStatsScreen } from './screens/StatsScreen';
import { RecallTutorialScreen } from './screens/TutorialScreen';
import './number-recall.css';

export function NumberRecallScreens() {
  const { screen } = useRecall();
  switch (screen) {
    case 'tutorial':
      return <RecallTutorialScreen />;
    case 'levels':
      return <RecallLevelSelectScreen />;
    case 'daily':
      return <RecallDailyScreen />;
    case 'game':
      return <RecallGameScreen />;
    case 'stats':
      return <RecallStatsScreen />;
    case 'home':
    default:
      return <RecallHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
}

export interface NumberRecallRootProps {
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

export function NumberRecallRoot({ onExit, kv = preferencesKV }: NumberRecallRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <RecallProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      onExit={onExit}
    >
      <NumberRecallScreens />
    </RecallProvider>
  );
}
