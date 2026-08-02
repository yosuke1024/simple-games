/**
 * The end-of-run screen (docs/SKY_FIGHTER_RULES.md §2, §8, §9). Both endings
 * lead with the same free choices, and both show the score — the points were
 * scored whether or not the last wave fell.
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { LEVEL_COUNT } from '../../game/levels';
import type { LastResult } from '../../state/GameContext';

export interface SkyResultOverlayProps {
  result: LastResult | null;
  onNextLevel: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export function SkyResultOverlay({ result, onNextLevel, onRetry, onHome }: SkyResultOverlayProps) {
  const { t } = useSettings();
  if (result === null) return null;

  const cleared = result.outcome === 'cleared';
  const hasNextLevel = cleared && result.level < LEVEL_COUNT;
  const title = cleared ? t('sfClearedTitle') : t('sfFailedTitle');

  return (
    <div className="overlay">
      <div
        className={`dialog result ${cleared ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{cleared ? t('sfClearedBody') : t('sfFailedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{result.score}</dd>
          </div>
        </dl>

        {result.isNewBestScore && result.score > 0 ? (
          <p className="dialog-body">{t('sfNewBestScore')}</p>
        ) : (
          <p className="dialog-body">
            {t('bestScore')} {result.bestScore}
          </p>
        )}

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
