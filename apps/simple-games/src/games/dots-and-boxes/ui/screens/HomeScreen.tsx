/**
 * Home (docs/DOTS_AND_BOXES_RULES.md §1, §4): three boards, a choice of side,
 * and nothing between the player and the first line.
 *
 * The side is a preference for the next match, not a switch on the current
 * one: a match keeps the side it was started with until it ends (§1), so
 * changing this while one is in progress asks nothing and breaks nothing.
 *
 * The match slot holds one game, so picking a different board replaces it.
 * That is the one thing here worth asking about first. The board last picked
 * leads (§1), unless a match is already waiting.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { BOARD_SIZES, type BoardSize } from '../../game';
import { useDotsAndBoxes } from '../../state/GameContext';
import { BoxMark } from '../components/DotsAndBoxesBoard';
import { SIZE_KEY } from '../sizeKey';

export function DotsAndBoxesHomeScreen() {
  const {
    navigate,
    session,
    stats,
    preferredSize,
    canResume,
    playerGoesFirst,
    setPlayerGoesFirst,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useDotsAndBoxes();
  const { t } = useSettings();
  const [pending, setPending] = useState<BoardSize | null>(null);

  const current = canResume && session ? session : null;
  /** The button that leads: the match in progress, else the board remembered (§1). */
  const leading = current?.size ?? preferredSize;

  const choose = (size: BoardSize) => {
    if (current && current.size === size) {
      resumeGame();
      return;
    }
    // Replacing a match in progress is the one thing worth a question.
    if (current) setPending(size);
    else startNewGame(size);
  };

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="dots-and-boxes" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): a box with a dot inside. */}
        <div className="home-logo" aria-hidden="true">
          ⊡
        </div>
        <h1 className="home-title">{t('dotsAndBoxesName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="dots-and-boxes" />
      </div>

      <div className="home-actions">
        <p className="db-choose-label">{t('dotsAndBoxesChooseBoard')}</p>

        {BOARD_SIZES.map((size) => {
          const record = stats[size];
          const isCurrent = current?.size === size;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('dotsAndBoxesRecordNote', { wins: record.wins, losses: record.losses })
              : null;
          return (
            <button
              key={size}
              type="button"
              className={`btn ${size === leading ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(size)}
            >
              {t(SIZE_KEY[size])}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        {/* Two buttons rather than a switch: "first" and "second" are two
            named things, and a labelled toggle would have to say which way is
            on. Each carries the two seat marks in the order the seats move,
            so the choice is legible without reading it (§1). */}
        <div
          className="db-side-choice"
          role="radiogroup"
          aria-label={t('dotsAndBoxesChooseSideLabel')}
        >
          <button
            type="button"
            role="radio"
            aria-checked={playerGoesFirst}
            className={`db-side-option ${playerGoesFirst ? 'db-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(true)}
          >
            <span className="db-order" aria-hidden="true">
              <BoxMark owner="you" />
              <BoxMark owner="cpu" />
            </span>
            {t('dotsAndBoxesGoFirst')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!playerGoesFirst}
            className={`db-side-option ${!playerGoesFirst ? 'db-side-option-on' : ''}`}
            onClick={() => setPlayerGoesFirst(false)}
          >
            <span className="db-order" aria-hidden="true">
              <BoxMark owner="cpu" />
              <BoxMark owner="you" />
            </span>
            {t('dotsAndBoxesGoSecond')}
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
        title={t('dotsAndBoxesConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('dotsAndBoxesConfirmSwitchBody', {
                current: t(SIZE_KEY[current.size]),
                next: t(SIZE_KEY[pending]),
              })
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
