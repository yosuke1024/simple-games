/**
 * The end-of-run screen (docs/plans/2026-08-08-mahjong-bubble-ludo.md
 * §Bubble Pop). Both endings lead with the same free choices — retry costs
 * nothing and rebuilds the identical board (same seed, same level) — and a
 * clear shows the run's elapsed time; a clock never appears during play.
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { LEVEL_COUNT } from '../../game/levels';
import type { LastResult } from '../../state/GameContext';

export interface BubbleResultOverlayProps {
  result: LastResult | null;
  onNextLevel: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export function BubbleResultOverlay({
  result,
  onNextLevel,
  onRetry,
  onHome,
}: BubbleResultOverlayProps) {
  const { t } = useSettings();
  // The emptied board — or the one that crossed the line — gets its beat
  // before the card covers it (docs/BUBBLE_POP_RULES.md §12).
  const revealed = useResultReveal(result !== null);
  if (!revealed || result === null) return null;

  const cleared = result.outcome === 'cleared';
  const hasNextLevel = cleared && result.level < LEVEL_COUNT;
  const title = cleared ? t('bubbleClearedTitle') : t('bubbleFailedTitle');

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${cleared ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{cleared ? t('bubbleClearedBody') : t('bubbleFailedBody')}</p>

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
        <ShareAction gameId="bubble-pop" outcome={cleared ? 'completed' : 'played'} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
