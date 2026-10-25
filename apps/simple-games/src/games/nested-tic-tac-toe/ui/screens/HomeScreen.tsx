import { PlayTogetherButton, type PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
/**
 * Home (docs/NESTED_TIC_TAC_TOE_RULES.md §1): three opponents, who moves
 * first, and nothing between the player and the board. There is no level
 * list — every match starts on the same empty board.
 *
 * A difficulty button starts its match at once. With a match in progress, the
 * same difficulty resumes it, and a different one asks first — the slot holds
 * one match, so starting another replaces it (Reversi's home, the same shape).
 *
 * Who moves first is a preference for the next match, not a switch on the
 * current one (§1). Two buttons rather than a toggle: each draws its mark —
 * the same shapes the board uses — beside the translated word, and its
 * accessible name says the mark's name too, so nobody has to know that the
 * cross moves first.
 *
 * The early-release notice under the tagline is the shell's
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): it says, before anything is
 * saved, that this game's saves may be reset while it is in early release.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { CIRCLE, CROSS, DIFFICULTIES, type Difficulty } from '../../game';
import { useNestedTicTacToe } from '../../state/GameContext';
import { NestedMark } from '../components/NestedMark';

export function NestedTicTacToeHomeScreen(together: PlayTogetherProps = {}) {
  const {
    navigate,
    session,
    stats,
    canResume,
    playerGoesFirst,
    setPlayerGoesFirst,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useNestedTicTacToe();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = canResume && session ? session : null;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame();
      return;
    }
    // Replacing a match in progress is the one thing worth a question.
    if (current) setPending(difficulty);
    else startNewGame(difficulty);
  };

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="nested-tic-tac-toe" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="nested-tic-tac-toe" />
        </span>
        <h1 className="home-title">{t('nestedTicTacToeName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="nested-tic-tac-toe" />
      </div>

      <div className="home-actions">
        <p className="nt-choose-label">{t('nestedTicTacToeChooseOpponent')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          // The record so far, stated once and quietly — never a target.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('nestedTicTacToeRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`nestedTicTacToeDifficulty_${difficulty}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        <div
          className="nt-side-choice"
          role="radiogroup"
          aria-label={t('nestedTicTacToeChooseSideLabel')}
        >
          <button
            type="button"
            role="radio"
            aria-checked={playerGoesFirst}
            aria-label={t('nestedTicTacToePlayFirstLabel')}
            className={`nt-side-option ${playerGoesFirst ? 'nt-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(true)}
          >
            <NestedMark mark={CROSS} className="nt-side-mark" />
            {t('nestedTicTacToePlayFirst')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerGoesFirst}
            aria-label={t('nestedTicTacToePlaySecondLabel')}
            className={`nt-side-option ${!playerGoesFirst ? 'nt-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(false)}
          >
            <NestedMark mark={CIRCLE} className="nt-side-mark" />
            {t('nestedTicTacToePlaySecond')}
          </button>
        </div>

        <PlayTogetherButton {...together} />

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
        open={pending !== null}
        title={t('nestedTicTacToeConfirmSwitchTitle')}
        body={
          pending
            ? t('nestedTicTacToeConfirmSwitchBody', {
                current: t(`nestedTicTacToeDifficulty_${current?.difficulty ?? pending}`),
                next: t(`nestedTicTacToeDifficulty_${pending}`),
              })
            : ''
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) startNewGame(next);
        }}
      />
    </div>
  );
}
