import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { SIZES, type Size } from '../../game';
import { useLightGrid } from '../../state/GameContext';
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
  } = useLightGrid();
  const [pending, setPending] = useState<Size | null>(null);
  const current = canResume ? session?.size : null;
  const choose = (size: Size) => {
    if (current === size) resumeGame();
    else if (canResume) setPending(size);
    else startBoard(size);
  };
  return (
    <div className="screen home-screen">
      <div className="lg-home-content" inert={pending !== null}>
        <GameHomeHeader gameId="light-grid" onBack={exitToCollection} />
        <div className="home-hero">
          <div className="home-logo" aria-hidden="true">
            ✚
          </div>
          <h1 className="home-title">{t('lightGridName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="light-grid" />
        </div>
        <div className="home-actions">
          <p className="lg-choose">{t('lightGridChoose')}</p>
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`btn ${size === (current ?? preferredSize) ? 'btn-primary' : 'btn-secondary'} btn-big lg-choice`}
              onClick={() => choose(size)}
            >
              <span>
                {size} × {size}
              </span>
              {current === size ? (
                <span className="btn-note">{t('resume')}</span>
              ) : stats.boards[size].best !== null ? (
                <span className="btn-note">
                  {t('lightGridBest')}: {stats.boards[size].best}
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
