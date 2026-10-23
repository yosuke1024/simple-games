import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
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
    <div className="screen home-screen paddleRally-home">
      <div inert={pending !== null}>
        <GameHomeHeader gameId="paddle-rally" onBack={exitToCollection} />
        <div className="home-hero">
          <div className="home-logo paddleRally-home-mark" aria-hidden="true">
            <svg viewBox="0 0 72 72" focusable="false">
              <path d="M6 36 H66" stroke="currentColor" strokeDasharray="4 5" opacity=".3" />
              <rect x="30" y="12" width="28" height="5" rx="2" fill="currentColor" />
              <rect x="10" y="55" width="28" height="5" rx="2" fill="currentColor" />
              <circle cx="40" cy="32" r="4" fill="currentColor" />
            </svg>
          </div>
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
