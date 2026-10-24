/**
 * The Nested Tic-Tac-Toe game screen (docs/NESTED_TIC_TAC_TOE_RULES.md §2,
 * §5, §6, §10): from the top, the bar (Home · title · ↻), the turn line, the
 * board, and Undo.
 *
 * There is no score and no clock: the position is the whole state (§7, §10).
 * The turn line says whose move it is and, on the player's turn, where it may
 * go — the framed board, or any open board — in one place, at a fixed height
 * so the board never jumps (§6, §10). Help is Undo and the frames, both free
 * (§6). There is no hint: the whole board is visible, and a suggested move
 * would be the CPU playing both sides.
 *
 * ↻ is "new game", asked through ConfirmDialog (the CPU boards' shape — not
 * the `tryAgain` header, src/test/restartDialogWiring.test.ts). While it or
 * the result card is up, `.game-content` is inert and the keys are off
 * (src/test/modalIsolationWiring.test.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, isPlayerTurn, playerMark } from '../../game';
import { useNestedTicTacToe } from '../../state/GameContext';
import { NestedBoard } from '../components/NestedBoard';
import { NestedTicTacToeResultOverlay } from '../components/ResultOverlay';

export function NestedTicTacToeGameScreen() {
  const { session, lastMove, lastResult, playMove, applyUndo, goHome, startNewGame } =
    useNestedTicTacToe();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const onPlay = useCallback(
    (cell: number) => {
      if (playMove(cell)) {
        sounds.select();
        void haptics.tap();
      }
    },
    [playMove],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  // A move that takes its small board adds `match` on top of `select` — the
  // player's `select` came with the tap; the CPU's reply arrives outside any
  // tap, so both of its sounds are played here. One run per move: the move
  // record is the identity.
  useEffect(() => {
    if (!lastMove) return;
    if (lastMove.by === 'cpu') sounds.select();
    if (lastMove.took) sounds.match();
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

  /* Keyboard as an adapter over the Undo button (issue #93): Ctrl/Cmd+Z takes
     back the last decision point exactly when the button would — mirroring
     its disabled condition — and does nothing once the match ends or the
     new-game dialog is up. The cells are buttons: Tab reaches the playable
     ones, Enter / Space plays them. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmNewGame);

  if (!session) return null;

  const over = session.status !== 'playing';
  const playersTurn = isPlayerTurn(session);
  // Four things the line can say, and one of them is nothing: between the
  // decisive move and the card there is nothing to do (§10).
  const turnLine = over
    ? ''
    : !playersTurn
      ? t('nestedTicTacToeCpuTurn')
      : session.view.freeMove
        ? t('nestedTicTacToeYourTurnFree')
        : t('nestedTicTacToeYourTurnSent');

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('nestedTicTacToeName')}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="nt-body">
          <p className="nt-turn-line" role="status">
            {turnLine}
          </p>
          <NestedBoard
            view={session.view}
            playerMark={playerMark(session)}
            playersTurn={playersTurn}
            lastMove={lastMove}
            onPlay={onPlay}
          />
        </div>

        <div className="action-bar nt-actions">
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

      <NestedTicTacToeResultOverlay
        session={session}
        lastResult={lastResult}
        onNewGame={() => startNewGame(session.difficulty)}
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
