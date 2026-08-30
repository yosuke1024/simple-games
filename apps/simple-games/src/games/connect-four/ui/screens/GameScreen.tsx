/**
 * The Connect Four game screen (docs/CONNECT_FOUR_RULES.md §2, §5, §10).
 *
 * There is no score and no clock: the position is the whole state, and the
 * turn line says whose move it is (§7, §10).
 *
 * One action, free and unlimited: Undo (§5). There is no hint — the whole
 * board is visible, and a suggested column would be the CPU playing both
 * sides (§6).
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, CPU, PLAYER } from '../../game';
import { useConnectFour } from '../../state/GameContext';
import { ConnectFourBoard } from '../components/ConnectFourBoard';
import { ConnectFourResultOverlay } from '../components/ConnectFourResultOverlay';

export function ConnectFourGameScreen() {
  const { session, stats, lastMove, playColumn, applyUndo, goHome, startNewGame } =
    useConnectFour();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const onDrop = useCallback(
    (col: number) => {
      if (playColumn(col)) {
        sounds.select();
        void haptics.tap();
      }
    },
    [playColumn],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  // The CPU's reply arrives outside any tap of ours, so its sound is played
  // off the move record. One effect run per move: the counter is the identity.
  useEffect(() => {
    if (lastMove?.by === CPU) sounds.select();
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
     back the drop and the CPU's reply exactly when the button would —
     mirroring its disabled condition — and does nothing once the match ends
     or the new-game dialog is up. */
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
  const playersTurn = session.toMove === PLAYER && !over;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="c4-status">
            <span className="c4-side">
              <span className="c4-side-disc c4-side-you" aria-hidden="true" />
              {t('fourYou')}
            </span>
            <span className="c4-side">
              <span className="c4-side-disc c4-side-cpu" aria-hidden="true" />
              {t('fourCpu')}
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

        <div className="c4-body">
          <ConnectFourBoard
            board={session.board}
            playing={playersTurn}
            lastMove={lastMove}
            winningLine={session.winningLine}
            onDrop={onDrop}
          />
          {/* One line, always present, so the board never jumps (§10). */}
          <p className="c4-turn-line" role="status">
            {over ? '' : playersTurn ? t('fourYourTurn') : t('fourCpuTurn')}
          </p>
        </div>

        <div className="action-bar c4-actions">
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

      <ConnectFourResultOverlay
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
