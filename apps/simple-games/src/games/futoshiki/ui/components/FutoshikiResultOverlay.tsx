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
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL, type FutoshikiSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface FutoshikiResultOverlayProps {
  session: FutoshikiSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function FutoshikiResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: FutoshikiResultOverlayProps) {
  const { t } = useSettings();
  if (session.status !== 'solved') return null;

  const hasNextLevel =
    session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;

  return (
    <div className="overlay">
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
          <p className="dialog-body">{t('futoshikiNewBestTime')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(lastResult.bestSeconds)}
          </p>
        ) : null}

        <div className="result-actions">
          {hasNextLevel ? (
            <button type="button" className="btn btn-primary" onClick={onNextLevel} autoFocus>
              {t('nextLevel')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${hasNextLevel ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!hasNextLevel}
          >
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
      <ResultAdSlot />
    </div>
  );
}
