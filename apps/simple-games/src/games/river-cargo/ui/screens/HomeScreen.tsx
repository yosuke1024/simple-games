import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { MODES, CATALOG, type Puzzle } from '../../game';
import { useRiverCargo } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const { session, stats, canResume, resumeGame, startPuzzle, navigate, exitToCollection } =
    useRiverCargo();
  const [pending, setPending] = useState<Puzzle | null>(null);
  const choose = (puzzle: Puzzle) => {
    if (canResume && session?.puzzleId === puzzle.id) resumeGame();
    else if (canResume) setPending(puzzle);
    else startPuzzle(puzzle.id);
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
          <p className="rg-choose">{t('riverCargoChoosePuzzle')}</p>
          {canResume && session ? (
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')} · {t(`riverCargoMode_${session.mode}`)} ·{' '}
              {t('riverCargoPuzzle', { n: session.puzzleId.split('-')[1]! })}
            </button>
          ) : null}
          {MODES.map((mode) => (
            <section className="rg-puzzle-section" key={mode}>
              <h2>{t(`riverCargoMode_${mode}`)}</h2>
              <div className="rg-puzzle-list">
                {CATALOG.filter((p) => p.mode === mode).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-secondary rg-puzzle-choice"
                    onClick={() => choose(p)}
                  >
                    <span>{t('riverCargoPuzzle', { n: p.id.split('-')[1]! })}</span>
                    <small>
                      {t('riverCargoPuzzleSummary', { cargo: p.cargo.length, seats: p.seats })}
                    </small>
                    {stats.puzzles[p.id]?.best != null ? (
                      <small>{t('riverCargoPuzzleBest', { n: stats.puzzles[p.id]!.best! })}</small>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
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
          const puzzle = pending;
          setPending(null);
          if (puzzle !== null) startPuzzle(puzzle.id);
        }}
      />
    </div>
  );
}
