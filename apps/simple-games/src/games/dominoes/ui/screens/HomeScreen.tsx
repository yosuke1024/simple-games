/**
 * Home (docs/DOMINOES_RULES.md §2, §5): one opponent, one button, and nothing
 * between the player and the table. There is no difficulty to pick and no
 * side to choose — the deal decides who opens (§2) — so the button either
 * deals or picks up the game already on the table.
 *
 * The slot holds one game, so dealing a new one while another is in progress
 * replaces it. That is the one thing here worth asking about first, and it
 * asks with the shell's own reviewed wording.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useDominoes } from '../../state/GameContext';

export function DominoesHomeScreen() {
  const { navigate, stats, canResume, startNewGame, resumeGame, exitToCollection } = useDominoes();
  const { t } = useSettings();
  const [confirmReplace, setConfirmReplace] = useState(false);

  // The record so far, stated once and quietly — never a target. Absent
  // until there is one.
  const finished = stats.wins + stats.losses + stats.draws;
  const note =
    finished > 0 ? t('dominoesRecordNote', { wins: stats.wins, losses: stats.losses }) : null;

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="dominoes" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): a tile split in two. */}
        <div className="home-logo" aria-hidden="true">
          ⊟
        </div>
        <h1 className="home-title">{t('dominoesName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="dominoes" />
      </div>

      <div className="home-actions">
        {canResume ? (
          <>
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-big"
              onClick={() => setConfirmReplace(true)}
            >
              {t('newGame')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-big" onClick={startNewGame}>
            {t('newGame')}
            {note ? <span className="btn-note">{note}</span> : null}
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
        open={confirmReplace}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false);
          startNewGame();
        }}
      />
    </div>
  );
}
