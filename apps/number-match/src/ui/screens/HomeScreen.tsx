import { useState } from 'react';
import { SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
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
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const onNewGame = () => {
    if (hasResumableGame) {
      setConfirmNewGame(true);
    } else {
      startClassic();
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
        <button type="button" className="btn btn-secondary btn-big" onClick={startDaily}>
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
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startClassic();
        }}
      />
    </div>
  );
}
