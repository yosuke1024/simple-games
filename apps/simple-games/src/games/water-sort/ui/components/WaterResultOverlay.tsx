/**
 * The clear screen (docs/WATER_SORT_RULES.md §4, §8, §9). Pours, time, and
 * hints — the facts of the run. The time appears only here, because showing
 * it while playing would be a clock counting up at someone thinking. Hints
 * are a fact, never a deduction: they were free (§8).
 */
import { useSettings } from '@/state/SettingsContext';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL, type WaterSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';

export interface WaterResultOverlayProps {
  session: WaterSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function WaterResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: WaterResultOverlayProps) {
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
        aria-label={t('waterSolvedTitle')}
      >
        <h2 className="dialog-title">{t('waterSolvedTitle')}</h2>
        <p className="dialog-body">{t('waterSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          {session.hintCount > 0 ? (
            <div>
              <dt>{t('waterHintsUsed')}</dt>
              <dd>{session.hintCount}</dd>
            </div>
          ) : null}
        </dl>

        {lastResult?.isNewBestMoves ? (
          <p className="dialog-body">{t('waterNewBestMoves')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('waterBestMoves')} {lastResult.bestMoves}
          </p>
        ) : null}

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">{t('waterNewBestTime')}</p>
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
