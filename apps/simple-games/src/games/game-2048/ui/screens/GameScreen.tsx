/**
 * The 2048 game screen (docs/GAME_2048_RULES.md §4, §5, §10).
 *
 * No clock: the score and the score to beat sit in the top bar instead, which
 * is what 2048 is actually measured by (§4). No direction buttons either — a
 * swipe or an arrow key is the whole input (§10) — so the board keeps the
 * screen and the only action offered is Undo, free and unlimited (§5).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { AnimatedNumber } from '@/ui/components/AnimatedNumber';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { canUndo, slide, type Direction } from '../../game';
import { useGame2048 } from '../../state/GameContext';
import { BoardView } from '../components/BoardView';
import { Game2048ResultOverlay } from '../components/Game2048ResultOverlay';

/** Arrow keys move the board on a keyboard; nothing else does (§10). */
const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function Game2048GameScreen() {
  const {
    session,
    scoreToBeat,
    lastResult,
    lastMove,
    applyMove,
    applyUndo,
    dismissWin,
    goHome,
    restartCurrent,
  } = useGame2048();
  const { t } = useSettings();

  const [confirmRestart, setConfirmRestart] = useState(false);
  const previousStatus = useRef(session?.status ?? 'playing');
  const previousWon = useRef(session?.won ?? false);

  // Result feedback (sound / vibration) exactly once per transition (§10).
  useEffect(() => {
    const won = session?.won ?? false;
    if (won && !previousWon.current) {
      sounds.clear();
      void haptics.clear();
    }
    previousWon.current = won;

    const status = session?.status ?? 'playing';
    if (status !== previousStatus.current) {
      if (status === 'over') sounds.gameOver();
      previousStatus.current = status;
    }
  }, [session?.status, session?.won]);

  const onMove = useCallback(
    (direction: Direction) => {
      if (session === null) return;
      // Asked before the move, because after it the board has already changed:
      // a move that combined something gets the sound and the tap, and a plain
      // slide stays quiet (§10).
      const combined = slide(session.board, direction).gained > 0;
      if (!applyMove(direction)) return;
      if (!combined) return;
      sounds.match();
      void haptics.match();
    },
    [applyMove, session],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  // Keyboard play, for the web and for anything with a keyboard attached.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key];
      if (direction === undefined || event.metaKey || event.ctrlKey || event.altKey) return;
      // Arrow keys would otherwise scroll the screen under the board.
      event.preventDefault();
      onMove(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onMove]);

  if (!session) return null;

  const paused = session.status !== 'playing' || (session.won && !session.winAcknowledged);

  return (
    <div className="screen game-screen g2048-screen">
      {/* inert while a result dialog is up: nothing behind it is focusable or
          exposed to assistive technology. */}
      <div className="game-content" inert={paused}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">
              {session.mode === 'daily' ? t('modeDaily') : t('g2048ModeClassic')}
            </span>
            <span className="game-score">
              <span className="visually-hidden">{t('score')} </span>
              <AnimatedNumber value={session.score} />
            </span>
            {scoreToBeat > 0 ? (
              <span className="g2048-best">
                {t('best')} {scoreToBeat}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('g2048Restart')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="g2048-body">
          <BoardView board={session.board} lastMove={lastMove} onSwipe={onMove} />
        </div>

        <div className="action-bar">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={session.status !== 'playing' || !canUndo(session)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <Game2048ResultOverlay
        session={session}
        lastResult={lastResult}
        onKeepPlaying={dismissWin}
        onRestart={restartCurrent}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmRestart}
        title={t('g2048Restart')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          restartCurrent();
        }}
      />
    </div>
  );
}
