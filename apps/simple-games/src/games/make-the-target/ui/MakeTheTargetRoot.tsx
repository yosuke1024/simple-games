/**
 * Make the Target's root: loads the game's own records (local, fast,
 * offline), then mounts the provider and screens. The shell knows nothing
 * beyond this component and the storage keys; unmounting stops all of the
 * game's work (docs/GAME_LIFECYCLE.md — an off-screen game renders nothing).
 *
 * The saved problems are checked as they load, by replaying them through the
 * rules (storage/gamePersistence.ts, docs/MAKE_THE_TARGET_RULES.md §10);
 * nothing searches on the way in (§6).
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
import { MakeTheTargetProvider, useMakeTheTarget } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './make-the-target.css';
import { MakeTheTargetGameScreen } from './screens/GameScreen';
import { MakeTheTargetHomeScreen } from './screens/HomeScreen';
import { MakeTheTargetStatsScreen } from './screens/StatsScreen';
import { MakeTheTargetTutorialScreen } from './screens/TutorialScreen';

export function MakeTheTargetScreens() {
  const { screen } = useMakeTheTarget();
  switch (screen) {
    case 'tutorial':
      return <MakeTheTargetTutorialScreen />;
    case 'game':
      return <MakeTheTargetGameScreen />;
    case 'stats':
      return <MakeTheTargetStatsScreen />;
    case 'home':
    default:
      return <MakeTheTargetHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface MakeTheTargetRootProps {
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
    sessions: { free: null, daily: null },
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

export function MakeTheTargetRoot({ onExit, entry, kv = preferencesKV }: MakeTheTargetRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <MakeTheTargetProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <MakeTheTargetScreens />
    </MakeTheTargetProvider>
  );
}
