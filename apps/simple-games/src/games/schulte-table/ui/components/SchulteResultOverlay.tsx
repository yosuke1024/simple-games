/**
 * The finish screen (docs/SCHULTE_TABLE_RULES.md §4, §9).
 *
 * Time and wrong taps — the facts of the round. The time appears only here,
 * because a clock counting up at somebody searching a grid is the pressure
 * this genre is built to avoid. There is no score, and a personal best is
 * mentioned quietly rather than celebrated.
 *
 * Wrong taps are shown as a fact and never as a record: a "fewest misses" best
 * is set by tapping slowly, and keeping it would tell the player which of speed
 * and care the game wants (§9).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { MAX_LEVEL, type SchulteSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface SchulteResultOverlayProps {
  session: SchulteSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function SchulteResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: SchulteResultOverlayProps) {
  const { t } = useSettings();
  // The fully-found grid gets its beat before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'cleared');
  if (!revealed) return null;

  const hasNextLevel =
    session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('schulteDoneTitle')}
      >
        <h2 className="dialog-title">{t('schulteDoneTitle')}</h2>
        <p className="dialog-body">{t('schulteDoneBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('schulteMisses')}</dt>
            <dd>{session.missCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('schulteNewBestTime')}
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
        <ShareAction
          gameId="schulte-table"
          outcome="completed"
          details={[
            { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
            { label: t('schulteMisses'), value: String(session.missCount) },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
