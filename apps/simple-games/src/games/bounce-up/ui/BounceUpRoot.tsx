/**
 * Bounce Up's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work — the loop, the listeners, the observers (docs/GAME_LIFECYCLE.md,
 * BounceUpRoot.leak.test.tsx).
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
import { BounceUpProvider, useBounceUp } from '../state/GameContext';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import './bounce-up.css';
import { BounceUpGameScreen } from './screens/GameScreen';
import { BounceUpHomeScreen } from './screens/HomeScreen';
import { BounceUpStatsScreen } from './screens/StatsScreen';
import { BounceUpTutorialScreen } from './screens/TutorialScreen';

export function BounceUpScreens() {
  const { screen } = useBounceUp();
  switch (screen) {
    case 'tutorial':
      return <BounceUpTutorialScreen />;
    case 'game':
      return <BounceUpGameScreen />;
    case 'stats':
      return <BounceUpStatsScreen />;
    case 'home':
    default:
      return <BounceUpHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
}

/**
 * What the shell hands a root (app/registry.ts `GameRootProps`). No `entry`
 * prop, deliberately: there is no saved run for a home-screen shortcut to
 * open onto (docs/BOUNCE_UP_RULES.md §5), and
 * src/test/shortcutResumeWiring.test.ts holds a save-less game to that
 * (issue #113).
 */
export interface BounceUpRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
  };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags, prefs] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
  ]);
  return { stats, flags, prefs };
}

export function BounceUpRoot({ onExit, kv = preferencesKV }: BounceUpRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <BounceUpProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      onExit={onExit}
    >
      <BounceUpScreens />
    </BounceUpProvider>
  );
}
