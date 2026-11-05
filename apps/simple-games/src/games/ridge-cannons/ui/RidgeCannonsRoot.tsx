import type { PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { RidgeCannonsProvider, useRidgeCannons } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, prefsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import './ridge-cannons.css';
const defaults = () => ({
  stats: statsSchema.defaultValue(),
  flags: flagsSchema.defaultValue(),
  prefs: prefsSchema.defaultValue(),
  session: null,
});
async function load(kv: KVStore) {
  const [stats, flags, prefs, session] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGame(kv),
  ]);
  return { stats, flags, prefs, session };
}
export interface RidgeCannonsRootProps extends PlayTogetherProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function RidgeCannonsRoot({
  onPlayTogether,
  playTogetherActive,
  onExit,
  entry,
  kv = preferencesKV,
}: RidgeCannonsRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <RidgeCannonsProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens onPlayTogether={onPlayTogether} playTogetherActive={playTogetherActive} />
    </RidgeCannonsProvider>
  );
}
function Screens(together: PlayTogetherProps = {}) {
  const { screen } = useRidgeCannons();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen {...together} />;
}
