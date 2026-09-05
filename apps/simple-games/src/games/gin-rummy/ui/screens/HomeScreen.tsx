/**
 * Home: three opponents, and nothing between the player and the deal. There is
 * no level list — the game has no progression to walk through; every match
 * starts nil-all.
 *
 * There is no side to choose either, unlike Reversi's colour: who deals the
 * first hand comes from the match's seed (game/session.ts), and after that it
 * is the last hand's winner. A picker would only be a picker for the coin
 * toss.
 *
 * The match slot holds one match, and a match runs to a hundred points across
 * many hands — so replacing one is the one thing here worth asking about
 * first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useGinRummy } from '../../state/GameContext';

export function GinRummyHomeScreen() {
  const {
    navigate,
    session,
    stats,
    canResume,
    difficulty,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useGinRummy();
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
    <div className="screen home-screen">
      <GameHomeHeader gameId="gin-rummy" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that was
            tapped, not like a second mark for the same game. Outlined rather
            than filled — the filled suits belong to the one-player patience
            shelf, the outlined ones to the two-player card games. */}
        <div className="home-logo" aria-hidden="true">
          ♢
        </div>
        <h1 className="home-title">{t('ginName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="gr-choose-label">{t('ginChooseOpponent')}</p>

        {DIFFICULTIES.map((level) => {
          const record = stats[level];
          const isCurrent = current?.difficulty === level;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses > 0
              ? t('ginRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          // The match in progress leads; with none, the opponent last played
          // against does, so coming back lands on the usual game.
          const leads = current ? isCurrent : difficulty === level;
          return (
            <button
              key={level}
              type="button"
              className={`btn ${leads ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(level)}
            >
              {t(`ginDifficulty_${level}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

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
        title={t('ginConfirmSwitchTitle')}
        body={
          pending
            ? t('ginConfirmSwitchBody', {
                current: t(`ginDifficulty_${current?.difficulty ?? pending}`),
                next: t(`ginDifficulty_${pending}`),
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
