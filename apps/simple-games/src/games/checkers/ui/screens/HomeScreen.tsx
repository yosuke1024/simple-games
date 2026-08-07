/**
 * Home (docs/CHECKERS_RULES.md §1, §4): three opponents, a choice of side,
 * and nothing between the player and the board. There is no level list — the
 * game has no progression to walk through; every match starts from the same
 * twenty-four pieces.
 *
 * The side is a preference for the next match, not a switch on the current
 * one: a match keeps the side it was started with until it ends (§1), so
 * changing this while one is in progress asks nothing and breaks nothing.
 *
 * The match slot holds one game, so picking a different opponent replaces it.
 * That is the one thing here worth asking about first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useCheckers } from '../../state/GameContext';

export function CheckersHomeScreen() {
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
  } = useCheckers();
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
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. This game's
          board and result screens deliberately have none. */}
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
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ▚
        </div>
        <h1 className="home-title">{t('checkersName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="ck-choose-label">{t('checkersChooseOpponent')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('checkersRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`checkersDifficulty_${difficulty}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        {/* Two buttons rather than a switch: "first" and "second" are two
            named things, and a labelled toggle would have to say which way is
            on. Each carries the two pieces in the order they would move, so
            the choice is legible without reading it — and the player's piece
            stays its own colour either way, because only the order changes,
            never the side (§1). */}
        <div className="ck-side-choice" role="radiogroup" aria-label={t('checkersChooseSideLabel')}>
          <button
            type="button"
            role="radio"
            aria-checked={playerGoesFirst}
            className={`ck-side-option ${playerGoesFirst ? 'ck-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(true)}
          >
            <span className="ck-order" aria-hidden="true">
              <span className="ck-side-piece ck-side-you" />
              <span className="ck-side-piece ck-side-cpu" />
            </span>
            {t('checkersGoFirst')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerGoesFirst}
            className={`ck-side-option ${!playerGoesFirst ? 'ck-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(false)}
          >
            <span className="ck-order" aria-hidden="true">
              <span className="ck-side-piece ck-side-cpu" />
              <span className="ck-side-piece ck-side-you" />
            </span>
            {t('checkersGoSecond')}
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
        title={t('checkersConfirmSwitchTitle')}
        body={
          pending
            ? t('checkersConfirmSwitchBody', {
                current: t(`checkersDifficulty_${current?.difficulty ?? pending}`),
                next: t(`checkersDifficulty_${pending}`),
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
