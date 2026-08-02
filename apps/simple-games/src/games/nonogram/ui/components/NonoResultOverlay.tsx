/**
 * The clear screen (docs/NONOGRAM_RULES.md §8, §9). Time and hints — the facts
 * of the run. The time appears only here, because showing it while playing
 * would be a clock counting up at someone doing a puzzle. There is no losing
 * screen, because there is no losing (§2).
 */
import { useSettings } from '@/state/SettingsContext';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL, type NonogramSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';

export interface NonoResultOverlayProps {
  session: NonogramSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function NonoResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: NonoResultOverlayProps) {
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
        aria-label={t('nonoSolvedTitle')}
      >
        <h2 className="dialog-title">{t('nonoSolvedTitle')}</h2>
        <p className="dialog-body">{t('nonoSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('nonoHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">{t('nonoNewBestTime')}</p>
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
