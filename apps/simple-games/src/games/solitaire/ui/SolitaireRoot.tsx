/**
 * Solitaire's root: loads the game's own records (local, fast, offline),
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
import { SolitaireProvider, useSolitaire } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './solitaire.css';
import { SolitaireDailyScreen } from './screens/DailyScreen';
import { SolitaireGameScreen } from './screens/GameScreen';
import { SolitaireHomeScreen } from './screens/HomeScreen';
import { SolitaireStatsScreen } from './screens/StatsScreen';
import { SolitaireTutorialScreen } from './screens/TutorialScreen';

export function SolitaireScreens() {
  const { screen } = useSolitaire();
  switch (screen) {
    case 'tutorial':
      return <SolitaireTutorialScreen />;
    case 'daily':
      return <SolitaireDailyScreen />;
    case 'game':
      return <SolitaireGameScreen />;
    case 'stats':
      return <SolitaireStatsScreen />;
    case 'home':
    default:
      return <SolitaireHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
}

export interface SolitaireRootProps {
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

export function SolitaireRoot({ onExit, entry, kv = preferencesKV }: SolitaireRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <SolitaireProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <SolitaireScreens />
    </SolitaireProvider>
  );
}
