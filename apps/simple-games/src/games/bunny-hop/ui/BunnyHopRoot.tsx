/**
 * Bunny Hop's root: loads the game's own records (local, fast, offline), then
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
import { useEffect, useState } from 'react';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { BunnyProvider, useBunnyHop } from '../state/GameContext';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './bunny-hop.css';
import { BunnyGameScreen } from './screens/GameScreen';
import { BunnyHomeScreen } from './screens/HomeScreen';
import { BunnyStatsScreen } from './screens/StatsScreen';
import { BunnyTutorialScreen } from './screens/TutorialScreen';

export function BunnyScreens() {
  const { screen } = useBunnyHop();
  switch (screen) {
    case 'tutorial':
      return <BunnyTutorialScreen />;
    case 'game':
      return <BunnyGameScreen />;
    case 'stats':
      return <BunnyStatsScreen />;
    case 'home':
    default:
      return <BunnyHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
}

export interface BunnyHopRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function BunnyHopRoot({ onExit, kv = preferencesKV }: BunnyHopRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
      };
      try {
        const [stats, flags] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
        ]);
        loaded = { stats, flags };
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
    <BunnyProvider initialStats={data.stats} initialFlags={data.flags} onExit={onExit}>
      <BunnyScreens />
    </BunnyProvider>
  );
}
