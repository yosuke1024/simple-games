/**
 * The Memory Match game screen (docs/MEMORY_MATCH_RULES.md §3, §4, §8).
 *
 * The move count and the found-pair count are on screen because they are the
 * game's own measures. The clock is not: it is recorded and shown on the
 * clear screen instead, so nothing here pushes the player to hurry — and a
 * shown mismatch waits for the player, never for a timer (§3).
 *
 * There is no hint and no undo, by design (§8). The way out of a bad run is
 * the same board again, free, with everything it taught you still in your
 * head.
 */
import { useCallback, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { layoutOf } from '../../game';
import { useMemoryMatch } from '../../state/GameContext';
import { MemoryBoard } from '../components/MemoryBoard';
import { MemoryResultOverlay } from '../components/MemoryResultOverlay';

export function MemoryGameScreen() {
  const { session, lastResult, flipCard, goHome, restartCurrent } = useMemoryMatch();
  const { t } = useSettings();
  const [confirmRestart, setConfirmRestart] = useState(false);

  const onFlip = useCallback(
    (index: number) => {
      // An illegal tap changes nothing and says nothing (§3): the card is
      // already up or already found, and the board shows that.
      const outcome = flipCard(index);
      if (outcome === 'none') return;
      if (outcome === 'match') {
        sounds.match();
        void haptics.match();
      } else if (outcome === 'solved') {
        sounds.clear();
        void haptics.clear();
      } else {
        // A mismatch is not a mistake — no scolding tone, just the flip.
        sounds.select();
        void haptics.tap();
      }
    },
    [flipCard],
  );

  if (!session) return null;

  const layout = layoutOf(session);
  const solved = session.status === 'solved';
  const found = session.matched.filter(Boolean).length / 2;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={solved}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="mm-status">
            <span className="mm-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t(`memoryDifficulty_${session.difficulty}`)}
            </span>
            <span>
              {t('memoryPairsLabel')} {found}/{layout.pairs}
            </span>
            <span className="mm-move-count">
              {t('movesLabel')} {session.moveCount}
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

        <div className="mm-body">
          <MemoryBoard
            deck={session.deck}
            layout={layout}
            matched={session.matched}
            faceUp={session.faceUp}
            onFlip={onFlip}
          />
        </div>

        <BannerSlot />
      </div>

      <MemoryResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
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
