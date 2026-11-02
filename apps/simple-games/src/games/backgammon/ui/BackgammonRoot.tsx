/**
 * Backgammon's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work (docs/GAME_LIFECYCLE.md).
 *
 * The saved match is replayed by the loader (storage/gamePersistence.ts), so
 * a record the rules cannot accept never reaches the screen: the home simply
 * has nothing to resume.
 */
// Register this game's 14-locale catalog the moment the chunk loads, before
// anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import type { BackgammonSession } from '../game/session';
import { BackgammonProvider, useBackgammon } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './backgammon.css';
import { BackgammonGameScreen } from './screens/GameScreen';
import { BackgammonHomeScreen } from './screens/HomeScreen';
import { BackgammonStatsScreen } from './screens/StatsScreen';
import { BackgammonTutorialScreen } from './screens/TutorialScreen';

export function BackgammonScreens() {
  const { screen } = useBackgammon();
  switch (screen) {
    case 'tutorial':
      return <BackgammonTutorialScreen />;
    case 'game':
      return <BackgammonGameScreen />;
    case 'stats':
      return <BackgammonStatsScreen />;
    case 'home':
    default:
      return <BackgammonHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: BackgammonSession | null;
}

/** What the shell hands a root (app/registry.ts `GameRootProps`). */
export interface BackgammonRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Which door this launch came through (issue #113). Absent means the ordinary one. */
  entry?: 'collection' | 'shortcut';
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

export function BackgammonRoot({ onExit, entry, kv = preferencesKV }: BackgammonRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <BackgammonProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <BackgammonScreens />
    </BackgammonProvider>
  );
}
