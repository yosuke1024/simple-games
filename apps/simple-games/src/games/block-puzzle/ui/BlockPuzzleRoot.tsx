/**
 * Block Puzzle's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import { useEffect, useState } from 'react';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import type { BlockSession } from '../game';
import { BlockProvider, useBlockPuzzle } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './block-puzzle.css';
import { BlockGameScreen } from './screens/GameScreen';
import { BlockHomeScreen } from './screens/HomeScreen';
import { BlockStatsScreen } from './screens/StatsScreen';
import { BlockTutorialScreen } from './screens/TutorialScreen';

export function BlockScreens() {
  const { screen } = useBlockPuzzle();
  switch (screen) {
    case 'tutorial':
      return <BlockTutorialScreen />;
    case 'game':
      return <BlockGameScreen />;
    case 'stats':
      return <BlockStatsScreen />;
    case 'home':
    default:
      return <BlockHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  session: BlockSession | null;
}

export interface BlockPuzzleRootProps {
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

export function BlockPuzzleRoot({ onExit, entry, kv = preferencesKV }: BlockPuzzleRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        session: null,
      };
      try {
        const [stats, flags, session] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadSavedGame(kv),
        ]);
        loaded = { stats, flags, session };
      } catch {
        // Even unexpected load failures must not prevent playing: defaults.
      }
      if (!cancelled) setData(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [kv]);

  // Local reads resolve in milliseconds; a spinner here would only flash.
  if (data === null) return null;

  return (
    <BlockProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <BlockScreens />
    </BlockProvider>
  );
}
