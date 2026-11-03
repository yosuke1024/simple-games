import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { MODES, type Mode } from '../../game';
import { useFleetSearch } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const {
    session,
    stats,
    preferredMode,
    canResume,
    resumeGame,
    startBoard,
    navigate,
    exitToCollection,
  } = useFleetSearch();
  const [pending, setPending] = useState<Mode | null>(null);
  const current = canResume ? session?.mode : null;
  const choose = (mode: Mode) => {
    if (current === mode) resumeGame();
    else if (canResume) setPending(mode);
    else startBoard(mode);
  };
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="fs-home-content" inert={pending !== null}>
        <GameHomeHeader gameId="fleet-search" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="fleet-search" />
          </span>
          <h1 className="home-title">{t('fleetSearchName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="fleet-search" />
        </div>
        <div className="home-actions">
          <p className="fs-choose">{t('difficulty')}</p>
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn ${mode === (current ?? preferredMode) ? 'btn-primary' : 'btn-secondary'} btn-big fs-choice`}
              onClick={() => choose(mode)}
            >
              <span>{t(`fleetSearchMode_${mode}`)}</span>
              {current === mode ? (
                <span className="btn-note">{t('resume')}</span>
              ) : stats.boards[mode].best !== null ? (
                <span className="btn-note">
                  {t('fleetSearchBest')}: {stats.boards[mode].best}
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
          const mode = pending;
          setPending(null);
          if (mode !== null) startBoard(mode);
        }}
      />
    </div>
  );
}
