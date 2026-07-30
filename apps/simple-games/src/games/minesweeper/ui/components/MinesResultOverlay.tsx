/**
 * The end of a game (docs/MINESWEEPER_RULES.md §2, §6, §7).
 *
 * A win and a loss get the same quiet card: the time it took, the hints taken,
 * and the same board offered straight back. Opening a mine is how Minesweeper
 * ends, not a punishment, so nothing here scolds and nothing here sells a
 * second chance — the retry is free, immediate, and the first button (§13).
 */
import { useSettings } from '@/state/SettingsContext';
import { formatDuration } from '@/ui/format';
import type { MinesweeperSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface MinesResultOverlayProps {
  session: MinesweeperSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function MinesResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: MinesResultOverlayProps) {
  const { t } = useSettings();
  if (session.status === 'playing') return null;

  const won = session.status === 'won';
  const title = won ? t('minesWonTitle') : t('minesLostTitle');
  // A daily is one board a day: there is no other board to offer (§8).
  const canStartNew = session.mode === 'difficulty';

  return (
    <div className="overlay">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{won ? t('minesWonBody') : t('minesLostBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('minesHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {won && lastResult?.isNewBest ? (
          <p className="dialog-body">{t('minesNewBestTime')}</p>
        ) : lastResult?.bestSeconds != null ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(lastResult.bestSeconds)}
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          {canStartNew ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('minesNewBoard')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
