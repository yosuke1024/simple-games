/**
 * The clear screen (docs/BOX_REGIONS_RULES.md §10). Time and hints — the
 * facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone doing a puzzle. There is no
 * losing screen, because there is no losing (§3).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { BoxRegionsSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface BoxRegionsResultOverlayProps {
  session: BoxRegionsSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function BoxRegionsResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: BoxRegionsResultOverlayProps) {
  const { t } = useSettings();
  // The finished board gets its beat before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  // A daily is one board a day: there is no other board to offer (§9).
  const canStartNew = session.mode === 'difficulty';

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('boxRegionsSolvedTitle')}
      >
        <h2 className="dialog-title">{t('boxRegionsSolvedTitle')}</h2>
        <p className="dialog-body">{t('boxRegionsSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('boxRegionsHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('boxRegionsNewBestTime')}
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
          {/* Retry leads and New board follows (§9): the same board again is the
              first offer, a fresh one the second, and the daily has no second. */}
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          {canStartNew ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('boxRegionsNewBoard')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="box-regions"
          outcome="completed"
          details={[
            { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
            { label: t('boxRegionsHintsUsed'), value: String(session.hintCount) },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
