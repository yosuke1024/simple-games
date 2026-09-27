/**
 * Yacht's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work.
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
import type { YachtSession } from '../game';
import { YachtProvider, useYacht } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './yacht.css';
import { YachtGameScreen } from './screens/GameScreen';
import { YachtHomeScreen } from './screens/HomeScreen';
import { YachtStatsScreen } from './screens/StatsScreen';
import { YachtTutorialScreen } from './screens/TutorialScreen';

export function YachtScreens() {
  const { screen } = useYacht();
  switch (screen) {
    case 'tutorial':
      return <YachtTutorialScreen />;
    case 'game':
      return <YachtGameScreen />;
    case 'stats':
      return <YachtStatsScreen />;
    case 'home':
    default:
      return <YachtHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  session: YachtSession | null;
}

export interface YachtRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). A fact about the launch, not an instruction: what it means is the
   * provider's answer, taken against the one saved sheet loaded below (§8).
   */
  entry?: 'collection' | 'shortcut';
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return { stats: statsSchema.defaultValue(), flags: flagsSchema.defaultValue(), session: null };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, session] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadSavedGame(kv),
  ]);
  return { stats, flags, session };
}

export function YachtRoot({ onExit, entry, kv = preferencesKV }: YachtRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <YachtProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <YachtScreens />
    </YachtProvider>
  );
}
