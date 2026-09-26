/**
 * Dots and Boxes's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work —
 * including a CPU line still on its timer (battery: an off-screen game
 * renders nothing and thinks nothing).
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
import type { DotsAndBoxesSession } from '../game';
import { DotsAndBoxesProvider, useDotsAndBoxes } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './dots-and-boxes.css';
import { DotsAndBoxesGameScreen } from './screens/GameScreen';
import { DotsAndBoxesHomeScreen } from './screens/HomeScreen';
import { DotsAndBoxesStatsScreen } from './screens/StatsScreen';
import { DotsAndBoxesTutorialScreen } from './screens/TutorialScreen';

export function DotsAndBoxesScreens() {
  const { screen } = useDotsAndBoxes();
  switch (screen) {
    case 'tutorial':
      return <DotsAndBoxesTutorialScreen />;
    case 'game':
      return <DotsAndBoxesGameScreen />;
    case 'stats':
      return <DotsAndBoxesStatsScreen />;
    case 'home':
    default:
      return <DotsAndBoxesHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: DotsAndBoxesSession | null;
}

export interface DotsAndBoxesRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). A fact about the launch, not an instruction: what it means is the
   * provider's answer, taken against the one saved match loaded below (§8).
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

export function DotsAndBoxesRoot({ onExit, entry, kv = preferencesKV }: DotsAndBoxesRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <DotsAndBoxesProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <DotsAndBoxesScreens />
    </DotsAndBoxesProvider>
  );
}
