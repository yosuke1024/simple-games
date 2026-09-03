/**
 * The clear screen (docs/QUICK_MATH_RULES.md §4, §10).
 *
 * Time and wrong answers — the facts of the set. Both appear only here: a
 * clock counting up at somebody doing arithmetic is pressure, and a running
 * mistake tally is a running reproach.
 *
 * Wrong answers are shown as a fact and never as a record: a "fewest mistakes"
 * best is set by answering slowly, and keeping it would tell the player which
 * of speed and care the game wants (§4).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { MAX_LEVEL, type QuickMathSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface QuickMathResultOverlayProps {
  session: QuickMathSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function QuickMathResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: QuickMathResultOverlayProps) {
  const { t } = useSettings();
  // The last answer gets its beat before the card covers it (§12).
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
        aria-label={t('qmathDoneTitle')}
      >
        <h2 className="dialog-title">{t('qmathDoneTitle')}</h2>
        <p className="dialog-body">{t('qmathDoneBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('qmathMisses')}</dt>
            <dd>{session.missCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('qmathNewBestTime')}
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
        <ShareAction gameId="quick-math" outcome="completed" />
      </div>
      <ResultAdSlot />
    </div>
  );
}
