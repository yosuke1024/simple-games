import { useState } from 'react';
import { SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
import { localDateString } from '../../game';
import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDuration } from '../format';

export function HomeScreen() {
  const {
    navigate,
    session,
    hasResumableGame,
    dailyDoneToday,
    dailyStreakToday,
    startClassic,
    startDaily,
    resumeGame,
  } = useApp();
  const { t } = useSettings();
  const [confirmTarget, setConfirmTarget] = useState<'classic' | 'daily' | null>(null);

  const onNewGame = () => {
    if (hasResumableGame) {
      setConfirmTarget('classic');
    } else {
      startClassic();
    }
  };

  const onDaily = () => {
    // Resuming today's daily never discards anything; anything else would
    // silently drop the game in progress, so confirm first.
    const resumesToday =
      session?.mode === 'daily' && session.dailyDate === localDateString(new Date());
    if (hasResumableGame && !resumesToday) {
      setConfirmTarget('daily');
    } else {
      startDaily();
    }
  };

  return (
    <div className="screen home-screen">
      <div className="home-hero">
        <h1 className="home-title">{t('appName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {hasResumableGame && session ? (
          <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
            {t('resume')}
            <span className="btn-note">
              {session.mode === 'daily' ? t('modeDaily') : t('modeClassic')} ·{' '}
              {formatDuration(session.elapsedSeconds)}
            </span>
          </button>
        ) : null}
        <button
          type="button"
          className={`btn btn-big ${hasResumableGame ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onNewGame}
        >
          {t('newGame')}
        </button>
        <button type="button" className="btn btn-secondary btn-big" onClick={onDaily}>
          {t('dailyChallenge')}
          {dailyDoneToday ? <span className="btn-note">✓ {t('dailyDoneBadge')}</span> : null}
          {!dailyDoneToday && dailyStreakToday > 0 ? (
            <span className="btn-note">{t('streakLine', { n: dailyStreakToday })}</span>
          ) : null}
        </button>
        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('stats')}>
            {t('statistics')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('settings')}>
            {t('settings')}
          </button>
        </div>
      </div>

      <footer className="brand-footer">
        <span className="brand-name">{SERIES_NAME}</span>
        <span className="brand-by">{SERIES_BY_LINE}</span>
      </footer>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          const target = confirmTarget;
          setConfirmTarget(null);
          if (target === 'daily') {
            startDaily();
          } else {
            startClassic();
          }
        }}
      />
    </div>
  );
}
