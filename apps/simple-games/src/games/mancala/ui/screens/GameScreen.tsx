/**
 * The Mancala game screen (docs/MANCALA_RULES.md §2, §5, §10).
 *
 * No clock, and no score beyond the two stores the board already shows: the
 * position is the whole state, and one fixed turn line says whose move it is
 * — including the extra turn, which is the one moment the turn does not pass
 * (§2.1).
 *
 * One action, free and unlimited: Undo (§5). There is no hint — the whole
 * board is visible, and a suggested pit would be the CPU playing both sides
 * (§6).
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, CPU, PITS_PER_SIDE, PLAYER } from '../../game';
import { useMancala } from '../../state/GameContext';
import { MancalaBoard } from '../components/MancalaBoard';
import { MancalaResultOverlay } from '../components/MancalaResultOverlay';

export function MancalaGameScreen() {
  const { session, stats, playPit, applyUndo, goHome, startNewGame } = useMancala();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const onPlay = useCallback(
    (pit: number) => {
      const move = playPit(pit);
      if (!move) return;
      // A capture is the one move worth a different sound (§10).
      if (move.captured > 0) sounds.match();
      else sounds.select();
      void haptics.tap();
    },
    [playPit],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  // The CPU's moves arrive outside any tap of ours, so their sounds are
  // played off the move record. One effect run per move: each move is a new
  // record, and an undone or resumed board has none.
  const lastMove = session?.lastMove ?? null;
  useEffect(() => {
    if (lastMove?.by !== CPU) return;
    if (lastMove.captured > 0) sounds.match();
    else sounds.select();
  }, [lastMove]);

  const status = session?.status;
  useEffect(() => {
    if (status === 'won') {
      sounds.clear();
      void haptics.clear();
    } else if (status === 'lost' || status === 'draw') {
      sounds.gameOver();
      void haptics.invalid();
    }
  }, [status]);

  /* Keyboard as an adapter over the same taps (issue #93): 1–6 sow the
     player's pits left to right exactly when those buttons are enabled, and
     Ctrl/Cmd+Z takes back what the Undo button would. Nothing answers once
     the match ends or the new-game dialog is up. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    const digit = Number(event.key);
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      Number.isInteger(digit) &&
      digit >= 1 &&
      digit <= PITS_PER_SIDE
    ) {
      if (!event.repeat && session.toMove === PLAYER) onPlay(digit - 1);
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmNewGame);

  if (!session) return null;

  const over = session.status !== 'playing';
  const playersTurn = session.toMove === PLAYER && !over;
  const justEarned = playersTurn && session.lastMove?.by === PLAYER;
  const turnText = over
    ? ''
    : playersTurn
      ? justEarned
        ? t('mancalaExtraTurn')
        : t('mancalaYourTurn')
      : t('mancalaCpuTurn');
  const captured = session.lastMove && session.lastMove.captured > 0 ? session.lastMove : null;
  const captureText = captured
    ? captured.by === PLAYER
      ? t('mancalaCaptureYou', { n: captured.captured })
      : t('mancalaCaptureCpu', { n: captured.captured })
    : '';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="mc-status">
            <span className="mc-side">
              <span className="mc-mark mc-mark-you" aria-hidden="true" />
              {t('mancalaYou')}
            </span>
            <span className="mc-side">
              <span className="mc-mark mc-mark-cpu" aria-hidden="true" />
              {t('mancalaCpu')}
            </span>
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

        <div className="mc-body">
          <MancalaBoard
            pits={session.pits}
            playable={playersTurn}
            lastMove={session.lastMove}
            onPlay={onPlay}
          />
          {/* One line, always present, so the board never jumps (§10). A
              capture is named at its head, then whose move it is now. */}
          <p className="mc-turn-line" role="status">
            {captureText && turnText ? `${captureText} · ${turnText}` : captureText || turnText}
          </p>
        </div>

        <div className="action-bar mc-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={!canUndo(session)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <MancalaResultOverlay
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
