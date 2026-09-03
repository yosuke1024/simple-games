/**
 * The clear screen (docs/TAKUZU_RULES.md §10). Time and hints — the facts of
 * the run. The time appears only here, because showing it while playing would
 * be a clock counting up at someone doing a puzzle. There is no losing screen,
 * because there is no losing (§2).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { MAX_LEVEL, type TakuzuSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface TakuzuResultOverlayProps {
  session: TakuzuSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  /** Free play's "next": another board at the same tier (§7). */
  onNewFree: () => void;
  onHome: () => void;
}

export function TakuzuResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onNewFree,
  onHome,
}: TakuzuResultOverlayProps) {
  const { t } = useSettings();
  // The filled board gets its beat before the card covers it (§13).
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
        aria-label={t('takuzuSolvedTitle')}
      >
        <h2 className="dialog-title">{t('takuzuSolvedTitle')}</h2>
        <p className="dialog-body">{t('takuzuSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('takuzuHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">
            {t('takuzuNewBestTime')}
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
      </div>
      <ResultAdSlot />
    </div>
  );
}
