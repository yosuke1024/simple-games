import { SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
import { localDateString } from '../../game';
import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import { IconCalendar, IconChart, IconCheck, IconGear, IconGrid } from '../components/icons';
import { formatDuration } from '../format';

/**
 * Each mode has its own entry point and its own suspended game, so nothing
 * here can cost the player a game in progress — no confirmation needed.
 */
export function HomeScreen() {
  const {
    navigate,
    sessions,
    progress,
    dailyDoneToday,
    dailyStreakToday,
    startLevel,
    startDaily,
    resumeGame,
  } = useApp();
  const { t } = useSettings();

  const levelGame = sessions.level?.status === 'playing' ? sessions.level : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;

  return (
    <div className="screen home-screen">
      <div className="home-hero">
        {/* The series mark: a tile holding the game's whole rule — make 10. */}
        <div className="home-logo" aria-hidden="true">
          10
        </div>
        <h1 className="home-title">{t('appName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => (levelGame ? resumeGame('level') : startLevel(progress.highestUnlocked))}
        >
          {t('modeLevel', { n: levelGame?.level ?? progress.highestUnlocked })}
          {levelGame ? (
            <span className="btn-note">
              {t('resume')} · {formatDuration(levelGame.elapsedSeconds)}
            </span>
          ) : progress.bestScores[String(progress.highestUnlocked)] !== undefined ? (
            <span className="btn-note">
              {t('best')} {progress.bestScores[String(progress.highestUnlocked)]}
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
              {dailyIsToday ? '' : ` · ${dailyGame.dailyDate}`} ·{' '}
              {formatDuration(dailyGame.elapsedSeconds)}
            </span>
          ) : dailyDoneToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('dailyDoneBadge')}
            </span>
          ) : dailyStreakToday > 0 ? (
            <span className="btn-note">{t('streakLine', { n: dailyStreakToday })}</span>
          ) : null}
        </button>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('levels')}>
            <IconGrid className="home-chip-icon" />
            <span>{t('levelsTitle')}</span>
          </button>
          <button type="button" className="home-chip" onClick={() => navigate('daily')}>
            <IconCalendar className="home-chip-icon" />
            <span>{t('dailyPast')}</span>
          </button>
          <button type="button" className="home-chip" onClick={() => navigate('stats')}>
            <IconChart className="home-chip-icon" />
            <span>{t('statistics')}</span>
          </button>
          <button type="button" className="home-chip" onClick={() => navigate('settings')}>
            <IconGear className="home-chip-icon" />
            <span>{t('settings')}</span>
          </button>
        </nav>

        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
        </div>
      </div>

      <footer className="brand-footer">
        <span className="brand-name">{SERIES_NAME}</span>
        <span className="brand-by">{SERIES_BY_LINE}</span>
      </footer>
    </div>
  );
}
