import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { SIZES, type Size } from '../../game';
import { useMazeEscape } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const {
    session,
    stats,
    preferredSize,
    canResume,
    resumeGame,
    startBoard,
    navigate,
    exitToCollection,
  } = useMazeEscape();
  const [pending, setPending] = useState<Size | null>(null);
  const current = canResume ? session?.size : null;
  const choose = (size: Size) => {
    if (current === size) resumeGame();
    else if (canResume) setPending(size);
    else startBoard(size);
  };
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="me-home-content" inert={pending !== null}>
        <GameHomeHeader gameId="maze-escape" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="maze-escape" />
          </span>
          <h1 className="home-title">{t('mazeEscapeName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="maze-escape" />
        </div>
        <div className="home-actions">
          <p className="me-choose">{t('mazeEscapeChoose')}</p>
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`btn ${size === (current ?? preferredSize) ? 'btn-primary' : 'btn-secondary'} btn-big me-choice`}
              onClick={() => choose(size)}
            >
              <span>
                {size} × {size}
              </span>
              {current === size ? (
                <span className="btn-note">{t('resume')}</span>
              ) : stats.boards[size].best !== null ? (
                <span className="btn-note">
                  {t('mazeEscapeBest')}: {stats.boards[size].best}
                </span>
              ) : null}
            </button>
          ))}
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
        open={pending !== null}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const size = pending;
          setPending(null);
          if (size !== null) startBoard(size);
        }}
      />
    </div>
  );
}
