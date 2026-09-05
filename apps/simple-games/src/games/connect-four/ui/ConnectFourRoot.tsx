/**
 * Connect Four's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work —
 * including a CPU reply still on its timer (battery: an off-screen game
 * renders nothing and thinks nothing).
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
import type { ConnectFourSession } from '../game';
import { ConnectFourProvider, useConnectFour } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './connect-four.css';
import { ConnectFourGameScreen } from './screens/GameScreen';
import { ConnectFourHomeScreen } from './screens/HomeScreen';
import { ConnectFourStatsScreen } from './screens/StatsScreen';
import { ConnectFourTutorialScreen } from './screens/TutorialScreen';

export function ConnectFourScreens() {
  const { screen } = useConnectFour();
  switch (screen) {
    case 'tutorial':
      return <ConnectFourTutorialScreen />;
    case 'game':
      return <ConnectFourGameScreen />;
    case 'stats':
      return <ConnectFourStatsScreen />;
    case 'home':
    default:
      return <ConnectFourHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: ConnectFourSession | null;
}

export interface ConnectFourRootProps {
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

export function ConnectFourRoot({ onExit, kv = preferencesKV }: ConnectFourRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <ConnectFourProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
    >
      <ConnectFourScreens />
    </ConnectFourProvider>
  );
}
