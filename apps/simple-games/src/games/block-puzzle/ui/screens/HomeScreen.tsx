/**
 * Home (docs/BLOCK_PUZZLE_RULES.md §2, §10). One button, because the game has
 * exactly one thing to offer: a board. There are no levels and no
 * difficulties — the board is always 8×8 and the pieces are always the same
 * nineteen (§1, §6), so a picker here would be inventing choices the rules do
 * not have.
 *
 * A suspended game resumes; there is nothing to lose by leaving mid-run (§10).
 * Starting a *new* board over one in progress does discard it, so that is the
 * one thing worth a question first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { useBlockPuzzle } from '../../state/GameContext';

export function BlockHomeScreen() {
  const { navigate, stats, canResume, startNewGame, resumeGame, exitToCollection } =
    useBlockPuzzle();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  return (
    <div className="screen home-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. */}
      <WebChromeSlot />

      <header className="screen-header">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('backToGames')}
          onClick={exitToCollection}
        >
          <IconBack />
        </button>
        <span className="icon-btn-placeholder" />
      </header>

      <div className="home-hero">
        {/* The series mark: four squares, one of them still to come. */}
        <div className="home-logo" aria-hidden="true">
          ▟
        </div>
        <h1 className="home-title">{t('blockName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {canResume ? (
          <>
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-big"
              onClick={() => setConfirmNewGame(true)}
            >
              {t('newGame')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-big" onClick={startNewGame}>
            {t('newGame')}
            {/* The record to beat, stated once and quietly — never a target. */}
            {stats.bestScore > 0 ? (
              <span className="btn-note">
                {t('blockBestScore')} {stats.bestScore}
              </span>
            ) : null}
          </button>
        )}

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

      <ConfirmDialog
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame();
        }}
      />
    </div>
  );
}
