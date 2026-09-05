/**
 * Home (docs/GOMOKU_RULES.md §1, §4): three opponents, a choice of colour,
 * and nothing between the player and the board. There is no level list — the
 * game has no progression to walk through; every match starts empty.
 *
 * The colour is a preference for the next match, not a switch on the current
 * one: a match keeps the colour it was started with until it ends (§1), so
 * changing this while one is in progress asks nothing and breaks nothing.
 * Black opens, so choosing a colour is also choosing first or second — the
 * buttons say so rather than assuming the player knows.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeActions } from '@/ui/components/GameHomeActions';
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useGomoku } from '../../state/GameContext';

export function GomokuHomeScreen() {
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
  } = useGomoku();
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
        <GameHomeActions gameId="gomoku" />
      </header>

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ⁙
        </div>
        <h1 className="home-title">{t('gomokuName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="gm-choose-label">{t('gomokuChooseOpponent')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('gomokuRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`gomokuDifficulty_${difficulty}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        <div className="gm-side-choice" role="radiogroup" aria-label={t('gomokuChooseSideLabel')}>
          <button
            type="button"
            role="radio"
            aria-checked={playerIsBlack}
            className={`gm-side-option ${playerIsBlack ? 'gm-side-option-on' : ''}`}
            onClick={() => setPlayerIsBlack(true)}
          >
            <span className="gm-side-stone gm-side-black" aria-hidden="true" />
            {t('gomokuPlayBlack')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerIsBlack}
            className={`gm-side-option ${!playerIsBlack ? 'gm-side-option-on' : ''}`}
            onClick={() => setPlayerIsBlack(false)}
          >
            <span className="gm-side-stone gm-side-white" aria-hidden="true" />
            {t('gomokuPlayWhite')}
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
        title={t('gomokuConfirmSwitchTitle')}
        body={
          pending
            ? t('gomokuConfirmSwitchBody', {
                current: t(`gomokuDifficulty_${current?.difficulty ?? pending}`),
                next: t(`gomokuDifficulty_${pending}`),
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
