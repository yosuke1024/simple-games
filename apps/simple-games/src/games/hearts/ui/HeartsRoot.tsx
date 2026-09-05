/**
 * Hearts' root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work —
 * including the next beat of the table, still on its timer (battery: an
 * off-screen game renders nothing and thinks nothing).
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
import type { HeartsSession } from '../game';
import { HeartsProvider, useHearts } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './hearts.css';
import { HeartsGameScreen } from './screens/GameScreen';
import { HeartsHomeScreen } from './screens/HomeScreen';
import { HeartsStatsScreen } from './screens/StatsScreen';
import { HeartsTutorialScreen } from './screens/TutorialScreen';

export function HeartsScreens() {
  const { screen } = useHearts();
  switch (screen) {
    case 'tutorial':
      return <HeartsTutorialScreen />;
    case 'game':
      return <HeartsGameScreen />;
    case 'stats':
      return <HeartsStatsScreen />;
    case 'home':
    default:
      return <HeartsHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: HeartsSession | null;
}

export interface HeartsRootProps {
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

export function HeartsRoot({ onExit, kv = preferencesKV }: HeartsRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <HeartsProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
    >
      <HeartsScreens />
    </HeartsProvider>
  );
}
