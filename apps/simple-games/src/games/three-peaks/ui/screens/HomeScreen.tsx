import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useThreePeaks } from '../../state/GameContext';
export function ThreePeaksHomeScreen() {
  const { t } = useSettings();
  const { canResume, resumeGame, startGame, navigate, exitToCollection } = useThreePeaks();
  const [confirmNew, setConfirmNew] = useState(false);
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="tp-home-content" inert={confirmNew || undefined}>
        <GameHomeHeader gameId="three-peaks" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="three-peaks" />
          </span>
          <h1 className="home-title">{t('threePeaksName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="three-peaks" />
        </div>
        <div className="home-actions">
          {canResume && (
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')}
            </button>
          )}
          <button
            type="button"
            className={`btn ${canResume ? 'btn-secondary' : 'btn-primary'} btn-big`}
            onClick={() => (canResume ? setConfirmNew(true) : startGame())}
          >
            {t('newGame')}
          </button>
          <nav className="home-chips">
            <button type="button" className="home-chip" onClick={() => navigate('stats')}>
              {t('statistics')}
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
        open={confirmNew}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('newGame')}
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          startGame();
        }}
      />
    </div>
  );
}
