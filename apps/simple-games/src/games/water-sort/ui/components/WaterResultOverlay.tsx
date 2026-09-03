/**
 * The clear screen (docs/WATER_SORT_RULES.md §4, §8, §9). Pours, time, and
 * hints — the facts of the run. The time appears only here, because showing
 * it while playing would be a clock counting up at someone thinking. Hints
 * are a fact, never a deduction: they were free (§8).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { MAX_LEVEL, type WaterSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface WaterResultOverlayProps {
  session: WaterSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  /** Free play's "next": another board at the same tier (§6). */
  onNewFree: () => void;
  onHome: () => void;
}

export function WaterResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onNewFree,
  onHome,
}: WaterResultOverlayProps) {
  const { t } = useSettings();
  // The sorted tubes get their beat before the card covers them (§12).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  const hasNextLevel =
    session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;
  // A free board's "next" is another board at the same tier; a level's is the
  // next level; a daily has neither, and the retry leads.
  const hasNext = hasNextLevel || session.mode === 'free';
  // A free board has no record of its own to stand against — the statistics
  // hold counts, not bests (§6「フリープレイ」) — so its card states the run
  // and stops.
  const records = session.mode === 'free' ? null : lastResult;

  return (
    <div className="overlay overlay-result">
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

        {records?.isNewBestMoves ? (
          <p className="dialog-body">
            {t('waterNewBestMoves')}
            <BestDelta value={records.moves} previous={records.previousBestMoves} kind="count" />
          </p>
        ) : records ? (
          <p className="dialog-body">
            {t('waterBestMoves')} {records.bestMoves}
            <BestDelta value={records.moves} previous={records.previousBestMoves} kind="count" />
          </p>
        ) : null}

        {records?.isNewBestTime ? (
          <p className="dialog-body">
            {t('waterNewBestTime')}
            <BestDelta value={records.seconds} previous={records.previousBestSeconds} kind="time" />
          </p>
        ) : records ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(records.bestSeconds)}
            <BestDelta value={records.seconds} previous={records.previousBestSeconds} kind="time" />
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
