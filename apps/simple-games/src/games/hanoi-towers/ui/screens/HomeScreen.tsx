import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { SIZES, type Size } from '../../game';
import { useHanoiTowers } from '../../state/GameContext';
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
  } = useHanoiTowers();
  const [pending, setPending] = useState<Size | null>(null);
  const current = canResume ? session?.size : null;
  const choose = (size: Size) => {
    if (current === size) resumeGame();
    else if (canResume) setPending(size);
    else startBoard(size);
  };
  return (
    <div className="screen home-screen">
      <div className="ht-home-content" inert={pending !== null}>
        <GameHomeHeader gameId="hanoi-towers" onBack={exitToCollection} />
        <div className="home-hero">
          <div className="home-logo ht-logo" aria-hidden="true">
            <svg viewBox="0 0 72 72">
              <path d="M36 12v44M9 61h54" className="ht-logo-stand" />
              <rect x="12" y="46" width="48" height="10" rx="4" />
              <rect x="20" y="34" width="32" height="10" rx="4" />
              <rect x="28" y="22" width="16" height="10" rx="4" />
            </svg>
          </div>
          <h1 className="home-title">{t('hanoiTowersName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="hanoi-towers" />
        </div>
        <div className="home-actions">
          <p className="ht-choose">{t('hanoiTowersChoose')}</p>
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`btn ${size === (current ?? preferredSize) ? 'btn-primary' : 'btn-secondary'} btn-big ht-choice`}
              onClick={() => choose(size)}
            >
              <span>{t('hanoiTowersDisks', { count: size })}</span>
              {current === size ? (
                <span className="btn-note">{t('resume')}</span>
              ) : stats.boards[size].best !== null ? (
                <span className="btn-note">
                  {t('hanoiTowersBest')}: {stats.boards[size].best}
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
