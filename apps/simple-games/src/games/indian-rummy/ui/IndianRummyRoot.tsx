import type { PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { IndianRummyProvider, useIndianRummy } from '../state/GameContext';
import { loadSaved } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import './indian-rummy.css';
const defaults = () => ({
  stats: statsSchema.defaultValue(),
  flags: flagsSchema.defaultValue(),
  session: null,
  handOrder: undefined,
});
async function load(kv: KVStore) {
  const [stats, flags, saved] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadSaved(kv),
  ]);
  return { stats, flags, session: saved?.session ?? null, handOrder: saved?.handOrder };
}
export interface IndianRummyRootProps extends PlayTogetherProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function IndianRummyRoot({
  onPlayTogether,
  playTogetherActive,
  onExit,
  entry,
  kv = preferencesKV,
}: IndianRummyRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <IndianRummyProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      initialHandOrder={data.handOrder}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens onPlayTogether={onPlayTogether} playTogetherActive={playTogetherActive} />
    </IndianRummyProvider>
  );
}
function Screens(together: PlayTogetherProps = {}) {
  const { screen } = useIndianRummy();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen {...together} />;
}
