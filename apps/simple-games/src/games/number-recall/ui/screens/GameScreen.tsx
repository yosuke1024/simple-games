/**
 * The Number Recall game screen (docs/NUMBER_RECALL_RULES.md §3, §5).
 *
 * Above the board sits one line that changes once: while the tiles are showing
 * it says "tap 1 when you are ready", and after that it says which number is
 * wanted next. There is no countdown in either state, and no clock anywhere —
 * the time is recorded and shown at the end (§5).
 *
 * There is no undo and no hint, by design (§10). A tap is the claim "I remember
 * where that was"; taking it back would make the round a search, and pointing
 * at the next tile would be the answer itself. A new layout at the same level
 * is free and instant instead (§8).
 */
import { useCallback } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack } from '@/ui/components/icons';
import { isMemorising, nextTarget } from '../../game';
import { useRecall } from '../../state/GameContext';
import { RecallBoard } from '../components/RecallBoard';
import { RecallResultOverlay } from '../components/RecallResultOverlay';
import { RecallRevealPanel } from '../components/RecallRevealPanel';

export function RecallGameScreen() {
  const { session, lastResult, tap, goHome, retryRound, startNextLevel } = useRecall();
  const { t } = useSettings();

  const onCellTap = useCallback(
    (index: number) => {
      // A tap on an empty cell or a tile already up is not part of the
      // question and is answered with nothing at all (§3).
      if (!tap(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [tap],
  );

  if (!session) return null;

  const cleared = session.status === 'cleared';
  const missed = session.status === 'failed';
  const memorising = isMemorising(session);
  const target = nextTarget(session);

  return (
    <div className="screen game-screen">
      {/* Only the win is inert behind a dialog. A missed round stays live
          because its board *is* the answer being shown (§4), and its panel
          sits in the flow below rather than on top. Taps are harmless either
          way — the engine ignores them once a round is over. */}
      <div className="game-content" inert={cleared}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="recall-status">
            <span className="recall-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span>
              {session.revealedCount} / {session.tileCount}
            </span>
          </div>
          <span className="icon-btn-placeholder" />
        </header>

        <div className="recall-body">
          {/* One line, two states. Announced politely rather than
              interrupting, so a screen reader hears each number as it comes. */}
          <p className="recall-prompt" aria-live="polite">
            {memorising ? (
              <span className="recall-prompt-memorise">{t('recallMemorise')}</span>
            ) : (
              <>
                <span className="recall-prompt-label">{t('recallNext')}</span>
                <span className="recall-prompt-value">{target ?? ''}</span>
              </>
            )}
          </p>

          <RecallBoard session={session} onCellTap={onCellTap} />
        </div>

        {/* In the flow, under the board: it pushes the board up instead of
            covering the tile it has just ringed (§4). */}
        {missed ? <RecallRevealPanel onRetry={retryRound} onHome={goHome} /> : null}

        <BannerSlot />
      </div>

      <RecallResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={retryRound}
        onNextLevel={startNextLevel}
        onHome={goHome}
      />
    </div>
  );
}
