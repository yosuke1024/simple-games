/**
 * The Yacht game screen (docs/YACHT_RULES.md §2, §9): the dice, the Roll
 * button, and the sheet, top to bottom, fitted to a 360×640 screen without
 * scrolling.
 *
 * There is no clock: the top bar says which turn this is and what the sheet
 * adds up to, and nothing else. There is no Undo and no Hint (§5) — three
 * throws and the sheet's preview of every open box are the help.
 */
import { useCallback, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import {
  canHold,
  canRoll,
  CATEGORY_COUNT,
  DICE_COUNT,
  ROLLS_PER_TURN,
  statusOf,
  totalOf,
  turnsPlayed,
  type Category,
} from '../../game';
import { useYacht } from '../../state/GameContext';
import { YachtDice } from '../components/YachtDice';
import { YachtResultOverlay } from '../components/YachtResultOverlay';
import { YachtSheet } from '../components/YachtSheet';

export function YachtGameScreen() {
  const {
    session,
    lastRoll,
    lastResult,
    rollDice,
    toggleHold,
    scoreCategory,
    goHome,
    startNewGame,
  } = useYacht();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const onRoll = useCallback(() => {
    if (rollDice()) {
      sounds.select();
      void haptics.tap();
    }
  }, [rollDice]);

  const onToggle = useCallback(
    (index: number) => {
      if (toggleHold(index)) void haptics.tap();
    },
    [toggleHold],
  );

  const onScore = useCallback(
    (category: Category) => {
      const status = scoreCategory(category);
      if (status === 'finished') {
        sounds.clear();
        void haptics.clear();
      } else if (status === 'playing') {
        sounds.match();
        void haptics.match();
      }
    },
    [scoreCategory],
  );

  /* Keyboard as an adapter over the buttons (issue #93): 1–5 press a die,
     R presses Roll — each exactly when the button would answer, and nothing
     at all once the sheet is full or the new-game dialog is up. The boxes are
     buttons already, reached with Tab and pressed with Enter or Space. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'r' || event.key === 'R') {
      if (!event.repeat) onRoll();
      return true;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= DICE_COUNT) {
      if (!event.repeat) onToggle(digit - 1);
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && statusOf(session) === 'playing' && !confirmNewGame);

  if (!session) return null;

  const over = statusOf(session) === 'finished';
  const rolled = session.rollsUsed > 0;
  const turn = Math.min(turnsPlayed(session) + 1, CATEGORY_COUNT);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="yt-status">
            <span className="yt-turn">{t('yachtTurnLine', { turn, count: CATEGORY_COUNT })}</span>
            <span className="game-score">{t('yachtTotalLine', { total: totalOf(session) })}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="yt-body">
          <YachtDice
            dice={session.dice}
            held={session.held}
            rolled={rolled}
            canHold={canHold(session)}
            lastRoll={lastRoll}
            onToggle={onToggle}
          />

          <button
            type="button"
            className="btn btn-primary yt-roll"
            onClick={onRoll}
            disabled={!canRoll(session)}
          >
            {t('yachtRoll')}
            <span className="btn-note">
              {t('yachtRollsLeft', { n: ROLLS_PER_TURN - session.rollsUsed })}
            </span>
          </button>

          <YachtSheet
            scores={session.scores}
            dice={session.dice}
            rolled={rolled}
            playing={!over}
            onScore={onScore}
          />
        </div>

        <BannerSlot />
      </div>

      <YachtResultOverlay
        session={session}
        lastResult={lastResult}
        onNewGame={startNewGame}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmNewGame}
        title={t('yachtConfirmReplaceTitle')}
        body={t('yachtConfirmReplaceBody', { turn, count: CATEGORY_COUNT })}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame();
        }}
      />
    </div>
  );
}
