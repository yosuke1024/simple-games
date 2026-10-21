/**
 * Tangram's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work (docs/GAME_LIFECYCLE.md).
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
import { TangramProvider, useTangram } from '../state/GameContext';
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
import './tangram.css';
import { TangramGameScreen } from './screens/GameScreen';
import { TangramHomeScreen } from './screens/HomeScreen';
import { TangramStatsScreen } from './screens/StatsScreen';
import { TangramTutorialScreen } from './screens/TutorialScreen';

export function TangramScreens() {
  const { screen } = useTangram();
  switch (screen) {
    case 'tutorial':
      return <TangramTutorialScreen />;
    case 'game':
      return <TangramGameScreen />;
    case 'stats':
      return <TangramStatsScreen />;
    case 'home':
    default:
      return <TangramHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  progress: Progress;
  sessions: SavedGames;
}

export interface TangramRootProps {
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
    progress: progressSchema.defaultValue(),
    sessions: { free: null, daily: null },
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, prefs, progress, sessions] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
    loadRecord(progressSchema, kv),
    loadSavedGames(kv),
  ]);
  return { stats, flags, prefs, progress, sessions };
}

export function TangramRoot({ onExit, entry, kv = preferencesKV }: TangramRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <TangramProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <TangramScreens />
    </TangramProvider>
  );
}
