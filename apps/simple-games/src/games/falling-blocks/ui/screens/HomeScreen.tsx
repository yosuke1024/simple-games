import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconChart } from '@/ui/components/icons';
import { useFallingBlocks } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const { canResume, resumeGame, newGame, navigate, exitToCollection, stats } = useFallingBlocks();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="fb-home-content" inert={confirm}>
        <GameHomeHeader gameId="falling-blocks" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="falling-blocks" />
          </span>
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
