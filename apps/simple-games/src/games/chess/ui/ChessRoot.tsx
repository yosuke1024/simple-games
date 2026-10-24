/**
 * Chess's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work — including a CPU reply still on its timer (docs/GAME_LIFECYCLE.md).
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
import type { ChessSession } from '../game';
import { ChessProvider, useChess } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './chess.css';
import { ChessGameScreen } from './screens/GameScreen';
import { ChessHomeScreen } from './screens/HomeScreen';
import { ChessStatsScreen } from './screens/StatsScreen';
import { ChessTutorialScreen } from './screens/TutorialScreen';

export function ChessScreens() {
  const { screen } = useChess();
  switch (screen) {
    case 'tutorial':
      return <ChessTutorialScreen />;
    case 'game':
      return <ChessGameScreen />;
    case 'stats':
      return <ChessStatsScreen />;
    case 'home':
    default:
      return <ChessHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: ChessSession | null;
}

export interface ChessRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Handed straight on: what a door means is this game's own answer,
   * and it is taken from the records loaded below.
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

export function ChessRoot({ onExit, entry, kv = preferencesKV }: ChessRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <ChessProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <ChessScreens />
    </ChessProvider>
  );
}
