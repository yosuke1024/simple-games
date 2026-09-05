/**
 * Gin Rummy's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work —
 * including a CPU beat still on its timer (battery: an off-screen game renders
 * nothing and thinks nothing).
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
import type { GinRummySession } from '../game';
import { GinRummyProvider, useGinRummy } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './gin-rummy.css';
import { GinRummyGameScreen } from './screens/GameScreen';
import { GinRummyHomeScreen } from './screens/HomeScreen';
import { GinRummyStatsScreen } from './screens/StatsScreen';
import { GinRummyTutorialScreen } from './screens/TutorialScreen';

export function GinRummyScreens() {
  const { screen } = useGinRummy();
  switch (screen) {
    case 'tutorial':
      return <GinRummyTutorialScreen />;
    case 'game':
      return <GinRummyGameScreen />;
    case 'stats':
      return <GinRummyStatsScreen />;
    case 'home':
    default:
      return <GinRummyHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: GinRummySession | null;
}

export interface GinRummyRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
    session: null,
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, prefs, session] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGame(kv),
  ]);
  return { stats, flags, prefs, session };
}

export function GinRummyRoot({ onExit, kv = preferencesKV }: GinRummyRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <GinRummyProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
    >
      <GinRummyScreens />
    </GinRummyProvider>
  );
}
