/**
 * The win screen (docs/SPIDER_SOLITAIRE_RULES.md §4, §8, §9). Moves, time, and hints
 * — the facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone thinking. Hints are a fact,
 * never a deduction: they were free (§8).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { SpiderSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface SpiderResultOverlayProps {
  session: SpiderSession;
  lastResult: LastResult | null;
  onNewDeal: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export function SpiderResultOverlay({
  session,
  lastResult,
  onNewDeal,
  onRetry,
  onHome,
}: SpiderResultOverlayProps) {
  const { t } = useSettings();
  // The completed foundations get their beat before the card covers them (§12).
  const revealed = useResultReveal(session.status === 'won');
  if (!revealed) return null;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('spiderWonTitle')}
      >
        <h2 className="dialog-title">{t('spiderWonTitle')}</h2>
        <p className="dialog-body">{t('spiderWonBody')}</p>

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
              <dt>{t('spiderHintsUsed')}</dt>
              <dd>{session.hintCount}</dd>
            </div>
          ) : null}
        </dl>

        {lastResult?.isNewBestMoves ? (
          <p className="dialog-body">
            {t('spiderNewBestMoves')}
            <BestDelta
              value={lastResult.moves}
              previous={lastResult.previousBestMoves}
              kind="count"
            />
          </p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('spiderBestMoves')} {lastResult.bestMoves}
            <BestDelta
              value={lastResult.moves}
              previous={lastResult.previousBestMoves}
              kind="count"
            />
          </p>
        ) : null}

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">
            {t('spiderNewBestTime')}
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
          {session.mode === 'free' ? (
            <button type="button" className="btn btn-primary" onClick={onNewDeal} autoFocus>
              {t('spiderNewDeal')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${session.mode === 'free' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={session.mode !== 'free'}
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
