/**
 * The win screen (docs/FREECELL_RULES.md §4, §9). Moves and time — the facts
 * of the run. The time appears only here, because showing it while playing
 * would be a clock counting up at someone thinking.
 *
 * There is no hint count to report, unlike Klondike: this game has no hint
 * (§8).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { FreeCellSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface FreeCellResultOverlayProps {
  session: FreeCellSession;
  lastResult: LastResult | null;
  onNewDeal: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export function FreeCellResultOverlay({
  session,
  lastResult,
  onNewDeal,
  onRetry,
  onHome,
}: FreeCellResultOverlayProps) {
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
        aria-label={t('fcWonTitle')}
      >
        <h2 className="dialog-title">{t('fcWonTitle')}</h2>
        <p className="dialog-body">{t('fcWonBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestMoves ? (
          <p className="dialog-body">
            {t('fcNewBestMoves')}
            <BestDelta
              value={lastResult.moves}
              previous={lastResult.previousBestMoves}
              kind="count"
            />
          </p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('fcBestMoves')} {lastResult.bestMoves}
            <BestDelta
              value={lastResult.moves}
              previous={lastResult.previousBestMoves}
              kind="count"
            />
          </p>
        ) : null}

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">
            {t('fcNewBestTime')}
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
              {t('fcNewDeal')}
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
        <ShareAction gameId="freecell" outcome="completed" />
      </div>
      <ResultAdSlot />
    </div>
  );
}
