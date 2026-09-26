/**
 * The end of a board (docs/NUMBER_PATH_RULES.md §2, §8).
 *
 * There is only one ending — the path is complete — so this is one quiet
 * card: the time it took, the hints taken, the record it stands against, and
 * the same board offered straight back. Nothing here scolds and nothing here
 * sells a second chance.
 */
import { useSettings } from '@/state/SettingsContext';
import type { ShareDetail } from '@/services/share/message';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { NumberPathSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface NumberPathResultOverlayProps {
  session: NumberPathSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function NumberPathResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: NumberPathResultOverlayProps) {
  const { t } = useSettings();
  // The finished path gets its beat before the card covers it (§11).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  const title = t('numberPathSolvedTitle');
  // A daily is one board a day: there is no other board to offer (§7).
  const canStartNew = session.mode === 'difficulty';

  const details: ShareDetail[] = [
    { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
    { label: t('numberPathHintsUsed'), value: String(session.hintCount) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{t('numberPathSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('numberPathHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('numberPathNewBestTime')}
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
          {canStartNew ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('numberPathNewBoard')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="number-path" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
