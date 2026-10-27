/**
 * Home: three opponents, and nothing between the player and the first throw.
 * There is no level list — the game has no progression to walk through; every
 * match starts with all sixteen pawns in their yards.
 *
 * There is no seat to choose either. You sit at the bottom of the board and
 * the three CPU seats are to your left, across and to your right, and you
 * always throw first — that is fixed by rule rather than by a seed
 * (docs/LUDO_RULES.md §2.1), which is also what gives a restored match a
 * starting point to count from (§10).
 *
 * The match slot holds one match, so replacing one is the one thing here worth
 * asking about first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart } from '@/ui/components/icons';
import { PlayTogetherButton, type PlayTogetherProps } from '@/ui/components/PlayTogetherButton';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useLudo } from '../../state/GameContext';

export function LudoHomeScreen(together: PlayTogetherProps = {}) {
  const {
    navigate,
    session,
    stats,
    canResume,
    difficulty,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useLudo();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = canResume && session ? session : null;

  const choose = (next: Difficulty) => {
    if (current && current.difficulty === next) {
      resumeGame();
      return;
    }
    // Replacing a match in progress is the one thing worth a question.
    if (current) setPending(next);
    else startNewGame(next);
  };

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="ludo" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="ludo" />
        </span>
        <h1 className="home-title">{t('ludoName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="ld-choose-label">{t('ludoChooseOpponent')}</p>

        {DIFFICULTIES.map((level) => {
          const record = stats[level];
          const isCurrent = current?.difficulty === level;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses > 0
              ? t('ludoRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          // The match in progress leads; with none, the opponents last played
          // against do, so coming back lands on the usual game.
          const leads = current ? isCurrent : difficulty === level;
          return (
            <button
              key={level}
              type="button"
              className={`btn ${leads ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(level)}
            >
              {t(`ludoDifficulty_${level}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

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
        title={t('ludoConfirmSwitchTitle')}
        body={
          pending
            ? t('ludoConfirmSwitchBody', {
                current: t(`ludoDifficulty_${current?.difficulty ?? pending}`),
                next: t(`ludoDifficulty_${pending}`),
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
