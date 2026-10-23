import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { ThreePeaksProvider, useThreePeaks } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { ThreePeaksHomeScreen } from './screens/HomeScreen';
import { ThreePeaksGameScreen } from './screens/GameScreen';
import { ThreePeaksTutorialScreen } from './screens/TutorialScreen';
import { ThreePeaksStatsScreen } from './screens/StatsScreen';
import './three-peaks.css';
export interface ThreePeaksRootProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
async function loadRecords(kv: KVStore) {
  const [session, stats, flags] = await Promise.all([
    loadSavedGame(kv),
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
  ]);
  return { session, stats, flags };
}
const defaultRecords = () => ({
  session: null,
  stats: statsSchema.defaultValue(),
  flags: flagsSchema.defaultValue(),
});
export function ThreePeaksScreens() {
  const { screen } = useThreePeaks();
  if (screen === 'game') return <ThreePeaksGameScreen />;
  if (screen === 'tutorial') return <ThreePeaksTutorialScreen />;
  if (screen === 'stats') return <ThreePeaksStatsScreen />;
  return <ThreePeaksHomeScreen />;
}
export function ThreePeaksRoot({ onExit, entry, kv = preferencesKV }: ThreePeaksRootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (!data) return null;
  return (
    <ThreePeaksProvider
      initialSession={data.session}
      initialStats={data.stats}
      initialFlags={data.flags}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <ThreePeaksScreens />
    </ThreePeaksProvider>
  );
}
