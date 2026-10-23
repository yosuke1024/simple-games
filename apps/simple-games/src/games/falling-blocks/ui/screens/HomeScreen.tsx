import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconChart } from '@/ui/components/icons';
import { useFallingBlocks } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const { canResume, resumeGame, newGame, navigate, exitToCollection, stats } = useFallingBlocks();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen home-screen">
      <div className="fb-home-content" inert={confirm}>
        <GameHomeHeader gameId="falling-blocks" onBack={exitToCollection} />
        <div className="home-hero">
          <div className="home-logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="64" height="64" focusable="false">
              <path
                d="M24 6h16v16H24zM7 23h16v16H7zM24 23h16v16H24zM41 23h16v16H41z"
                fill="currentColor"
              />
              <path d="M7 47h50v11H7z" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="home-title">{t('fallingBlocksName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="falling-blocks" />
        </div>
        <div className="home-actions">
          <p className="fb-intro">{t('fallingBlocksGoal')}</p>
          {canResume ? (
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${canResume ? 'btn-secondary' : 'btn-primary'} btn-big`}
            onClick={() => (canResume ? setConfirm(true) : newGame())}
          >
            {t('newGame')}
          </button>
          {stats.bestScore > 0 ? (
            <p className="fb-intro">
              {t('fallingBlocksBest')}: {stats.bestScore}
            </p>
          ) : null}
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
      <ConfirmDialog
        open={confirm}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          newGame();
        }}
      />
    </div>
  );
}
