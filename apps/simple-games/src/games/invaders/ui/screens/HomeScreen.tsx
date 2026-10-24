import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { useInvaders } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const { canResume, resumeRun, startNewRun, navigate, exitToCollection } = useInvaders();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="iv-home-content" inert={confirm}>
        <GameHomeHeader gameId="invaders" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="invaders" />
          </span>
          <h1 className="home-title">{t('invadersName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="invaders" />
        </div>
        <div className="home-actions">
          {canResume ? (
            <button type="button" className="btn btn-primary btn-big" onClick={resumeRun}>
              {t('resume')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${canResume ? 'btn-secondary' : 'btn-primary'} btn-big`}
            onClick={() => (canResume ? setConfirm(true) : startNewRun())}
          >
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
      <ConfirmDialog
        open={confirm}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          startNewRun();
        }}
      />
    </div>
  );
}
