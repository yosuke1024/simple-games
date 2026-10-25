/**
 * Scopa's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work — a beat still on its timer included (docs/GAME_LIFECYCLE.md).
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
 */
// Register this game's 14-locale catalog the moment the chunk loads, before
// anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import type { PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import type { ScopaSession } from '../game';
import { ScopaProvider, useScopa } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './scopa.css';
import { ScopaGameScreen } from './screens/GameScreen';
import { ScopaHomeScreen } from './screens/HomeScreen';
import { ScopaStatsScreen } from './screens/StatsScreen';
import { ScopaTutorialScreen } from './screens/TutorialScreen';

export function ScopaScreens(props: PlayTogetherProps) {
  const { screen } = useScopa();
  switch (screen) {
    case 'tutorial':
      return <ScopaTutorialScreen />;
    case 'game':
      return <ScopaGameScreen />;
    case 'stats':
      return <ScopaStatsScreen />;
    case 'home':
    default:
      return <ScopaHomeScreen {...props} />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  session: ScopaSession | null;
}

export interface ScopaRootProps extends PlayTogetherProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). A fact, not an instruction: what a door means is the provider's
   * answer, taken once from the records loaded below.
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

export function ScopaRoot({
  onExit,
  entry,
  kv = preferencesKV,
  onPlayTogether,
  playTogetherActive,
}: ScopaRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <ScopaProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <ScopaScreens onPlayTogether={onPlayTogether} playTogetherActive={playTogetherActive} />
    </ScopaProvider>
  );
}
