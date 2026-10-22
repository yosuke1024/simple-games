/**
 * Echo Pads's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work — the playback chain, the press light, the play clock and every
 * listener (docs/GAME_LIFECYCLE.md, ./EchoPadsRoot.leak.test.tsx).
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
import { EchoPadsProvider, useEchoPads } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Progress,
  type Stats,
} from '../storage/schemas';
import './echo-pads.css';
import { EchoPadsGameScreen } from './screens/GameScreen';
import { EchoPadsHomeScreen } from './screens/HomeScreen';
import { EchoPadsLevelsScreen } from './screens/LevelsScreen';
import { EchoPadsStatsScreen } from './screens/StatsScreen';
import { EchoPadsTutorialScreen } from './screens/TutorialScreen';

export function EchoPadsScreens() {
  const { screen } = useEchoPads();
  switch (screen) {
    case 'tutorial':
      return <EchoPadsTutorialScreen />;
    case 'game':
      return <EchoPadsGameScreen />;
    case 'levels':
      return <EchoPadsLevelsScreen />;
    case 'stats':
      return <EchoPadsStatsScreen />;
    case 'home':
    default:
      return <EchoPadsHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  progress: Progress;
  sessions: SavedGames;
}

export interface EchoPadsRootProps {
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
    progress: progressSchema.defaultValue(),
    sessions: { level: null, daily: null },
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, prefs, progress] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
    loadRecord(progressSchema, kv),
  ]);
  // The saved runs are checked against the progress record (§9): an attempt
  // never handed out, or a level not open, reads as an empty slot.
  const sessions = await loadSavedGames(progress, kv);
  return { stats, flags, prefs, progress, sessions };
}

export function EchoPadsRoot({ onExit, entry, kv = preferencesKV }: EchoPadsRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <EchoPadsProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
    >
      <EchoPadsScreens />
    </EchoPadsProvider>
  );
}
