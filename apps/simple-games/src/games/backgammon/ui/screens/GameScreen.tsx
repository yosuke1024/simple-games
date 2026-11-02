/**
 * The Backgammon game screen (docs/BACKGAMMON_RULES.md §2, §5, §6, §7, §11).
 *
 * There is no score and no clock: the position is the whole state, the pip
 * counts beside it are facts of that position (§7), and the one line under
 * the board says whose move it is. The dice are the player's button while
 * the throw is theirs (§2.1); a turn ends by itself when nothing more can be
 * played (§2.5), and 待った takes back a step of the turn in progress (§6).
 *
 * Two rules of the frame (src/test/modalIsolationWiring.test.ts): while the
 * result or the new-game dialog is up, `.game-content` is inert and the
 * keyboard adapter is disabled on the same flags.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndoStep, currentAllowedSteps } from '../../game/session';
import { CPU, pipCount, PLAYER, type Step } from '../../game/types';
import { useBackgammon } from '../../state/GameContext';
import { BackgammonBoard } from '../components/BackgammonBoard';
import { Dice } from '../components/Dice';
import { BackgammonResultOverlay } from '../components/ResultOverlay';
import { useBackgammonSelection } from '../useBackgammonSelection';

export function BackgammonGameScreen() {
  const { session, stats, lastStep, roll, playStep, applyUndo, goHome, startNewGame } =
    useBackgammon();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const over = session ? session.status !== 'playing' : false;
  const phase = session?.phase ?? null;
  const playersMove =
    !over && phase !== null && phase.kind === 'moving' && phase.side === PLAYER;
  const canRoll =
    !over &&
    phase !== null &&
    (phase.kind === 'opening' || (phase.kind === 'awaitingRoll' && phase.side === PLAYER));

  // Everything the player may do right now, from the rules and nothing else (§7).
  const steps = useMemo(
    () => (session && playersMove ? currentAllowedSteps(session) : []),
    [session, playersMove],
  );
  const play = useCallback(
    (step: Step) => {
      if (!playStep(step)) return false;
      sounds.select();
      void haptics.tap();
      return true;
    },
    [playStep],
  );
  const { selected, targets, movable, onPoint, clearSelection } = useBackgammonSelection(
    playersMove && !confirmNewGame,
    steps,
    play,
  );

  const onRoll = useCallback(() => {
    if (roll()) {
      sounds.select();
      void haptics.tap();
    }
  }, [roll]);

  const onUndo = useCallback(() => {
    if (applyUndo()) {
      clearSelection();
      sounds.undo();
    }
  }, [applyUndo, clearSelection]);

  // The CPU's steps arrive outside any tap of ours, so their sounds are
  // played off the step record; the player's tap already played `select`,
  // and a hit adds the capture on top of it either way (§11).
  useEffect(() => {
    if (lastStep === null) return;
    if (lastStep.hit) sounds.match();
    else if (lastStep.by === CPU) sounds.select();
  }, [lastStep]);

  const status = session?.status;
  useEffect(() => {
    if (status === 'won') {
      sounds.clear();
      void haptics.clear();
    } else if (status === 'lost' || status === 'noResult') {
      sounds.gameOver();
      void haptics.invalid();
    }
  }, [status]);

  /* Keyboard as an adapter over the buttons (issue #93): Ctrl/Cmd+Z and U
     take back a step exactly when the button would, R throws when the dice
     are the player's, and nothing happens once the match ends or a dialog
     is up. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event) || event.key === 'u' || event.key === 'U') {
      if (!event.repeat && canUndoStep(session)) onUndo();
      return true;
    }
    if (event.key === 'r' || event.key === 'R') {
      if (!event.repeat && canRoll) onRoll();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && !over && !confirmNewGame);

  if (!session || phase === null) return null;

  const passed = session.lastTurn?.passed === true && phase.kind === 'awaitingRoll';
  const justOpened =
    session.opening !== null && session.turns.length === 0 && session.lastTurn === null;
  const remaining = phase.kind === 'moving' ? phase.dice.length : 0;
  // The faces of the roll on the table, so the live line announces them (§11):
  // the dice picture itself is not a live region.
  const faces = session.lastRoll
    ? t('backgammonDiceLabel', { a: session.lastRoll.roll[0], b: session.lastRoll.roll[1] })
    : '';
  const turnLine = over
    ? ''
    : passed
      ? `${faces} · ${session.lastTurn?.side === PLAYER ? t('backgammonNoMoveYou') : t('backgammonNoMoveCpu')}`
      : phase.kind === 'opening'
        ? t('backgammonRollOpening')
        : justOpened && session.opening
          ? t(session.opening.winner === PLAYER ? 'backgammonOpeningYou' : 'backgammonOpeningCpu', {
              you: session.opening.player,
              cpu: session.opening.cpu,
            })
          : playersMove
            ? `${faces} · ${t('backgammonYourMove')} · ${t('backgammonDiceLeft', { count: remaining })}`
            : canRoll
              ? t('backgammonYourRoll')
              : phase.kind === 'moving'
                ? `${faces} · ${t('backgammonCpuMoving')}`
                : t('backgammonCpuTurn');

  const yourPips = pipCount(session.board, PLAYER);
  const cpuPips = pipCount(session.board, CPU);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t(`backgammonDifficulty_${session.difficulty}`)}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="bk-body">
          <div className="bk-info bk-info-cpu">
            <span className="bk-side">
              <span className="bk-side-piece bk-checker-cpu" aria-hidden="true" />
              {t('backgammonCpu')}
            </span>
            <span className="bk-fact">
              {t('backgammonOff')} <strong>{session.board.off[1]}</strong>
            </span>
            <span className="bk-fact">
              {t('backgammonPips')} <strong>{cpuPips}</strong>
            </span>
          </div>

          <BackgammonBoard
            board={session.board}
            selected={selected}
            targets={targets}
            movable={movable}
            playing={playersMove && !confirmNewGame}
            lastStep={lastStep}
            onPoint={onPoint}
          />

          <div className="bk-info bk-info-you">
            <span className="bk-side">
              <span className="bk-side-piece bk-checker-you" aria-hidden="true" />
              {t('backgammonYou')}
            </span>
            <span className="bk-fact">
              {t('backgammonOff')} <strong>{session.board.off[0]}</strong>
            </span>
            <span className="bk-fact">
              {t('backgammonPips')} <strong>{yourPips}</strong>
            </span>
          </div>

          {/* One line, always present, so the board never jumps (§11). */}
          <p className="bk-turn-line" role="status">
            {turnLine}
          </p>
        </div>

        <div className="action-bar bk-actions">
          <Dice
            roll={session.lastRoll?.roll ?? null}
            remaining={phase.kind === 'moving' ? phase.dice : []}
            canRoll={canRoll && !confirmNewGame}
            opening={phase.kind === 'opening'}
            rollKey={session.rollIndex}
            onRoll={onRoll}
          />
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={!canUndoStep(session)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('backgammonTakeBack')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <BackgammonResultOverlay
        session={session}
        stats={stats}
        onRematch={() => startNewGame(session.difficulty)}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame(session.difficulty);
        }}
      />
    </div>
  );
}
