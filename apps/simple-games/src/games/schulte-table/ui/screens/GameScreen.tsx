/**
 * The Schulte Table game screen (docs/SCHULTE_TABLE_RULES.md §3, §4).
 *
 * The number to look for is on screen because remembering *what* comes next is
 * not what this game asks — finding *where* it is, is (that is Number Recall's
 * job). The clock is not on screen: it is recorded and shown at the finish
 * instead, so nothing here pushes the player to hurry.
 *
 * A wrong tap is silent (§3). No sound, no buzz, no flash — the board simply
 * does not move. Scolding a miss teaches people to stop tapping until they are
 * certain, which is the opposite of the thing being practised.
 *
 * There is no undo and no hint, by design (§9). Every number is already visible
 * and nothing is logically hidden; pointing at the next one would be the app
 * doing the searching. Retrying the same board is free and instant instead.
 */
import { useCallback, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { cellCount, nextTarget } from '../../game';
import { useSchulte } from '../../state/GameContext';
import { SchulteBoard } from '../components/SchulteBoard';
import { SchulteResultOverlay } from '../components/SchulteResultOverlay';

export function SchulteGameScreen() {
  const { session, lastResult, tap, goHome, restartCurrent, startNextLevel } = useSchulte();
  const { t } = useSettings();
  const [confirmRestart, setConfirmRestart] = useState(false);

  const onCellTap = useCallback(
    (index: number) => {
      // Only a hit is answered. A miss changes the counter and nothing else
      // (§3): the board is fully visible, so there is no mistake to explain.
      if (!tap(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [tap],
  );

  if (!session) return null;

  const cleared = session.status === 'cleared';
  const target = nextTarget(session);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={cleared}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="schulte-status">
            <span className="schulte-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span>
              {session.tappedCount} / {cellCount(session.size)}
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

        <div className="schulte-body">
          {/* The number being looked for. Announced politely rather than
              interrupting, so a screen reader hears each one as it comes. */}
          <p className="schulte-target" aria-live="polite">
            <span className="schulte-target-label">{t('schulteFind')}</span>
            <span className="schulte-target-value">{target ?? ''}</span>
          </p>

          <SchulteBoard session={session} onCellTap={onCellTap} />
        </div>

        <BannerSlot />
      </div>

      <SchulteResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNextLevel={startNextLevel}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmRestart}
        title={t('tryAgain')}
        body={t('schulteConfirmRestartBody')}
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
