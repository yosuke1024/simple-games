import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { FallingBlocksProvider, useFallingBlocks } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { GameScreen } from './screens/GameScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { StatsScreen } from './screens/StatsScreen';
import './falling-blocks.css';
const defaults = () => ({
  flags: flagsSchema.defaultValue(),
  stats: statsSchema.defaultValue(),
  session: null,
});
async function load(kv: KVStore) {
  const [flags, stats, session] = await Promise.all([
    loadRecord(flagsSchema, kv),
    loadRecord(statsSchema, kv),
    loadSavedGame(kv),
  ]);
  return { flags, stats, session };
}
export interface FallingBlocksRootProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function FallingBlocksRoot({ onExit, entry, kv = preferencesKV }: FallingBlocksRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <FallingBlocksProvider
      initialSession={data.session}
      initialFlags={data.flags}
      initialStats={data.stats}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens />
    </FallingBlocksProvider>
  );
}
function Screens() {
  const { screen } = useFallingBlocks();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen />;
}
