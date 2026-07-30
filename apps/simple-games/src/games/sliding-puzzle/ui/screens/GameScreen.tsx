/**
 * The Sliding Puzzle game screen (docs/SLIDING_PUZZLE_RULES.md §3, §4, §8).
 *
 * The move count is on screen because it is the puzzle's own measure. The clock
 * is not: it is recorded and shown on the clear screen instead, so nothing here
 * pushes the player to hurry.
 *
 * There is no hint button, by design (§8). Every tile is already visible and
 * nothing is logically hidden; a "next best move" would be the app solving the
 * puzzle. Undo and Restart are the way out of a tangle, and both are free.
 */
import { useCallback, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { useSlidingPuzzle } from '../../state/GameContext';
import { SlidingBoard } from '../components/SlidingBoard';
import { SlidingPuzzleResultOverlay } from '../components/SlidingPuzzleResultOverlay';

export function SlidingPuzzleGameScreen() {
  const {
    session,
    lastResult,
    tapTile,
    applyUndo,
    goHome,
    restartCurrent,
    startNextLevel,
  } = useSlidingPuzzle();
  const { t } = useSettings();
  const [confirmRestart, setConfirmRestart] = useState(false);

  const onTileTap = useCallback(
    (index: number) => {
      // An illegal tap changes nothing and says nothing (§3): the board is
      // fully visible, so there is no mistake to explain.
      if (!tapTile(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [tapTile],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  if (!session) return null;

  const solved = session.status === 'solved';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={solved}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="slide-status">
            <span className="slide-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span>{t('slideSizeLabel', { n: session.size })}</span>
            <span className="slide-move-count">
              {t('slideMoves')} {session.moveCount}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="slide-body">
          <SlidingBoard tiles={session.tiles} size={session.size} onTileTap={onTileTap} />
        </div>

        <div className="action-bar slide-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={session.history.length === 0}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <SlidingPuzzleResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNextLevel={startNextLevel}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmRestart}
        title={t('tryAgain')}
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
