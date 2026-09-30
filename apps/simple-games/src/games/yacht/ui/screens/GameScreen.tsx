/**
 * The Yacht game screen (docs/YACHT_RULES.md §2, §5, §10): the dice, the Roll
 * button, and the sheet, top to bottom, fitted to a 360×640 screen without
 * scrolling.
 *
 * There is no clock: the top bar says which turn this is, and nothing else;
 * what both sheets add up to is the sheet's own total row (§10), where the
 * eye already is. There is no Undo and no Hint (§6) — three throws and the
 * sheet's preview of every open box are the help.
 *
 * The Roll button doubles as the turn's announcement (§10): on the CPU's
 * turn it reads "CPU's turn…" and is disabled, in the same slot and at the
 * same height the player's own Roll sits in, so nothing on screen jumps
 * while the CPU plays its beats (`CPU_DELAY_MS`, state/GameContext.tsx).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
  CATEGORIES,
  CATEGORY_COUNT,
  cpuTotalOf,
  DICE_COUNT,
  filledCount,
  outcomeOf,
  ROLLS_PER_TURN,
  statusOf,
  toMove,
  totalOf,
  turnsPlayed,
  type Category,
  type Scores,
} from '../../game';
import { useYacht } from '../../state/GameContext';
import { YachtDice } from '../components/YachtDice';
import { YachtResultOverlay } from '../components/YachtResultOverlay';
import { YachtSheet, type SheetFlash } from '../components/YachtSheet';

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
  const [flash, setFlash] = useState<SheetFlash | null>(null);

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
      // The player's own score can never be the box that finishes the match
      // (§1: the CPU always fills the last box, since the player leads by
      // at most one), so this is always "turn continues" (§10) — the
      // finished transition is the other effect below, off the sheets
      // themselves rather than off this tap.
      if (scoreCategory(category) !== null) {
        sounds.match();
        void haptics.match();
      }
    },
    [scoreCategory],
  );

  /**
   * The box that just filled, on either sheet, and the CPU's own sound for
   * filling one (§10) — its turn plays out inside state/GameContext.tsx's
   * timer, off no tap of ours, so this is the only place to notice it landed.
   * Diffs both sheets against the previous render's arrays; the player's own
   * fill already got its sound from `onScore` above, so only the CPU's gets
   * one here. Null refs mean "just mounted" — nothing to flash yet, even onto
   * a sheet resumed already part filled.
   */
  const prevScoresRef = useRef<Scores | null>(null);
  const prevCpuScoresRef = useRef<Scores | null>(null);
  useEffect(() => {
    if (!session) return;
    const prevScores = prevScoresRef.current;
    const prevCpuScores = prevCpuScoresRef.current;
    prevScoresRef.current = session.scores;
    prevCpuScoresRef.current = session.cpuScores;
    if (!prevScores || !prevCpuScores) return;
    const key = filledCount(session.scores) + filledCount(session.cpuScores);
    const playerIndex = CATEGORIES.findIndex(
      (_, i) => prevScores[i] === null && session.scores[i] !== null,
    );
    if (playerIndex !== -1) {
      setFlash({ seat: 'player', category: CATEGORIES[playerIndex]!, key });
      return;
    }
    const cpuIndex = CATEGORIES.findIndex(
      (_, i) => prevCpuScores[i] === null && session.cpuScores[i] !== null,
    );
    if (cpuIndex !== -1) {
      setFlash({ seat: 'cpu', category: CATEGORIES[cpuIndex]!, key });
      sounds.select();
    }
  }, [session]);

  // The finished transition, exactly once (Crown Grid's `previousStatus`
  // shape): a win clears, a loss or a draw is a plain game-over (§10).
  const previousStatusRef = useRef(session ? statusOf(session) : 'playing');
  useEffect(() => {
    if (!session) return;
    const status = statusOf(session);
    if (status === 'finished' && previousStatusRef.current === 'playing') {
      if (outcomeOf(session) === 'won') {
        sounds.clear();
        void haptics.clear();
      } else {
        sounds.gameOver();
      }
    }
    previousStatusRef.current = status;
  }, [session]);

  /* Keyboard as an adapter over the buttons (issue #93): 1–5 press a die,
     R presses Roll — each exactly when the button would answer, and nothing
     at all once the sheet is full, the new-game dialog is up, or it is the
     CPU's turn (the seat API already refuses those taps; the guard here is
     just as explicit, §10). The boxes are buttons already, reached with Tab
     and pressed with Enter or Space. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (toMove(session) !== 'player') return false;
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
  const isPlayersTurn = !over && toMove(session) === 'player';
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
            canHold={canHold(session, 'player')}
            lastRoll={lastRoll}
            onToggle={onToggle}
          />

          {isPlayersTurn ? (
            <button
              type="button"
              className="btn btn-primary yt-roll"
              onClick={onRoll}
              disabled={!canRoll(session, 'player')}
            >
              {t('yachtRoll')}
              <span className="btn-note">
                {t('yachtRollsLeft', { n: ROLLS_PER_TURN - session.rollsUsed })}
              </span>
            </button>
          ) : (
            <button type="button" className="btn btn-primary yt-roll" disabled>
              {t('yachtCpuTurn')}
            </button>
          )}

          <YachtSheet
            scores={session.scores}
            cpuScores={session.cpuScores}
            dice={session.dice}
            rolled={rolled}
            playing={isPlayersTurn && !confirmNewGame}
            onScore={onScore}
            flash={flash}
            total={totalOf(session)}
            cpuTotal={cpuTotalOf(session)}
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
