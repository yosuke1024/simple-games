/**
 * The end-of-run screen (docs/SNAKE_RULES.md §2, §8). One board's worth of
 * facts and two buttons: the run is over, and starting another costs nothing.
 * There is no continue-for-an-ad and no revival — a run that ended, ended
 * (§13). No time is shown here either; the clock lives only in the statistics
 * (§12).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import type { LastResult } from '../../state/GameContext';

export interface SnakeResultOverlayProps {
  result: LastResult | null;
  onNewGame: () => void;
  onHome: () => void;
}

export function SnakeResultOverlay({ result, onNewGame, onHome }: SnakeResultOverlayProps) {
  const { t } = useSettings();
  if (result === null) return null;

  const filled = result.outcome === 'full';
  const title = filled ? t('snakeFullTitle') : t('snakeOverTitle');

  return (
    <div className="overlay">
      <div
        className={`dialog result ${filled ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{filled ? t('snakeFullBody') : t('snakeOverBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>{t('snakeLength')}</dt>
            <dd>{result.length}</dd>
          </div>
        </dl>

        {result.isNewBestScore && result.score > 0 ? (
          <p className="dialog-body">{t('snakeNewBestScore')}</p>
        ) : (
          <p className="dialog-body">
            {t('snakeBestScore')} {result.bestScore}
          </p>
        )}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
            {t('newGame')}
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
