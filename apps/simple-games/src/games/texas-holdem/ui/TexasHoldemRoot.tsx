import type { PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { TexasHoldemProvider, useTexasHoldem } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import './texas-holdem.css';
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
export interface TexasHoldemRootProps extends PlayTogetherProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function TexasHoldemRoot({
  onPlayTogether,
  playTogetherActive,
  onExit,
  entry,
  kv = preferencesKV,
}: TexasHoldemRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <TexasHoldemProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens onPlayTogether={onPlayTogether} playTogetherActive={playTogetherActive} />
    </TexasHoldemProvider>
  );
}
function Screens(together: PlayTogetherProps = {}) {
  const { screen } = useTexasHoldem();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen {...together} />;
}
