import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCalendar, IconChart, IconCheck, IconGrid } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { localDateString } from '../../game';
import { useSudoku } from '../../state/GameContext';

/**
 * Each mode has its own entry point and its own suspended game, so nothing
 * here can cost the player a game in progress — no confirmation needed.
 */
export function SudokuHomeScreen() {
  const {
    navigate,
    sessions,
    progress,
    dailyDoneToday,
    startLevel,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useSudoku();
  const { t } = useSettings();

  const levelGame = sessions.level?.status === 'playing' ? sessions.level : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;
  const frontierBest = progress.bestTimes[String(progress.highestUnlocked)];

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
        {/* The series mark: a tile holding the game's whole shape — a 3x3 box. */}
        <div className="home-logo" aria-hidden="true">
          ⌗
        </div>
        <h1 className="home-title">{t('sudokuName')}</h1>
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
            <span className="btn-note">{t('resume')}</span>
          ) : frontierBest !== undefined ? (
            <span className="btn-note">
              {t('bestTime')} {formatDuration(frontierBest)}
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
          ) : dailyDoneToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('dailyDoneBadge')}
            </span>
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
