/**
 * The win (docs/NUMBER_RECALL_RULES.md §5). A centred dialog is right here
 * and only here: the round is over and there is nothing behind it left to
 * read, so covering the board costs nothing.
 *
 * A missed round is the opposite case and gets its own, non-covering panel
 * (RecallRevealPanel) — the board behind it is the answer.
 *
 * "Try again" means a NEW layout at the same level (§8), not this one again.
 * That is the opposite of Memory Match, and the reason is that this game shows
 * everything at the start: replaying the same layout would be reading back
 * what was just on screen.
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { MAX_LEVEL, type RecallSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface RecallResultOverlayProps {
  session: RecallSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function RecallResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: RecallResultOverlayProps) {
  const { t } = useSettings();
  // The last tile turned gets its beat before the card covers the board (§14).
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
        aria-label={t('recallDoneTitle')}
      >
        <h2 className="dialog-title">{t('recallDoneTitle')}</h2>
        <p className="dialog-body">{t('recallDoneBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('recallTiles')}</dt>
            <dd>{session.tileCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('recallNewBestTime')}
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
            {t('recallNewLayout')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="number-recall" outcome="completed" />
      </div>
      <ResultAdSlot />
    </div>
  );
}
