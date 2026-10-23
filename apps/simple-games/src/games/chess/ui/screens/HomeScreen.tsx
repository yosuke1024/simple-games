/**
 * Home (docs/CHESS_RULES.md §1, §7.2): three opponents, the side for the next
 * game, and nothing between the player and the board. There is no level
 * list — every game starts from the same standard position.
 *
 * A difficulty button starts its game at once. With a game in progress, the
 * same difficulty resumes it, and a different one asks first — the slot holds
 * one game, so starting another replaces it (the four CPU boards' shape).
 *
 * The side is a preference for the next game, not a switch on the current
 * one (§1). Two buttons rather than a toggle, each with its king drawn beside
 * the words "White (moves first)" / "Black (moves second)": nobody has to know
 * that White opens.
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
import { DIFFICULTIES, KING, isOver, type Difficulty } from '../../game';
import { useChess } from '../../state/GameContext';
import { ChessPiece } from '../components/ChessPiece';

export function ChessHomeScreen() {
  const {
    navigate,
    session,
    stats,
    canResume,
    playerIsWhite,
    setPlayerIsWhite,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useChess();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = canResume && session && !isOver(session) ? session : null;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame();
      return;
    }
    // Replacing a game in progress is the one thing worth a question.
    if (current) setPending(difficulty);
    else startNewGame(difficulty);
  };

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="chess" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="chess" />
        </span>
        <h1 className="home-title">{t('chessName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="chess" />
      </div>

      <div className="home-actions">
        <p className="ch-choose-label">{t('chessChooseOpponent')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          // The record so far, stated once and quietly — never a target.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('chessRecordNote', {
                  wins: record.wins,
                  draws: record.draws,
                  losses: record.losses,
                })
              : null;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`chessDifficulty_${difficulty}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        <div className="ch-side-choice" role="radiogroup" aria-label={t('chessChooseSideLabel')}>
          <button
            type="button"
            role="radio"
            aria-checked={playerIsWhite}
            className={`ch-side-option ${playerIsWhite ? 'ch-side-option-on' : ''}`}
            onClick={() => setPlayerIsWhite(true)}
          >
            <span className="ch-side-piece">
              <ChessPiece kind={KING} white />
            </span>
            {t('chessPlayWhite')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerIsWhite}
            className={`ch-side-option ${!playerIsWhite ? 'ch-side-option-on' : ''}`}
            onClick={() => setPlayerIsWhite(false)}
          >
            <span className="ch-side-piece">
              <ChessPiece kind={KING} white={false} />
            </span>
            {t('chessPlayBlack')}
          </button>
        </div>

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
        title={t('chessConfirmSwitchTitle')}
        body={
          pending
            ? t('chessConfirmSwitchBody', {
                current: t(`chessDifficulty_${current?.difficulty ?? pending}`),
                next: t(`chessDifficulty_${pending}`),
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
