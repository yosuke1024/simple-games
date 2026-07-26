import { useApp } from '../state/AppContext';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TutorialScreen } from './screens/TutorialScreen';

export function App() {
  const { screen } = useApp();
  switch (screen) {
    case 'tutorial':
      return <TutorialScreen />;
    case 'game':
      return <GameScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'stats':
      return <StatsScreen />;
    case 'home':
    default:
      return <HomeScreen />;
  }
}
