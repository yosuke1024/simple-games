import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { SIZES, type Size } from '../../game';
import { useColorFlood } from '../../state/GameContext';
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
  } = useColorFlood();
  const [pending, setPending] = useState<Size | null>(null);
  const current = canResume ? session?.size : null;
  const choose = (size: Size) => {
    if (current === size) resumeGame();
    else if (canResume) setPending(size);
    else startBoard(size);
  };
  return (
    <div className="screen home-screen">
      <div className="cf-home-content" inert={pending !== null}>
        <GameHomeHeader gameId="color-flood" onBack={exitToCollection} />
        <div className="home-hero">
          <div className="home-logo" aria-hidden="true">
            <svg className="cf-home-mark" viewBox="0 0 60 60" focusable="false">
              <path d="M5 5h31v15H20v16H5Z" fill="currentColor" />
              <path
                d="M40 5h15v15H40ZM24 24h31v31H24ZM5 40h15v15H5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
          </div>
          <h1 className="home-title">{t('colorFloodName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="color-flood" />
        </div>
        <div className="home-actions">
          <p className="cf-choose">{t('colorFloodChoose')}</p>
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`btn ${size === (current ?? preferredSize) ? 'btn-primary' : 'btn-secondary'} btn-big cf-choice`}
              onClick={() => choose(size)}
            >
              <span>
                {size} × {size}
              </span>
              {current === size ? (
                <span className="btn-note">{t('resume')}</span>
              ) : stats.boards[size].best !== null ? (
                <span className="btn-note">
                  {t('colorFloodBest')}: {stats.boards[size].best}
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
