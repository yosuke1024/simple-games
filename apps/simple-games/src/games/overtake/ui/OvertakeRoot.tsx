/**
 * Overtake's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work — the loop, the listeners, the observers (docs/GAME_LIFECYCLE.md,
 * OvertakeRoot.leak.test.tsx).
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
import { OvertakeProvider, useOvertake } from '../state/GameContext';
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
import './overtake.css';
import { OvertakeGameScreen } from './screens/GameScreen';
import { OvertakeHomeScreen } from './screens/HomeScreen';
import { OvertakeLevelSelectScreen } from './screens/LevelSelectScreen';
import { OvertakeStatsScreen } from './screens/StatsScreen';
import { OvertakeTutorialScreen } from './screens/TutorialScreen';

export function OvertakeScreens() {
  const { screen } = useOvertake();
  switch (screen) {
    case 'tutorial':
      return <OvertakeTutorialScreen />;
    case 'levels':
      return <OvertakeLevelSelectScreen />;
    case 'game':
      return <OvertakeGameScreen />;
    case 'stats':
      return <OvertakeStatsScreen />;
    case 'home':
    default:
      return <OvertakeHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  prefs: Prefs;
}

/**
 * What the shell hands a root (app/registry.ts `GameRootProps`). No `entry`
 * prop, deliberately: there is no saved race for a home-screen shortcut to
 * open onto (docs/OVERTAKE_RULES.md §9), and src/test/shortcutResumeWiring.test.ts
 * holds a save-less game to that (issue #113).
 */
export interface OvertakeRootProps {
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
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, progress, prefs] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(progressSchema, kv),
    loadRecord(prefsSchema, kv),
  ]);
  return { stats, flags, progress, prefs };
}

export function OvertakeRoot({ onExit, kv = preferencesKV }: OvertakeRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <OvertakeProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialPrefs={data.prefs}
      onExit={onExit}
    >
      <OvertakeScreens />
    </OvertakeProvider>
  );
}
