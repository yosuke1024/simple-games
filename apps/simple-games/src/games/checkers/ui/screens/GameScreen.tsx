/**
 * The Checkers game screen (docs/CHECKERS_RULES.md §2, §5, §6, §10).
 *
 * There is no score and no clock: the position is the whole state, and the
 * turn line says whose move it is (§7, §10).
 *
 * Picking up and putting down are separate taps, and the selection lives
 * here rather than in the session — it is a thing about this screen, not
 * about the match, and it disappears the moment the match moves on. A forced
 * sequence keeps the selection on the piece that must go on, so the second
 * jump is one tap rather than two (§2).
 *
 * One action, free and unlimited: Undo (§5). There is no hint — the whole
 * board is visible, and a suggested move would be the CPU playing both sides
 * (§6).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, currentMoves, CPU, PLAYER } from '../../game';
import { useCheckers } from '../../state/GameContext';
import { CheckersBoard } from '../components/CheckersBoard';
import { CheckersResultOverlay } from '../components/CheckersResultOverlay';

export function CheckersGameScreen() {
  const { session, stats, lastMove, playStep, applyUndo, goHome, startNewGame } = useCheckers();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const over = session ? session.status !== 'playing' : false;
  const playersTurn = session ? session.toMove === PLAYER && !over : false;

  // Everything the player may do right now, from the rules and nothing else.
  const moves = useMemo(() => (session ? currentMoves(session) : []), [session]);
  const movable = useMemo(
    () => (playersTurn ? [...new Set(moves.map((move) => move.from))] : []),
    [moves, playersTurn],
  );

  // Mid-sequence the piece is not a choice: the same one must jump on, so it
  // is held for the player rather than asking them to pick it again (§2).
  const forcedFrom = session?.pendingJumpFrom ?? null;
  useEffect(() => {
    if (forcedFrom !== null) setSelected(forcedFrom);
  }, [forcedFrom]);

  // A selection cannot outlive the position it was made in.
  useEffect(() => {
    if (!playersTurn) setSelected(null);
  }, [playersTurn]);

  const targets = useMemo(
    () =>
      selected === null
        ? []
        : moves.filter((move) => move.from === selected).map((move) => move.to),
    [moves, selected],
  );

  const onSquare = useCallback(
    (cell: number) => {
      if (!playersTurn) return;
      const move =
        selected === null ? null : moves.find((m) => m.from === selected && m.to === cell);
      if (move) {
        if (playStep(move)) {
          sounds.select();
          void haptics.tap();
        }
        return;
      }
      // Not a destination: either picking a piece up, or putting it back
      // down. Neither is a mistake, so neither makes a sound (§10).
      if (movable.includes(cell)) setSelected(cell === selected ? null : cell);
      else if (selected !== null && forcedFrom === null) setSelected(null);
    },
    [forcedFrom, movable, moves, playStep, playersTurn, selected],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) {
      setSelected(null);
      sounds.undo();
    }
  }, [applyUndo]);

  // The CPU's steps arrive outside any tap of ours, so their sounds are
  // played off the move record. One effect run per step: the counter is the
  // identity, and a capture sounds different from a quiet move.
  useEffect(() => {
    if (lastMove?.by !== CPU) return;
    if (lastMove.move.captured !== -1) sounds.match();
    else sounds.select();
  }, [lastMove]);

  // The player's own captures, likewise: the tap plays `select`, and a jump
  // adds the capture on top of it.
  useEffect(() => {
    if (lastMove?.by !== PLAYER) return;
    if (lastMove.move.captured !== -1) sounds.match();
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
     new-game dialog is up. */
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

  const mustCapture = moves.length > 0 && moves[0]!.captured !== -1;
  const turnLine = over
    ? ''
    : !playersTurn
      ? t('checkersCpuTurn')
      : forcedFrom !== null
        ? t('checkersJumpAgain')
        : mustCapture
          ? t('checkersMustCapture')
          : t('checkersYourTurn');

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="ck-status">
            <span className="ck-side">
              <span className="ck-side-piece ck-side-you" aria-hidden="true" />
              {t('checkersYou')}
            </span>
            <span className="ck-side">
              <span className="ck-side-piece ck-side-cpu" aria-hidden="true" />
              {t('checkersCpu')}
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

        <div className="ck-body">
          <CheckersBoard
            board={session.board}
            selected={selected}
            targets={targets}
            movable={movable}
            playing={playersTurn}
            lastMove={lastMove}
            onSquare={onSquare}
          />
          {/* One line, always present, so the board never jumps (§10). */}
          <p className="ck-turn-line" role="status">
            {turnLine}
          </p>
        </div>

        <div className="action-bar ck-actions">
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

      <CheckersResultOverlay
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
