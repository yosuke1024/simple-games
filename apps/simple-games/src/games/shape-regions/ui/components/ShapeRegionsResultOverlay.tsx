/**
 * The clear screen (docs/SHAPE_REGIONS_RULES.md §10). Time and hints — the
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
import type { ShapeRegionsSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface ShapeRegionsResultOverlayProps {
  session: ShapeRegionsSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function ShapeRegionsResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: ShapeRegionsResultOverlayProps) {
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
        aria-label={t('shapeRegionsSolvedTitle')}
      >
        <h2 className="dialog-title">{t('shapeRegionsSolvedTitle')}</h2>
        <p className="dialog-body">{t('shapeRegionsSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('shapeRegionsHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('shapeRegionsNewBestTime')}
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
          {canStartNew ? (
            <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
              {t('shapeRegionsNewBoard')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${canStartNew ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!canStartNew}
          >
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="shape-regions"
          outcome="completed"
          details={[
            { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
            { label: t('shapeRegionsHintsUsed'), value: String(session.hintCount) },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
