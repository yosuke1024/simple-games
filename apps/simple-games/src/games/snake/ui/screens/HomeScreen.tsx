import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { useSnake } from '../../state/GameContext';

/**
 * There is no suspended game to guard and no level ladder to choose from
 * (docs/SNAKE_RULES.md §7, §10), so the home is one button: start.
 */
export function SnakeHomeScreen() {
  const { navigate, beginAttempt, exitToCollection } = useSnake();
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
        <span className="icon-btn-placeholder" />
      </header>

      <div className="home-hero">
        {/* The series mark: a body doubling back on itself. */}
        <div className="home-logo" aria-hidden="true">
          ∿
        </div>
        <h1 className="home-title">{t('snakeName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button type="button" className="btn btn-primary btn-big" onClick={beginAttempt}>
          {t('newGame')}
        </button>

        <nav className="home-chips">
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
