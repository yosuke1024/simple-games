/**
 * NumberPath's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and the home screen. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work.
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
import { NumberPathProvider } from '../state/GameContext';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './number-path.css';
import { NumberPathHomeScreen } from './screens/HomeScreen';

interface LoadedData {
  stats: Stats;
  flags: Flags;
}

export interface NumberPathRootProps {
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

export function NumberPathRoot({ onExit, kv = preferencesKV }: NumberPathRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <NumberPathProvider initialStats={data.stats} initialFlags={data.flags} onExit={onExit}>
      <NumberPathHomeScreen />
    </NumberPathProvider>
  );
}
