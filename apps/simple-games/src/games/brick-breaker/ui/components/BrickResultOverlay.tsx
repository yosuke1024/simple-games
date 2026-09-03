/**
 * The end-of-run screen (docs/BRICK_BREAKER_RULES.md §2, §8). Both endings
 * lead with the same free choices — retry costs nothing, and a failed wall is
 * the identical wall on the next attempt. The clear shows the run's time; a
 * clock never appears during play (§6).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { LEVEL_COUNT } from '../../game/levels';
import type { LastResult } from '../../state/GameContext';

export interface BrickResultOverlayProps {
  result: LastResult | null;
  onNextLevel: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export function BrickResultOverlay({
  result,
  onNextLevel,
  onRetry,
  onHome,
}: BrickResultOverlayProps) {
  const { t } = useSettings();
  // The emptied wall — or the lost last ball — gets its beat before the card
  // covers it (§12).
  const revealed = useResultReveal(result !== null);
  if (!revealed || result === null) return null;

  const cleared = result.outcome === 'cleared';
  const hasNextLevel = cleared && result.level < LEVEL_COUNT;
  const title = cleared ? t('bbClearedTitle') : t('bbFailedTitle');

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${cleared ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{cleared ? t('bbClearedBody') : t('bbFailedBody')}</p>

        {cleared ? (
          <dl className="result-facts">
            <div>
              <dt>{t('timeLabel')}</dt>
              <dd>{formatDuration(result.seconds)}</dd>
            </div>
          </dl>
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
