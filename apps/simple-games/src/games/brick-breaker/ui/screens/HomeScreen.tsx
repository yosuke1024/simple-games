import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart, IconGrid } from '@/ui/components/icons';
import { LEVEL_COUNT } from '../../game/levels';
import { useBrickBreaker } from '../../state/GameContext';
import { clearedLevelCount } from '../../state/statsLogic';

/**
 * There is no suspended game to guard (docs/BRICK_BREAKER_RULES.md §10), so
 * every entry point is safe to tap.
 */
export function BrickHomeScreen() {
  const { navigate, progress, startLevel, exitToCollection } = useBrickBreaker();
  const { t } = useSettings();
  // highestUnlocked sits one past LEVEL_COUNT once the run is fully cleared
  // (it then means "cleared", not "unlocked" — statsLogic.ts); the button
  // always names a real, playable level.
  const homeLevel = Math.min(progress.highestUnlocked, LEVEL_COUNT);

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="brick-breaker" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The series mark: courses of brickwork. */}
        <div className="home-logo" aria-hidden="true">
          ≡
        </div>
        <h1 className="home-title">{t('brickBreakerName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => startLevel(homeLevel)}
        >
          {t('modeLevel', { n: homeLevel })}
        </button>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('levels')}>
            <IconGrid className="home-chip-icon" />
            <span>{t('levelsTitle')}</span>
            {/* How far up the hundred: levels cleared, a fraction with an end.
                The frontier may sit one past the last level, so it is capped. */}
            <span className="home-chip-count">
              {clearedLevelCount(progress)}/{LEVEL_COUNT}
            </span>
          </button>
          <button type="button" className="home-chip" onClick={() => navigate('stats')}>
            <IconChart className="home-chip-icon" />
            <span>{t('statistics')}</span>
          </button>
        </nav>

        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
        </div>
      </div>
    </div>
  );
}
