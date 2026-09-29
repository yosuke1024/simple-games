/**
 * The clear screen (docs/SUDOKU_6X6_RULES.md §9, §10, §13). Time, mistakes and
 * hints — the facts of the run, shown only now that the game is over. There
 * is no score, and a personal best is mentioned quietly rather than
 * celebrated. There is no losing screen, because there is no losing (§4).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { Sudoku6x6Session } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface Sudoku6x6ResultOverlayProps {
  session: Sudoku6x6Session;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function Sudoku6x6ResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: Sudoku6x6ResultOverlayProps) {
  const { t } = useSettings();
  // The filled grid gets its beat before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  // A daily is one board a day: there is no other board to offer (§9).
  const canStartNew = session.mode === 'difficulty';

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('sudoku6x6SolvedTitle')}
      >
        <h2 className="dialog-title">{t('sudoku6x6SolvedTitle')}</h2>
        <p className="dialog-body">{t('sudoku6x6SolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('sudoku6x6Mistakes')}</dt>
            <dd>{session.mistakeCount}</dd>
          </div>
          <div>
            <dt>{t('sudoku6x6HintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('sudoku6x6NewBestTime')}
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
          {canStartNew ? (
            <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
              {t('sudoku6x6NewBoard')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${canStartNew ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!canStartNew}
          >
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="sudoku-6x6"
          outcome="completed"
          details={[
            { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
            { label: t('sudoku6x6Mistakes'), value: String(session.mistakeCount) },
            { label: t('sudoku6x6HintsUsed'), value: String(session.hintCount) },
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
