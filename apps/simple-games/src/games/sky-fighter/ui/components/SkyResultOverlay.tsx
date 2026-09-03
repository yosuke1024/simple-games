/**
 * The end-of-run screen (docs/SKY_FIGHTER_RULES.md §2, §8, §9). Both endings
 * lead with the same free choices, and both show the score and the stage the
 * run reached — the points were scored whether or not the last stage fell.
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { LastResult } from '../../state/GameContext';

export interface SkyResultOverlayProps {
  result: LastResult | null;
  onRetry: () => void;
  onHome: () => void;
}

export function SkyResultOverlay({ result, onRetry, onHome }: SkyResultOverlayProps) {
  const { t } = useSettings();
  // The settled sky gets its beat before the card covers it (§12).
  const revealed = useResultReveal(result !== null);
  if (!revealed || result === null) return null;

  const cleared = result.outcome === 'cleared';
  const title = cleared ? t('sfClearedTitle') : t('sfFailedTitle');

  return (
    <div className="overlay overlay-result">
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
            <dt>{t('sfStageReached')}</dt>
            <dd>{result.stage}</dd>
          </div>
          <div>
            <dt>{t('score')}</dt>
            <dd>{result.score}</dd>
          </div>
        </dl>

        {result.isNewBestScore && result.score > 0 ? (
          <p className="dialog-body">
            {t('sfNewBestScore')}
            <BestDelta
              value={result.score}
              previous={result.previousBestScore}
              kind="count"
              lowerIsBetter={false}
            />
          </p>
        ) : (
          <p className="dialog-body">
            {t('bestScore')} {result.bestScore}
            <BestDelta
              value={result.score}
              previous={result.previousBestScore}
              kind="count"
              lowerIsBetter={false}
            />
          </p>
        )}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="sky-fighter" outcome={cleared ? 'completed' : 'played'} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
