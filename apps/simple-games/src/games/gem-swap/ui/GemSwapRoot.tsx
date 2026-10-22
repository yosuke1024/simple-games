/**
 * Gem Swap's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work — the play clock, a replay in progress, the listeners
 * (docs/GAME_LIFECYCLE.md).
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
import type { GemSwapSession } from '../game';
import { GemSwapProvider, useGemSwap } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './gem-swap.css';
import { GemSwapGameScreen } from './screens/GameScreen';
import { GemSwapHomeScreen } from './screens/HomeScreen';
import { GemSwapTutorialScreen } from './screens/TutorialScreen';

export function GemSwapScreens() {
  const { screen } = useGemSwap();
  switch (screen) {
    case 'tutorial':
      return <GemSwapTutorialScreen />;
    case 'game':
      return <GemSwapGameScreen />;
    case 'home':
    default:
      return <GemSwapHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  /** The suspended round, already through the rules' replay — or null (§7). */
  session: GemSwapSession | null;
}

export interface GemSwapRootProps {
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

export function GemSwapRoot({ onExit, entry, kv = preferencesKV }: GemSwapRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <GemSwapProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <GemSwapScreens />
    </GemSwapProvider>
  );
}
