import type { PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
/**
 * Nested Tic-Tac-Toe's root: loads the game's own records (local, fast,
 * offline), then mounts the provider and routes its screens. The shell knows
 * nothing beyond this component and the storage keys; unmounting stops all of
 * the game's work — including a CPU reply still on its timer and the result
 * card's beat (docs/GAME_LIFECYCLE.md).
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
import type { NestedSession } from '../game';
import { NestedTicTacToeProvider, useNestedTicTacToe } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './nested-tic-tac-toe.css';
import { NestedTicTacToeGameScreen } from './screens/GameScreen';
import { NestedTicTacToeHomeScreen } from './screens/HomeScreen';
import { NestedTicTacToeStatsScreen } from './screens/StatsScreen';
import { NestedTicTacToeTutorialScreen } from './screens/TutorialScreen';

export function NestedTicTacToeScreens(together: PlayTogetherProps = {}) {
  const { screen } = useNestedTicTacToe();
  switch (screen) {
    case 'tutorial':
      return <NestedTicTacToeTutorialScreen />;
    case 'game':
      return <NestedTicTacToeGameScreen />;
    case 'stats':
      return <NestedTicTacToeStatsScreen />;
    case 'home':
    default:
      return <NestedTicTacToeHomeScreen {...together} />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: NestedSession | null;
}

export interface NestedTicTacToeRootProps extends PlayTogetherProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Passed straight through: what a door means is the provider's
   * answer, taken once from the records loaded below (§8.3).
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

export function NestedTicTacToeRoot({
  onExit,
  entry,
  onPlayTogether,
  playTogetherActive,
  kv = preferencesKV,
}: NestedTicTacToeRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <NestedTicTacToeProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <NestedTicTacToeScreens
        onPlayTogether={onPlayTogether}
        playTogetherActive={playTogetherActive}
      />
    </NestedTicTacToeProvider>
  );
}
