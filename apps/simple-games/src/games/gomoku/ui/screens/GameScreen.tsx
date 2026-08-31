/**
 * The Gomoku game screen (docs/GOMOKU_RULES.md §2, §5, §10).
 *
 * There is no score and no clock: the position is the whole state, and the
 * turn line says whose move it is (§7, §10).
 *
 * The aimed-at crossing lives here rather than in the session — it is a thing
 * about this screen, not about the match, and it disappears the moment the
 * match moves on. Two taps place a stone (§2): the first marks, the second
 * commits, and tapping elsewhere moves the mark.
 *
 * One action, free and unlimited: Undo (§5). There is no hint — the whole
 * board is visible, and a suggested point would be the CPU playing both sides
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
import { BLACK, canUndo, cpuColorOf } from '../../game';
import { useGomoku } from '../../state/GameContext';
import { GomokuBoard } from '../components/GomokuBoard';
import { GomokuResultOverlay } from '../components/GomokuResultOverlay';

export function GomokuGameScreen() {
  const { session, stats, lastMove, playCell, applyUndo, goHome, startNewGame } = useGomoku();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

  const over = session ? session.status !== 'playing' : false;
  const playersTurn = session ? session.toMove === session.playerColor && !over : false;

  // A mark cannot outlive the turn it was made in.
  useEffect(() => {
    if (!playersTurn) setPending(null);
  }, [playersTurn]);

  const onPoint = useCallback(
    (cell: number) => {
      if (!playersTurn) return;
      if (pending !== cell) {
        // Aiming. Not a move, so no sound — nothing has happened yet.
        setPending(cell);
        return;
      }
      if (playCell(cell)) {
        setPending(null);
        sounds.select();
        void haptics.tap();
      }
    },
    [pending, playCell, playersTurn],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) {
      setPending(null);
      sounds.undo();
    }
  }, [applyUndo]);

  // The CPU's reply arrives outside any tap of ours, so its sound is played
  // off the move record. One effect run per move: the counter is the identity.
  const cpuColor = session ? cpuColorOf(session) : null;
  useEffect(() => {
    if (lastMove && cpuColor !== null && lastMove.by === cpuColor) sounds.select();
  }, [lastMove, cpuColor]);

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
     back the stone and the CPU's reply exactly when the button would —
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
  useGameKeys(onKey, session !== null && !over && !confirmNewGame);

  if (!session) return null;

  const turnLine = over
    ? ''
    : !playersTurn
      ? t('gomokuCpuTurn')
      : pending !== null
        ? t('gomokuConfirmPrompt')
        : t('gomokuYourTurn');

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="gm-status">
            <span className="gm-side">
              <span
                className={`gm-side-stone ${session.playerColor === BLACK ? 'gm-side-black' : 'gm-side-white'}`}
                aria-hidden="true"
              />
              {t('gomokuYou')}
            </span>
            <span className="gm-side">
              <span
                className={`gm-side-stone ${session.playerColor === BLACK ? 'gm-side-white' : 'gm-side-black'}`}
                aria-hidden="true"
              />
              {t('gomokuCpu')}
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

        <div className="gm-body">
          <GomokuBoard
            board={session.board}
            playerColor={session.playerColor}
            pending={pending}
            playing={playersTurn}
            lastMove={lastMove}
            winningLine={session.winningLine}
            onPoint={onPoint}
          />
          {/* One line, always present, so the board never jumps (§10). */}
          <p className="gm-turn-line" role="status">
            {turnLine}
          </p>
        </div>

        <div className="action-bar gm-actions">
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

      <GomokuResultOverlay
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
