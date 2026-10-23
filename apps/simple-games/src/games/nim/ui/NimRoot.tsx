import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { NimProvider, useNim } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, prefsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import './nim.css';
interface RootProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
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
function Screens() {
  const { screen } = useNim();
  return screen === 'game' ? (
    <GameScreen />
  ) : screen === 'tutorial' ? (
    <TutorialScreen />
  ) : screen === 'stats' ? (
    <StatsScreen />
  ) : (
    <HomeScreen />
  );
}
export function NimRoot({ onExit, entry, kv = preferencesKV }: RootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <NimProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens />
    </NimProvider>
  );
}
