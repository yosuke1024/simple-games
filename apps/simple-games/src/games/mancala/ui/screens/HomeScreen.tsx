/**
 * Home (docs/MANCALA_RULES.md §1, §4): three opponents, a choice of side, and
 * nothing between the player and the board. There is no level list — the
 * game has no progression to walk through; every match starts from four
 * seeds a pit.
 *
 * The side is a preference for the next match, not a switch on the current
 * one: a match keeps the side it was started with until it ends (§1), so
 * changing this while one is in progress asks nothing and breaks nothing.
 *
 * The match slot holds one game, so picking a different opponent replaces
 * it. That is the one thing here worth asking about first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useMancala } from '../../state/GameContext';

export function MancalaHomeScreen() {
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
  } = useMancala();
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
      <GameHomeHeader gameId="mancala" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): a pit with a seed in it. */}
        <div className="home-logo" aria-hidden="true">
          ⊚
        </div>
        <h1 className="home-title">{t('mancalaName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="mancala" />
      </div>

      <div className="home-actions">
        <p className="mc-choose-label">{t('mancalaChooseOpponent')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('mancalaRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`mancalaDifficulty_${difficulty}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        {/* Two buttons rather than a switch: "first" and "second" are two
            named things, and a labelled toggle would have to say which way is
            on. Each carries the two seat marks in the order the seats move,
            so the choice is legible without reading it (§1). */}
        <div className="mc-side-choice" role="radiogroup" aria-label={t('mancalaChooseSideLabel')}>
          <button
            type="button"
            role="radio"
            aria-checked={playerGoesFirst}
            className={`mc-side-option ${playerGoesFirst ? 'mc-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(true)}
          >
            <span className="mc-order" aria-hidden="true">
              <span className="mc-mark mc-mark-you" />
              <span className="mc-mark mc-mark-cpu" />
            </span>
            {t('mancalaGoFirst')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerGoesFirst}
            className={`mc-side-option ${!playerGoesFirst ? 'mc-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(false)}
          >
            <span className="mc-order" aria-hidden="true">
              <span className="mc-mark mc-mark-cpu" />
              <span className="mc-mark mc-mark-you" />
            </span>
            {t('mancalaGoSecond')}
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
        title={t('mancalaConfirmSwitchTitle')}
        body={
          pending
            ? t('mancalaConfirmSwitchBody', {
                current: t(`mancalaDifficulty_${current?.difficulty ?? pending}`),
                next: t(`mancalaDifficulty_${pending}`),
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
