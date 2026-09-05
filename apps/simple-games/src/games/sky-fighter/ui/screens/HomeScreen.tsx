import { useSettings } from '@/state/SettingsContext';
import { GameHomeActions } from '@/ui/components/GameHomeActions';
import { IconBack, IconChart, IconGrid } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { LEVEL_COUNT } from '../../game/levels';
import { useSkyFighter } from '../../state/GameContext';
import { clearedLevelCount } from '../../state/statsLogic';

/**
 * There is no suspended game to guard (docs/SKY_FIGHTER_RULES.md §10), so
 * every entry point is safe to tap.
 */
export function SkyHomeScreen() {
  const { navigate, progress, stats, startLevel, exitToCollection } = useSkyFighter();
  const { t } = useSettings();

  return (
    <div className="screen home-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. This game's
          board and result screens deliberately have none. */}
      <WebChromeSlot />

      <header className="screen-header">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('backToGames')}
          onClick={exitToCollection}
        >
          <IconBack />
        </button>
        <GameHomeActions gameId="sky-fighter" />
      </header>

      <div className="home-hero">
        {/* The series mark: the player's craft, nose up. */}
        <div className="home-logo" aria-hidden="true">
          ▲
        </div>
        <h1 className="home-title">{t('skyFighterName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => startLevel(progress.highestUnlocked)}
        >
          {t('modeLevel', { n: progress.highestUnlocked })}
          {stats.bestScore > 0 ? (
            <span className="btn-note">
              {t('bestScore')} {stats.bestScore}
            </span>
          ) : null}
        </button>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('levels')}>
            <IconGrid className="home-chip-icon" />
            <span>{t('levelsTitle')}</span>
            {/* How far up the hundred: a fraction with an end, said once (§7). */}
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
