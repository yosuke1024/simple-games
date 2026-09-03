/**
 * The clear screen (docs/MEMORY_MATCH_RULES.md §4, §9). Moves and time — the
 * facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone trying to remember. There
 * is no score, and a personal best is mentioned quietly rather than
 * celebrated.
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import type { ShareDetail } from '@/services/share/message';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { MemorySession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface MemoryResultOverlayProps {
  session: MemorySession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onHome: () => void;
}

export function MemoryResultOverlay({
  session,
  lastResult,
  onRetry,
  onHome,
}: MemoryResultOverlayProps) {
  const { t } = useSettings();
  // The face-up board gets its beat before the card covers it (§12).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  const details: ShareDetail[] = [
    { label: t('movesLabel'), value: String(session.moveCount) },
    { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('memoryClearTitle')}
      >
        <h2 className="dialog-title">{t('memoryClearTitle')}</h2>
        <p className="dialog-body">{t('memoryClearBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestMoves ? (
          <p className="dialog-body">
            {t('memoryNewBestMoves')}
            <BestDelta
              value={lastResult.moves}
              previous={lastResult.previousBestMoves}
              kind="count"
            />
          </p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('memoryBestMoves')} {lastResult.bestMoves}
            <BestDelta
              value={lastResult.moves}
              previous={lastResult.previousBestMoves}
              kind="count"
            />
          </p>
        ) : null}

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">
            {t('memoryNewBestTime')}
            <BestDelta
              value={lastResult.seconds}
              previous={lastResult.previousBestSeconds}
              kind="time"
            />
          </p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(lastResult.bestSeconds)}
            <BestDelta
              value={lastResult.seconds}
              previous={lastResult.previousBestSeconds}
              kind="time"
            />
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="memory-match" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
