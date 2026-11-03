import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconChart } from '@/ui/components/icons';
import { MODES, PUZZLES, type Puzzle } from '../../game';
import { useMarbleWeave } from '../../state/GameContext';
export function HomeScreen() {
  const { t } = useSettings();
  const { session, stats, canResume, resumeGame, startPuzzle, navigate, exitToCollection } =
    useMarbleWeave();
  const [pending, setPending] = useState<Puzzle | null>(null);
  const choose = (puzzle: Puzzle) => {
    if (canResume && session?.puzzleId === puzzle.id) resumeGame();
    else if (canResume) setPending(puzzle);
    else startPuzzle(puzzle.id);
  };
  return (
    <div className="screen home-screen illustrated-game-home">
      <div className="mw-home-content" inert={pending !== null}>
        <GameHomeHeader gameId="marble-weave" onBack={exitToCollection} />
        <div className="home-hero">
          <span className="game-home-artwork" aria-hidden="true">
            <GameArtwork id="marble-weave" />
          </span>
          <h1 className="home-title">{t('marbleWeaveName')}</h1>
          <p className="home-tagline">{t('tagline')}</p>
          <WebBetaNotice gameId="marble-weave" />
        </div>
        <div className="home-actions">
          <p className="mw-choose">{t('marbleWeaveChoosePuzzle')}</p>
          {canResume && session ? (
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')} · {t(`marbleWeaveMode_${session.mode}`)} ·{' '}
              {session.puzzleId
                ? t('marbleWeavePuzzle', { n: session.puzzleId.split('-')[1]! })
                : t('marbleWeaveLegacy')}
            </button>
          ) : null}
          {MODES.map((mode) => (
            <section className="mw-puzzle-section" key={mode}>
              <h2>{t(`marbleWeaveMode_${mode}`)}</h2>
              <div className="mw-puzzle-list">
                {PUZZLES.filter((p) => p.mode === mode).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-secondary mw-puzzle-choice"
                    onClick={() => choose(p)}
                  >
                    <span>{t('marbleWeavePuzzle', { n: p.id.split('-')[1]! })}</span>
                    <small>{t('marbleWeaveGoal', { n: p.moveLimit })}</small>
                    {stats.puzzles[p.id]?.best != null ? (
                      <small>{t('marbleWeavePuzzleBest', { n: stats.puzzles[p.id]!.best! })}</small>
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
