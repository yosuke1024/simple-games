import { useApp } from '../state/AppContext';
import { DailyScreen } from './screens/DailyScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LevelSelectScreen } from './screens/LevelSelectScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TutorialScreen } from './screens/TutorialScreen';

export function App() {
  const { screen } = useApp();
  switch (screen) {
    case 'tutorial':
      return <TutorialScreen />;
    case 'levels':
      return <LevelSelectScreen />;
    case 'daily':
      return <DailyScreen />;
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
