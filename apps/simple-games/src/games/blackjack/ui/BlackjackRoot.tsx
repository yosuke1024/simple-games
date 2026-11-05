import type { PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { BlackjackProvider, useBlackjack } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import './blackjack.css';
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
export interface BlackjackRootProps extends PlayTogetherProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function BlackjackRoot({
  onPlayTogether,
  playTogetherActive,
  onExit,
  entry,
  kv = preferencesKV,
}: BlackjackRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <BlackjackProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens onPlayTogether={onPlayTogether} playTogetherActive={playTogetherActive} />
    </BlackjackProvider>
  );
}
function Screens(together: PlayTogetherProps = {}) {
  const { screen } = useBlackjack();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen {...together} />;
}
