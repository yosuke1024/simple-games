/**
 * The clear screen (docs/SUDOKU_RULES.md §12). Time, mistakes and hints — the
 * facts of the run, shown only now that the game is over. There is no score,
 * and a personal best is mentioned quietly rather than celebrated at length.
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { MAX_LEVEL, type SudokuSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface SudokuResultOverlayProps {
  session: SudokuSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function SudokuResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: SudokuResultOverlayProps) {
  const { t } = useSettings();
  // The filled grid gets its beat before the card covers it (§12).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  const hasNextLevel =
    session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('sudokuSolvedTitle')}
      >
        <h2 className="dialog-title">{t('sudokuSolvedTitle')}</h2>
        <p className="dialog-body">{t('sudokuSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('sudokuMistakes')}</dt>
            <dd>{session.mistakeCount}</dd>
          </div>
          <div>
            <dt>{t('hint')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('sudokuNewBestTime')}
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
      </div>
      <ResultAdSlot />
    </div>
  );
}
