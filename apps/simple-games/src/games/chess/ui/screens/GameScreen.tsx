/**
 * The Chess game screen (docs/CHESS_RULES.md §4, §6, §9): from the top, the
 * bar (Home · the side you play · ↻), the turn line, the board, and Undo.
 *
 * There is no score and no clock: the position is the whole state (§9). The
 * turn line says whose move it is, and that a king is in check — the board
 * marks the king's square with a dashed ring as well, so the check never rests
 * on colour or on the line alone. It has a fixed height so the board never
 * jumps.
 *
 * Picking up and putting down are separate taps, and the selection lives here
 * rather than in the session — it is a thing about this screen, not about the
 * game, and it goes the moment the game moves on. A promotion opens the
 * picker before anything is played (§4); cancelling it plays nothing and
 * keeps the pawn in hand.
 *
 * One action, free and unlimited: Undo (§6). There is no hint — the whole
 * board is visible, and a suggested move would be the CPU playing both sides.
 *
 * ↻ is "new game", asked through ConfirmDialog (the CPU boards' shape — not
 * the `tryAgain` header, src/test/restartDialogWiring.test.ts). While it, the
 * promotion picker or the result card is up, `.game-content` is inert and the
 * keys are off (src/test/modalIsolationWiring.test.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { WHITE, canUndo, isCapture, isInCheck, isOver, isPlayerTurn, statusOf } from '../../game';
import { useChess } from '../../state/GameContext';
import { useChessSelection } from '../useChessSelection';
import { ChessBoard } from '../components/ChessBoard';
import { PromotionPicker } from '../components/PromotionPicker';
import { ChessResultOverlay } from '../components/ResultOverlay';

export function ChessGameScreen() {
  const { session, lastMove, lastResult, playMove, applyUndo, goHome, startNewGame } = useChess();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const over = session ? isOver(session) : false;
  const playersTurn = session ? isPlayerTurn(session) : false;
  const selection = useChessSelection(
    session?.game.legal ?? [],
    playersTurn,
    `${session?.seed}:${session?.game.moves.length}`,
    (from, to, kind) => {
      if (playMove(from, to, kind)) {
        sounds.select();
        void haptics.tap();
      }
    },
  );
  const { selected, promotion, selectable, targets, onSquare } = selection;

  const onUndo = useCallback(() => {
    if (applyUndo()) {
      selection.clear();
      sounds.undo();
    }
  }, [applyUndo, selection]);

  // The CPU's move arrives outside any tap, so its sound is played off the
  // move record; a capture — either side's — adds `match` on top (§9). One
  // run per move: the ply count is the identity.
  useEffect(() => {
    if (!lastMove) return;
    if (lastMove.by === 'cpu') sounds.select();
    if (isCapture(lastMove.move)) sounds.match();
  }, [lastMove]);

  const status = session ? statusOf(session) : 'playing';
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
     its disabled condition — and does nothing once the game ends or a dialog
     is up. The squares are buttons: Tab reaches the pressable ones, Enter /
     Space presses them (§4). */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && !over && !confirmNewGame && promotion === null);

  if (!session) return null;

  const position = session.game.position;
  const inCheck = isInCheck(session);
  const checkSquare = inCheck ? position.kings[position.side]! : -1;
  const turnLine = over
    ? ''
    : playersTurn
      ? inCheck
        ? t('chessYourTurnCheck')
        : t('chessYourTurn')
      : inCheck
        ? t('chessCpuTurnCheck')
        : t('chessCpuTurn');

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame || promotion !== null}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">
            {session.playerColor === WHITE ? t('chessYouPlayWhite') : t('chessYouPlayBlack')}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="ch-body">
          <p className="ch-turn-line" role="status">
            {turnLine}
          </p>
          <ChessBoard
            board={position.board}
            flipped={session.playerColor !== WHITE}
            selected={selected}
            targets={targets}
            selectable={playersTurn ? selectable : []}
            checkSquare={checkSquare}
            playing={playersTurn}
            lastMove={lastMove}
            onSquare={onSquare}
          />
        </div>

        <div className="action-bar ch-actions">
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

      <ChessResultOverlay
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

      <PromotionPicker
        open={promotion !== null}
        color={session.playerColor}
        onPick={selection.pickPromotion}
        onCancel={selection.cancelPromotion}
      />
    </div>
  );
}
