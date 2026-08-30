/**
 * The 2048 game screen (docs/GAME_2048_RULES.md §3, §6, §7, §12).
 *
 * The score is on screen because it is the result of what you just did, not a
 * target being counted down. The clock is not on screen at all: elapsed time
 * is recorded and never shown while playing (§12).
 *
 * One action, and it is free and unlimited: Undo (§6, §8). There is no hint —
 * the whole board is visible and nothing is hidden, so a "best move" button
 * would be the app playing instead of the player.
 */
import { useCallback, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { AnimatedNumber } from '@/ui/components/AnimatedNumber';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, type Direction } from '../../game';
import { useGame2048 } from '../../state/GameContext';
import { MergeBoard } from '../components/MergeBoard';
import { MergeResultOverlay } from '../components/MergeResultOverlay';

/** How long the score wears the accent after a merge moves it (§12). */
const SCORE_BUMP_MS = 260;

/** Arrow keys do what a swipe does — the board has four inputs, not two. */
const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export function Game2048GameScreen() {
  const {
    session,
    stats,
    lastResult,
    lastDirection,
    announceReached,
    dismissReached,
    slide,
    applyUndo,
    goHome,
    startNewGame,
  } = useGame2048();
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const bumpTimeout = useTransientTimeout();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [scoreBump, setScoreBump] = useState(false);

  const onSwipe = useCallback(
    (direction: Direction) => {
      const outcome = slide(direction);
      // An input that changes nothing is silent (§3): the board is fully
      // visible, so there is no mistake to point out.
      if (!outcome.moved) return;
      sounds.select();
      if (outcome.merged) {
        sounds.match();
        void haptics.tap();
        // Only a merge moves the score, so only a merge acknowledges it.
        if (!reducedMotion) {
          setScoreBump(true);
          bumpTimeout(() => setScoreBump(false), SCORE_BUMP_MS);
        }
      }
      if (outcome.over) {
        sounds.gameOver();
        void haptics.invalid();
      }
    },
    [bumpTimeout, reducedMotion, slide],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  // A dialog is over the board, so the board is not listening. `inert` covers
  // the pointer; a window-level key listener has to be told separately.
  const blocked = announceReached || confirmNewGame || session?.status === 'over';

  /* Keyboard as an adapter over onSwipe/onUndo above (issue #93): an arrow
     always swallows the key, even while blocked, so a held or mistimed one
     cannot scroll the page mid-game — but it only slides the board when
     nothing is blocking it, and repeat never replays a slide, because a move
     here is a turn like any other. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (!session) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && !blocked && canUndo(session)) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const direction = KEY_DIRECTIONS[event.key];
    if (!direction) return false;
    if (!blocked && !event.repeat) onSwipe(direction);
    return true;
  };
  useGameKeys(onKey, session !== null);

  if (!session) return null;

  const over = session.status === 'over';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || announceReached}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="tm-status">
            {/* The score counts up rather than jumping, and takes the accent
                for a beat when a merge moves it — the move's own small
                acknowledgement, with nothing added to the screen to say it. */}
            <span className={`tm-score ${scoreBump ? 'tm-score-bump' : ''}`}>
              {t('score')} <AnimatedNumber value={session.score} />
            </span>
            <span>
              {t('mergeBestScore')} {Math.max(stats.bestScore, session.score)}
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

        <div className="tm-body">
          <MergeBoard
            board={session.board}
            direction={lastDirection}
            moveCount={session.moveCount}
            onSwipe={onSwipe}
          />
        </div>

        <div className="action-bar tm-actions">
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

      <MergeResultOverlay
        session={session}
        lastResult={lastResult}
        announceReached={announceReached}
        onKeepGoing={dismissReached}
        onNewGame={startNewGame}
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
          startNewGame();
        }}
      />
    </div>
  );
}
