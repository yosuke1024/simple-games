/**
 * PipeLink's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work (docs/GAME_LIFECYCLE.md).
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
 *
 * Scaffolded by scripts/new-game.mjs.
 */
// Register this game's 14-locale catalog the moment the chunk loads, before
// anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { PipeLinkProvider, usePipeLink } from '../state/GameContext';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './pipe-link.css';
import { PipeLinkGameScreen } from './screens/GameScreen';
import { PipeLinkHomeScreen } from './screens/HomeScreen';
import { PipeLinkTutorialScreen } from './screens/TutorialScreen';

export function PipeLinkScreens() {
  const { screen } = usePipeLink();
  switch (screen) {
    case 'tutorial':
      return <PipeLinkTutorialScreen />;
    case 'game':
      return <PipeLinkGameScreen />;
    case 'home':
    default:
      return <PipeLinkHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
}

/**
 * What the shell hands a root (app/registry.ts `GameRootProps`). No `entry`
 * prop, deliberately: there is no saved game for a home-screen shortcut to
 * open onto, and src/test/shortcutResumeWiring.test.ts holds a save-less game
 * to that (issue #113). When a `pn.save…` slot arrives, declare it
 * here, hand it to the provider as `entry={entry}`, and let the provider
 * decide (state/GameContext.tsx).
 */
export interface PipeLinkRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return { stats: statsSchema.defaultValue(), flags: flagsSchema.defaultValue() };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
  ]);
  return { stats, flags };
}

export function PipeLinkRoot({ onExit, kv = preferencesKV }: PipeLinkRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <PipeLinkProvider initialStats={data.stats} initialFlags={data.flags} onExit={onExit}>
      <PipeLinkScreens />
    </PipeLinkProvider>
  );
}
