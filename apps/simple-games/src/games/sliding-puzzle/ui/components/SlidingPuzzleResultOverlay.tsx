/**
 * The clear screen (docs/SLIDING_PUZZLE_RULES.md §4, §9). Moves and time — the
 * facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone doing a puzzle. There is no
 * score, and a personal best is mentioned quietly rather than celebrated.
 */
import { useSettings } from '@/state/SettingsContext';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL, type SlidingPuzzleSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';

export interface SlidingPuzzleResultOverlayProps {
  session: SlidingPuzzleSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function SlidingPuzzleResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: SlidingPuzzleResultOverlayProps) {
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
        aria-label={t('slideSolvedTitle')}
      >
        <h2 className="dialog-title">{t('slideSolvedTitle')}</h2>
        <p className="dialog-body">{t('slideSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('slideMoves')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestMoves ? (
          <p className="dialog-body">{t('slideNewBestMoves')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('slideBestMoves')} {lastResult.bestMoves}
          </p>
        ) : null}

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">{t('slideNewBestTime')}</p>
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
