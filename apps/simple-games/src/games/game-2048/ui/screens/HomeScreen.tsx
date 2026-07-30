import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { localDateString } from '../../game';
import { useGame2048 } from '../../state/GameContext';

/**
 * Two ways in, each with its own suspended game (§6), so nothing here can cost
 * the player a game in progress — no confirmation needed. There is no level
 * list: 2048 has no stages, and inventing 999 of them would be padding rather
 * than a game (§6).
 */
export function Game2048HomeScreen() {
  const {
    navigate,
    sessions,
    stats,
    dailyPlayedToday,
    startClassic,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useGame2048();
  const { t } = useSettings();

  const classicGame = sessions.classic?.status === 'playing' ? sessions.classic : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;

  return (
    <div className="screen home-screen">
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
        {/* The series mark: a tile holding the game's whole shape — its goal. */}
        <div className="home-logo g2048-logo" aria-hidden="true">
          2048
        </div>
        <h1 className="home-title">{t('g2048Name')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => (classicGame ? resumeGame('classic') : startClassic())}
        >
          {t('g2048ModeClassic')}
          {classicGame ? (
            <span className="btn-note">
              {t('resume')} · {classicGame.score}
            </span>
          ) : stats.classic.bestScore > 0 ? (
            <span className="btn-note">
              {t('best')} {stats.classic.bestScore}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-big"
          onClick={() => (dailyGame ? resumeGame('daily') : startDaily())}
        >
          {t('dailyChallenge')}
          {dailyGame ? (
            <span className="btn-note">
              {t('resume')}
              {dailyIsToday ? '' : ` · ${dailyGame.dailyDate}`}
            </span>
          ) : dailyPlayedToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('g2048DailyPlayedBadge')}
            </span>
          ) : null}
        </button>

        <nav className="home-chips g2048-chips">
          <button type="button" className="home-chip" onClick={() => navigate('daily')}>
            <IconCalendar className="home-chip-icon" />
            <span>{t('dailyPast')}</span>
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
