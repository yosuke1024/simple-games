import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCalendar, IconChart, IconCheck, IconGrid } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { formatDuration } from '@/ui/format';
import { localDateString } from '../../game';
import { useQuickMath } from '../../state/GameContext';

/**
 * Each mode has its own entry point and its own suspended set (§9), so nothing
 * here can cost the player a set in progress — no confirmation needed.
 */
export function QuickMathHomeScreen() {
  const {
    navigate,
    sessions,
    progress,
    dailyDoneToday,
    startLevel,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useQuickMath();
  const { t } = useSettings();

  const levelSet = sessions.level?.status === 'playing' ? sessions.level : null;
  const dailySet = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailySet?.dailyDate === today;
  const frontierBest = progress.bestSeconds[String(progress.highestUnlocked)];

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
        {/* The series mark: the division sign. It is the one arithmetic sign
            that is never also a control — a plus adds, a minus collapses, a
            cross closes — so on a tile it can only mean arithmetic. */}
        <div className="home-logo" aria-hidden="true">
          ÷
        </div>
        <h1 className="home-title">{t('qmathName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => (levelSet ? resumeGame('level') : startLevel(progress.highestUnlocked))}
        >
          {t('modeLevel', { n: levelSet?.level ?? progress.highestUnlocked })}
          {levelSet ? (
            <span className="btn-note">
              {t('resume')} · {levelSet.solvedCount} / {levelSet.questions.length}
            </span>
          ) : frontierBest !== undefined ? (
            <span className="btn-note">
              {t('bestTime')} {formatDuration(frontierBest)}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-big"
          onClick={() => (dailySet ? resumeGame('daily') : startDaily())}
        >
          {t('dailyChallenge')}
          {dailySet ? (
            <span className="btn-note">
              {t('resume')}
              {dailyIsToday ? '' : ` · ${dailySet.dailyDate}`} · {dailySet.solvedCount} /{' '}
              {dailySet.questions.length}
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
