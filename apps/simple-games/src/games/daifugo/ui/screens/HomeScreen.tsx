import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { useDaifugo } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const { canResume, resumeGame, startBoard, navigate, exitToCollection } = useDaifugo();
  const [pending, setPending] = useState(false);
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="df-home-content" inert={pending}>
        <GameHomeHeader gameId="daifugo" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="daifugo" />
          </span>
          <h1 className="home-title">{t('daifugoName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="daifugo" />
        </div>
        <div className="home-actions">
          <p className="df-intro">{t('daifugoIntro')}</p>
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
          <p className="df-rule-summary">{t('daifugoRules')}</p>
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
