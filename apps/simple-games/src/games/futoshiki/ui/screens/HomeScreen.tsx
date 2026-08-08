import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconCalendar, IconChart, IconCheck, IconGrid } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { localDateString } from '../../game';
import { useFutoshiki } from '../../state/GameContext';

/**
 * Each mode has its own entry point and its own suspended game (§11), so
 * nothing here can cost the player a game in progress — no confirmation
 * needed. The two pickers behind the chips can, and they ask.
 */
export function FutoshikiHomeScreen() {
  const {
    navigate,
    sessions,
    progress,
    dailyDoneToday,
    startLevel,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useFutoshiki();
  const { t } = useSettings();

  const levelGame = sessions.level?.status === 'playing' ? sessions.level : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;

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
        {/* The series mark: the rule itself — two squares and the sign that
            orders them. ASCII in every language, like the board (§1). */}
        <div className="home-logo futoshiki-logo" aria-hidden="true">
          ≶
        </div>
        <h1 className="home-title">{t('futoshikiName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => (levelGame ? resumeGame('level') : startLevel(progress.highestUnlocked))}
        >
          {t('modeLevel', { n: levelGame?.level ?? progress.highestUnlocked })}
          {levelGame ? <span className="btn-note">{t('resume')}</span> : null}
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
