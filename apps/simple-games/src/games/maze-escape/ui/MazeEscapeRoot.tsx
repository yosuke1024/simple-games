import '../i18n';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { MazeEscapeProvider, useMazeEscape } from '../state/GameContext';
import { loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, prefsSchema, statsSchema } from '../storage/schemas';
import { HomeScreen } from './screens/HomeScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import './maze-escape.css';
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
export interface MazeEscapeRootProps {
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
}
export function MazeEscapeRoot({ onExit, entry, kv = preferencesKV }: MazeEscapeRootProps) {
  const data = useLoadedRecords(kv, load, defaults);
  if (!data) return null;
  return (
    <MazeEscapeProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSession={data.session}
      onExit={onExit}
      entry={entry}
      kv={kv}
    >
      <Screens />
    </MazeEscapeProvider>
  );
}
function Screens() {
  const { screen } = useMazeEscape();
  if (screen === 'tutorial') return <TutorialScreen />;
  if (screen === 'game') return <GameScreen />;
  if (screen === 'stats') return <StatsScreen />;
  return <HomeScreen />;
}
