import { PlayTogetherButton, type PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { useCrazyEights } from '../../state/GameContext';
export function HomeScreen(together: PlayTogetherProps = {}) {
  const { t } = useSettings();
  const { canResume, resumeGame, startBoard, navigate, exitToCollection } = useCrazyEights();
  const [pending, setPending] = useState(false);
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="ce-home-content" inert={pending}>
        <GameHomeHeader gameId="crazy-eights" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="crazy-eights" />
          </span>
          <h1 className="home-title">{t('crazyEightsName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="crazy-eights" />
        </div>
        <div className="home-actions">
          <p className="ce-intro">{t('crazyEightsIntro')}</p>
          {canResume ? (
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${canResume ? 'btn-secondary' : 'btn-primary'} btn-big`}
            onClick={() => (canResume ? setPending(true) : startBoard())}
          >
            {t('newGame')}
          </button>
          <p className="ce-rule-summary">{t('crazyEightsRules')}</p>
          <PlayTogetherButton {...together} />
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
        open={pending}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(false)}
        onConfirm={() => {
          setPending(false);
          startBoard();
        }}
      />
    </div>
  );
}
