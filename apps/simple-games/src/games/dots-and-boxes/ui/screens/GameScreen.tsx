/**
 * The Dots and Boxes game screen (docs/DOTS_AND_BOXES_RULES.md §2, §5, §10).
 *
 * The score is the two box counts and nothing else, always in the top bar;
 * there is no clock (§7, §10). The turn line says whose line is next, and
 * says "another turn" when the player has just closed a box (§2).
 *
 * One action, free and unlimited: Undo (§5). There is no hint — the whole
 * board is visible, and a suggested line would be the CPU playing both sides
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
import { canUndo, countBoxes, CPU, PLAYER } from '../../game';
import { useDotsAndBoxes } from '../../state/GameContext';
import { BoxMark, DotsAndBoxesBoard } from '../components/DotsAndBoxesBoard';
import { DotsAndBoxesResultOverlay } from '../components/DotsAndBoxesResultOverlay';

export function DotsAndBoxesGameScreen() {
  const { session, stats, playEdge, applyUndo, goHome, startNewGame } = useDotsAndBoxes();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const onEdge = useCallback(
    (edge: number) => {
      const next = playEdge(edge);
      if (next === null) return;
      sounds.select();
      void haptics.tap();
      // A closed box is its own small event — unless it ended the match,
      // where the ending's sound says it instead (§10).
      if ((next.lastMove?.completed.length ?? 0) > 0 && next.status === 'playing') {
        sounds.match();
        void haptics.match();
      }
    },
    [playEdge],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  // The CPU's lines arrive outside any tap of ours, so their sounds are played
  // off the move record. One effect run per line: the record is the identity,
  // and the status only ever changes in the same render as a new record (a
  // line that ends the match, a new match, an undo), never on its own.
  const lastMove = session?.lastMove ?? null;
  const status = session?.status;
  useEffect(() => {
    if (lastMove?.by !== CPU) return;
    sounds.select();
    if (lastMove.completed.length > 0 && status === 'playing') sounds.match();
  }, [lastMove, status]);

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
     back the player's line and the CPU's run exactly when the button would —
     mirroring its disabled condition — and does nothing once the match ends
     or the new-game dialog is up. Lines themselves are ordinary buttons, so
     Tab and Enter already reach them (§10). */
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
  const { player, cpu } = countBoxes(session.board);
  const turnLine = over
    ? ''
    : !playersTurn
      ? t('dotsAndBoxesCpuTurn')
      : session.lastMove?.by === PLAYER && session.lastMove.completed.length > 0
        ? t('dotsAndBoxesAnotherTurn')
        : t('dotsAndBoxesYourTurn');

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div
            className="db-score"
            role="img"
            aria-label={t('dotsAndBoxesScoreLabel', { you: player, cpu })}
          >
            <span className="db-score-side db-score-you">
              <BoxMark owner="you" />
              {t('dotsAndBoxesYou')} {player}
            </span>
            <span className="db-score-dot" aria-hidden="true">
              ·
            </span>
            <span className="db-score-side db-score-cpu">
              <BoxMark owner="cpu" />
              {t('dotsAndBoxesCpu')} {cpu}
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

        <div className="db-body">
          <DotsAndBoxesBoard
            board={session.board}
            playersTurn={playersTurn}
            lastMove={session.lastMove}
            onEdge={onEdge}
          />
          {/* One line, always present, so the board never jumps (§10). */}
          <p className="db-turn-line" role="status">
            {turnLine}
          </p>
        </div>

        <div className="action-bar db-actions">
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

      <DotsAndBoxesResultOverlay
        session={session}
        stats={stats}
        onRematch={() => startNewGame(session.size)}
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
          startNewGame(session.size);
        }}
      />
    </div>
  );
}
