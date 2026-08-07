/**
 * Home (docs/CONNECT_FOUR_RULES.md §1, §4): three opponents, a choice of
 * side, and nothing between the player and the board. There is no level list
 * — the game has no progression to walk through; every match starts empty.
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
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useConnectFour } from '../../state/GameContext';

export function ConnectFourHomeScreen() {
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
  } = useConnectFour();
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
        {/* The series mark: four discs in a line. */}
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ⁘
        </div>
        <h1 className="home-title">{t('fourName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="c4-choose-label">{t('fourChooseOpponent')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const record = stats[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('fourRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`fourDifficulty_${difficulty}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        {/* Two buttons rather than a switch: "first" and "second" are two
            named things, and a labelled toggle would have to say which way is
            on. Each carries the two discs in the order they would be dropped,
            so the choice is legible without reading it — and the player's
            disc stays its own colour either way, because only the order
            changes, never the side (§1). */}
        <div className="c4-side-choice" role="radiogroup" aria-label={t('fourChooseSideLabel')}>
          <button
            type="button"
            role="radio"
            aria-checked={playerGoesFirst}
            className={`c4-side-option ${playerGoesFirst ? 'c4-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(true)}
          >
            <span className="c4-order" aria-hidden="true">
              <span className="c4-side-disc c4-side-you" />
              <span className="c4-side-disc c4-side-cpu" />
            </span>
            {t('fourGoFirst')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerGoesFirst}
            className={`c4-side-option ${!playerGoesFirst ? 'c4-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(false)}
          >
            <span className="c4-order" aria-hidden="true">
              <span className="c4-side-disc c4-side-cpu" />
              <span className="c4-side-disc c4-side-you" />
            </span>
            {t('fourGoSecond')}
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
        title={t('fourConfirmSwitchTitle')}
        body={
          pending
            ? t('fourConfirmSwitchBody', {
                current: t(`fourDifficulty_${current?.difficulty ?? pending}`),
                next: t(`fourDifficulty_${pending}`),
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
