/**
 * Home (docs/SCOPA_RULES.md §9.3): one opponent and nothing to choose — there
 * is one strength (§4), and the dealer comes from the match's seed (§2.1) — so
 * the button either deals a match or picks up the one already on the table.
 *
 * The slot holds one match, and a match runs to eleven across several deals,
 * so replacing one is the one thing here worth asking about first. It asks
 * with the shell's reviewed wording, the same as the ↻ on the table.
 *
 * The record so far rides on the main button as one quiet line, and only once
 * a match has ended — a fact, never a target. The early-release notice under
 * the tagline is the shell's (docs/WEB_VERSION.md「先行公開(ベータ)」).
 */
import { useState } from 'react';
import { PlayTogetherButton, type PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useScopa } from '../../state/GameContext';

export function ScopaHomeScreen(props: PlayTogetherProps) {
  const { navigate, stats, canResume, startNewGame, resumeGame, exitToCollection } = useScopa();
  const { t } = useSettings();
  const [confirmReplace, setConfirmReplace] = useState(false);

  const finished = stats.wins + stats.losses;
  const note =
    finished > 0 ? t('scopaRecordNote', { wins: stats.wins, losses: stats.losses }) : null;

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="scopa" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="scopa" />
        </span>
        <h1 className="home-title">{t('scopaName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="scopa" />
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

        <PlayTogetherButton {...props} />

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
