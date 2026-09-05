/**
 * Ludo's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work —
 * including the next beat of the board, still on its timer (battery: an
 * off-screen game renders nothing and thinks nothing).
 *
 * The saved match arrives already replayed and already canonical, or not at
 * all: `loadSavedGame` fails closed, so a record play could not have produced
 * is dropped and the player lands on the home screen with no match to resume
 * (docs/LUDO_RULES.md §10.3).
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
import type { LudoSession } from '../game';
import { LudoProvider, useLudo } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './ludo.css';
import { LudoGameScreen } from './screens/GameScreen';
import { LudoHomeScreen } from './screens/HomeScreen';
import { LudoStatsScreen } from './screens/StatsScreen';
import { LudoTutorialScreen } from './screens/TutorialScreen';

export function LudoScreens() {
  const { screen } = useLudo();
  switch (screen) {
    case 'tutorial':
      return <LudoTutorialScreen />;
    case 'game':
      return <LudoGameScreen />;
    case 'stats':
      return <LudoStatsScreen />;
    case 'home':
    default:
      return <LudoHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  session: LudoSession | null;
}

export interface LudoRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Passed straight through: a door is a fact, and what it means here
   * is the provider's answer, taken once from the record loaded below.
   */
  entry?: 'collection' | 'shortcut';
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

export function LudoRoot({ onExit, entry, kv = preferencesKV }: LudoRootProps) {
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: LoadedData = {
        stats: statsSchema.defaultValue(),
        flags: flagsSchema.defaultValue(),
        prefs: prefsSchema.defaultValue(),
        session: null,
      };
      try {
        const [stats, flags, prefs, session] = await Promise.all([
          loadRecord(statsSchema, kv),
          loadRecord(flagsSchema, kv),
          loadRecord(prefsSchema, kv),
          loadSavedGame(kv),
        ]);
        loaded = { stats, flags, prefs, session };
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
    <LudoProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
    >
      <LudoScreens />
    </LudoProvider>
  );
}
