import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { MODES, type Mode } from '../../game';
import { usePaddleRally } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const { session, preferredMode, startNewGame, resumeGame, navigate, exitToCollection } =
    usePaddleRally();
  const [pending, setPending] = useState<Mode | null>(null);
  const current = session?.status === 'playing' ? session.mode : null;
  const choose = (mode: Mode) => {
    if (current === mode) resumeGame();
    else if (current !== null) setPending(mode);
    else startNewGame(mode);
  };
  return (
    <div className="screen home-screen paddleRally-home illustrated-game-home">
      <div inert={pending !== null}>
        <GameHomeHeader gameId="paddle-rally" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="paddle-rally" />
          </span>
          <h1 className="home-title">{t('paddleRallyName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="paddle-rally" />
        </div>
        <div className="home-actions">
          {MODES.map((mode) => (
            <button
              type="button"
              key={mode}
              className={`btn btn-big ${(current ?? preferredMode) === mode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => choose(mode)}
            >
              {t(`paddleRallyMode_${mode}`)}
              {current === mode ? <span className="btn-note">{t('resume')}</span> : null}
            </button>
          ))}
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
        open={pending !== null}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const mode = pending;
          setPending(null);
          if (mode !== null) startNewGame(mode);
        }}
      />
    </div>
  );
}
