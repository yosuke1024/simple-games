/**
 * 2048's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
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
import type { Game2048Session } from '../game';
import { Game2048Provider, useGame2048 } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './game-2048.css';
import { Game2048GameScreen } from './screens/GameScreen';
import { Game2048HomeScreen } from './screens/HomeScreen';
import { Game2048StatsScreen } from './screens/StatsScreen';
import { Game2048TutorialScreen } from './screens/TutorialScreen';

export function Game2048Screens() {
  const { screen } = useGame2048();
  switch (screen) {
    case 'tutorial':
      return <Game2048TutorialScreen />;
    case 'game':
      return <Game2048GameScreen />;
    case 'stats':
      return <Game2048StatsScreen />;
    case 'home':
    default:
      return <Game2048HomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  session: Game2048Session | null;
}

export interface Game2048RootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    session: null,
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, session] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadSavedGame(kv),
  ]);
  return { stats, flags, session };
}

export function Game2048Root({ onExit, kv = preferencesKV }: Game2048RootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <Game2048Provider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      onExit={onExit}
    >
      <Game2048Screens />
    </Game2048Provider>
  );
}
