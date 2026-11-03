import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { DaifugoProvider, useDaifugo } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import './daifugo.css';
const defaults = () => ({
  stats: statsSchema.defaultValue(),
  flags: flagsSchema.defaultValue(),
  session: null,
});
async function load(kv: KVStore) {
  const [stats, flags, session] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadSavedGame(kv),
  ]);
  return { stats, flags, session };
}
export interface DaifugoRootProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function DaifugoRoot({ onExit, entry, kv = preferencesKV }: DaifugoRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <DaifugoProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens />
    </DaifugoProvider>
  );
}
function Screens() {
  const { screen } = useDaifugo();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen />;
}
