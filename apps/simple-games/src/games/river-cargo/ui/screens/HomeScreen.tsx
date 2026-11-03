import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { MODES, type Mode } from '../../game';
import { useRiverCargo } from '../../state/GameContext';
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
  } = useRiverCargo();
  const [pending, setPending] = useState<Mode | null>(null);
  const current = canResume ? session?.mode : null;
  const choose = (mode: Mode) => {
    if (current === mode) resumeGame();
    else if (canResume) setPending(mode);
    else startBoard(mode);
  };
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="rg-home-content" inert={pending !== null}>
        <GameHomeHeader gameId="river-cargo" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="river-cargo" />
          </span>
          <h1 className="home-title">{t('riverCargoName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="river-cargo" />
        </div>
        <div className="home-actions">
          <p className="rg-choose">{t('difficulty')}</p>
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn ${mode === (current ?? preferredMode) ? 'btn-primary' : 'btn-secondary'} btn-big rg-choice`}
              onClick={() => choose(mode)}
            >
              <span>{t(`riverCargoMode_${mode}`)}</span>
              {current === mode ? (
                <span className="btn-note">{t('resume')}</span>
              ) : stats.boards[mode].best !== null ? (
                <span className="btn-note">
                  {t('riverCargoBest')}: {stats.boards[mode].best}
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
