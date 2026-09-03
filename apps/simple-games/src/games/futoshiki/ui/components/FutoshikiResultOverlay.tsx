/**
 * The clear screen (docs/FUTOSHIKI_RULES.md §10). Time, mistakes and hints —
 * the facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone doing a puzzle, and the
 * mistake count only here because a counter on screen would turn "you may be
 * wrong" into pressure. Neither is added to the statistics (§5, §6, §10).
 *
 * There is no losing screen, because there is no losing (§2, §14).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { MAX_LEVEL, type FutoshikiSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface FutoshikiResultOverlayProps {
  session: FutoshikiSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  /** Free play's "next": another board at the same tier (§9). */
  onNewFree: () => void;
  onHome: () => void;
}

export function FutoshikiResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onNewFree,
  onHome,
}: FutoshikiResultOverlayProps) {
  const { t } = useSettings();
  // The finished board — every row, column and sign holding — gets its beat
  // before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  const hasNextLevel =
    session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;
  // A free board's "next" is another board at the same tier; a level's is the
  // next level; a daily has neither, and the retry leads.
  const hasNext = hasNextLevel || session.mode === 'free';

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('futoshikiSolvedTitle')}
      >
        <h2 className="dialog-title">{t('futoshikiSolvedTitle')}</h2>
        <p className="dialog-body">{t('futoshikiSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('futoshikiMistakes')}</dt>
            <dd>{session.mistakeCount}</dd>
          </div>
          <div>
            <dt>{t('futoshikiHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">
            {t('futoshikiNewBestTime')}
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
          {hasNextLevel ? (
            <button type="button" className="btn btn-primary" onClick={onNextLevel} autoFocus>
              {t('nextLevel')}
            </button>
          ) : session.mode === 'free' ? (
            <button type="button" className="btn btn-primary" onClick={onNewFree} autoFocus>
              {t('newGame')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${hasNext ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!hasNext}
          >
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="futoshiki"
          outcome="completed"
          details={[
            { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
            { label: t('futoshikiMistakes'), value: String(session.mistakeCount) },
            { label: t('futoshikiHintsUsed'), value: String(session.hintCount) },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
