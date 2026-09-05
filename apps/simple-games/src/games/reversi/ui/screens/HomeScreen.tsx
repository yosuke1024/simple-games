/**
 * Home (docs/REVERSI_RULES.md §1, §5): three opponents, a choice of colour,
 * and nothing between the player and the board. There is no level list — the
 * game has no progression to walk through; every match starts even.
 *
 * Black opens, so the colour choice *is* the choice of moving first or
 * second, and the buttons say so rather than making the player know it. It is
 * a preference for the next match, not a switch on the current one: a match
 * keeps the colour it was started with until it ends (§1).
 *
 * The match slot holds one game, so picking a different opponent replaces
 * it. That is the one thing here worth asking about first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useReversi } from '../../state/GameContext';

export function ReversiHomeScreen() {
  const {
    navigate,
    session,
    stats,
    canResume,
    playerIsBlack,
    setPlayerIsBlack,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useReversi();
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
    <div className="screen home-screen">
      <GameHomeHeader gameId="reversi" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The series mark: a disc mid-flip. */}
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ◐
        </div>
        <h1 className="home-title">{t('reversiName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="rv-choose-label">{t('reversiChooseOpponent')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('reversiRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`reversiDifficulty_${difficulty}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        {/* Two buttons rather than a switch: black and white are two named
            things, and a labelled toggle would have to say which way is on.
            Each carries its own disc and says what taking it means — black
            opens, so the colour and the order are one choice (§1). */}
        <div className="rv-side-choice" role="radiogroup" aria-label={t('reversiChooseSideLabel')}>
          <button
            type="button"
            role="radio"
            aria-checked={playerIsBlack}
            className={`rv-side-option ${playerIsBlack ? 'rv-side-option-on' : ''}`}
            onClick={() => setPlayerIsBlack(true)}
          >
            <span className="rv-side-disc rv-disc-black" aria-hidden="true" />
            {t('reversiPlayBlack')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerIsBlack}
            className={`rv-side-option ${!playerIsBlack ? 'rv-side-option-on' : ''}`}
            onClick={() => setPlayerIsBlack(false)}
          >
            <span className="rv-side-disc rv-disc-white" aria-hidden="true" />
            {t('reversiPlayWhite')}
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
        title={t('reversiConfirmSwitchTitle')}
        body={
          pending
            ? t('reversiConfirmSwitchBody', {
                current: t(`reversiDifficulty_${current?.difficulty ?? pending}`),
                next: t(`reversiDifficulty_${pending}`),
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
