import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { ColorFloodProvider, useColorFlood } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, prefsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import './color-flood.css';
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
export interface ColorFloodRootProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function ColorFloodRoot({ onExit, entry, kv = preferencesKV }: ColorFloodRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <ColorFloodProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens />
    </ColorFloodProvider>
  );
}
function Screens() {
  const { screen } = useColorFlood();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen />;
}
