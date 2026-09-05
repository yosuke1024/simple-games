import { useSettings } from '@/state/SettingsContext';
import { GameHomeActions } from '@/ui/components/GameHomeActions';
import { IconBack, IconCalendar, IconChart, IconCheck, IconGrid } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { formatDuration } from '@/ui/format';
import { localDateString, MAX_LEVEL } from '../../game';
import { useRecall } from '../../state/GameContext';
import { clearedLevelCount } from '../../state/statsLogic';

/**
 * Nothing here can cost the player a round in progress: a round is never
 * suspended (§12), so arriving at this screen means there was nothing left to
 * lose. That is why no button asks for confirmation.
 */
export function RecallHomeScreen() {
  const { navigate, progress, dailyDoneToday, startLevel, startDaily, exitToCollection } =
    useRecall();
  const { t } = useSettings();

  const today = localDateString(new Date());
  const frontierBest = progress.bestSeconds[String(progress.highestUnlocked)];
  const todayBest = progress.dailySeconds[today];

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
        <GameHomeActions gameId="number-recall" />
      </header>

      <div className="home-hero">
        {/* The series mark: a question mark — the tile whose number you are
            trying to remember is the one you can no longer see. */}
        <div className="home-logo" aria-hidden="true">
          ?
        </div>
        <h1 className="home-title">{t('recallName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => startLevel(progress.highestUnlocked)}
        >
          {t('modeLevel', { n: progress.highestUnlocked })}
          {frontierBest !== undefined ? (
            <span className="btn-note">
              {t('bestTime')} {formatDuration(frontierBest)}
            </span>
          ) : null}
        </button>

        <button type="button" className="btn btn-secondary btn-big" onClick={() => startDaily()}>
          {t('dailyChallenge')}
          {dailyDoneToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('dailyDoneBadge')}
              {todayBest !== undefined ? ` · ${formatDuration(todayBest)}` : ''}
            </span>
          ) : null}
        </button>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('levels')}>
            <IconGrid className="home-chip-icon" />
            <span>{t('levelsTitle')}</span>
            {/* How far up the hundred: a fraction with an end, said once. */}
            <span className="home-chip-count">
              {clearedLevelCount(progress)}/{MAX_LEVEL}
            </span>
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
